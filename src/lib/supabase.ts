import { createClient } from '@supabase/supabase-js';

// 다른 앱과 격리된 'goldenlink' 스키마 전용 클라이언트.
// ReturnType으로 schema 제네릭이 올바르게 전파되도록 한다.
const makeClient = (url: string, key: string) =>
  createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'goldenlink' },
  });

export type GoldenLinkClient = ReturnType<typeof makeClient>;

let cached: GoldenLinkClient | null = null;

export function getSupabase(): GoldenLinkClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = makeClient(url, key);
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
