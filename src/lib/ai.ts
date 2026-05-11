import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AICallOptions {
  systemPrompt: string;
  userText: string;
  maxTokens?: number;
}

/**
 * Provider order: Gemini Flash (free + cheap) → Anthropic Claude (fallback) → null.
 * Returns the raw model text response, or null if no provider is configured/working.
 */
export async function callAI({ systemPrompt, userText, maxTokens = 1024 }: AICallOptions): Promise<string | null> {
  // ── Gemini 2.5 Flash ──
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
        generationConfig: {
          // Gemini 2.5 Flash는 thinking이 기본 on이라 output budget을 잡아먹음.
          // KTAS JSON 응답이 잘리지 않도록 최소 4096 확보.
          maxOutputTokens: Math.max(maxTokens, 4096),
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(userText);
      return result.response.text();
    } catch (e) {
      console.error('Gemini error, trying Anthropic fallback:', e);
    }
  }

  // ── Claude Sonnet 4.6 (fallback) ──
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const message = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }],
      });
      const content = message.content[0];
      if (content.type === 'text') return content.text;
    } catch (e) {
      console.error('Anthropic error:', e);
    }
  }

  return null;
}

export function parseJsonResponse<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
