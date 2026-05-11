import { NextRequest, NextResponse } from 'next/server';
import { PatientInfo } from '@/lib/types';
import { callAI, parseJsonResponse } from '@/lib/ai';

const SYSTEM_PROMPT = `당신은 응급 환자 정보 파서입니다. 구급대원이 자유롭게 말한 내용에서 환자 정보를 추출해 JSON으로만 응답하세요.

추출 형식:
{
  "patientInfo": {
    "age": null | number,
    "gender": "male" | "female" | "unknown",
    "consciousnessLevel": "unset" | "alert" | "verbal" | "pain" | "unresponsive",
    "bloodPressureSystolic": null | number,
    "bloodPressureDiastolic": null | number,
    "heartRate": null | number,
    "respiratoryRate": null | number,
    "temperature": null | number,
    "oxygenSaturation": null | number,
    "allergies": "",
    "medications": ""
  },
  "symptomsText": "증상에 해당하는 자유 텍스트만"
}

규칙:
- 언급되지 않은 숫자 필드는 null
- gender 미언급 시 "unknown"
- 의식수준: "의식 명료/있음/멀쩡" → alert, "이름 부르면 반응/언어 자극" → verbal, "꼬집으면 반응/통증 자극" → pain, "무반응/의식 없음" → unresponsive, 미언급 → unset
- 혈압 표현: "145에 90", "145/90", "145 over 90" 모두 인식 → systolic 145, diastolic 90
- 심박/HR: 분당 박동수
- 호흡/RR: 분당 호흡수
- 산소포화도/SpO2: 퍼센트
- 체온/BT: 섭씨 (37.5 등 소수)
- 알레르기/복용약: 명시적 언급 시만 채움 ("페니실린 알레르기" → "페니실린"). "없음", "확인불가" 등도 그대로 사용. 미언급 시 빈 문자열.
- symptomsText: 환자정보(나이, 바이탈 등)를 제외한 증상·소견만. 예: "가슴 통증, 식은땀, 호흡곤란"
- 한국 의료 용어 우선 인식

JSON만 출력. 설명 추가 금지.`;

interface ParseResult {
  patientInfo: PatientInfo;
  symptomsText: string;
}

const EMPTY_PATIENT: PatientInfo = {
  age: null,
  gender: 'unknown',
  consciousnessLevel: 'unset',
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  heartRate: null,
  respiratoryRate: null,
  temperature: null,
  oxygenSaturation: null,
  chiefComplaint: '',
  allergies: '',
  medications: '',
};

function fallbackParse(text: string): ParseResult {
  const t = text.toLowerCase();
  const patientInfo: PatientInfo = { ...EMPTY_PATIENT };
  let leftover = text;

  const consume = (re: RegExp) => {
    leftover = leftover.replace(re, ' ').replace(/\s{2,}/g, ' ');
  };

  // Age
  const ageMatch = text.match(/(\d{1,3})\s*세/);
  if (ageMatch) {
    patientInfo.age = parseInt(ageMatch[1]);
    consume(new RegExp(`${ageMatch[1]}\\s*세`));
  }

  // Gender
  if (/남(성|자)/.test(t)) {
    patientInfo.gender = 'male';
    consume(/남(성|자)/);
  } else if (/여(성|자)/.test(t)) {
    patientInfo.gender = 'female';
    consume(/여(성|자)/);
  }

  // Consciousness
  if (/(무반응|의식\s*없|의식없)/.test(t)) {
    patientInfo.consciousnessLevel = 'unresponsive';
    consume(/(무반응|의식\s*없|의식없)/);
  } else if (/통증\s*반응/.test(t)) {
    patientInfo.consciousnessLevel = 'pain';
    consume(/통증\s*반응/);
  } else if (/언어\s*반응/.test(t)) {
    patientInfo.consciousnessLevel = 'verbal';
    consume(/언어\s*반응/);
  } else if (/(의식\s*명료|의식\s*있)/.test(t)) {
    patientInfo.consciousnessLevel = 'alert';
    consume(/(의식\s*명료|의식\s*있)/);
  } else if (/의식\s*흐림/.test(t)) {
    patientInfo.consciousnessLevel = 'verbal';
    consume(/의식\s*흐림/);
  }

  // BP — "혈압 145에 90", "BP 145/90", "145/90", "145 대 90"
  const bpMatch = text.match(/(?:혈압\s*|bp\s*)?(\d{2,3})\s*[\/대에]\s*(\d{2,3})/i);
  if (bpMatch) {
    const sys = parseInt(bpMatch[1]);
    const dia = parseInt(bpMatch[2]);
    if (sys >= 50 && sys <= 250 && dia >= 30 && dia <= 150) {
      patientInfo.bloodPressureSystolic = sys;
      patientInfo.bloodPressureDiastolic = dia;
      consume(new RegExp(bpMatch[0]));
    }
  }

  // HR
  const hrMatch = text.match(/(?:심박수?|맥박|hr)\s*(?:는|이|가)?\s*(\d{2,3})/i);
  if (hrMatch) {
    patientInfo.heartRate = parseInt(hrMatch[1]);
    consume(new RegExp(hrMatch[0]));
  }

  // RR
  const rrMatch = text.match(/(?:호흡수?|rr)\s*(?:는|이|가)?\s*(\d{1,2})/i);
  if (rrMatch) {
    patientInfo.respiratoryRate = parseInt(rrMatch[1]);
    consume(new RegExp(rrMatch[0]));
  }

  // BT
  const btMatch = text.match(/(?:체온|bt)\s*(?:는|이|가)?\s*(\d{2})\.?(\d?)/i);
  if (btMatch) {
    patientInfo.temperature = parseFloat(`${btMatch[1]}.${btMatch[2] || '0'}`);
    consume(new RegExp(btMatch[0]));
  }

  // SpO2
  const spo2Match = text.match(/(?:산소\s*포화도|포화도|spo2)\s*(?:는|이|가)?\s*(\d{2,3})/i);
  if (spo2Match) {
    patientInfo.oxygenSaturation = parseInt(spo2Match[1]);
    consume(new RegExp(spo2Match[0]));
  }

  // Allergies / meds (간단 추출 — 명시적 단어 뒤만)
  const allergyMatch = text.match(/알레르기[는는도]?\s*([^,.\n]+?)(?=[,.\n]|$|\s{2,})/);
  if (allergyMatch) {
    patientInfo.allergies = allergyMatch[1].trim();
    consume(new RegExp(`알레르기[는는도]?\\s*${allergyMatch[1].trim()}`));
  }
  const medMatch = text.match(/(?:복용\s*약(?:물)?|복용중인\s*약)[는는도]?\s*([^,.\n]+?)(?=[,.\n]|$|\s{2,})/);
  if (medMatch) {
    patientInfo.medications = medMatch[1].trim();
  }

  const symptomsText = leftover.replace(/[,.]\s*[,.]+/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').trim();

  return {
    patientInfo,
    symptomsText: symptomsText || text,
  };
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text가 필요합니다.' }, { status: 400 });
  }

  const aiResponse = await callAI({
    systemPrompt: SYSTEM_PROMPT,
    userText: `구급대원 발화: ${text}`,
    maxTokens: 1024,
  });

  if (aiResponse) {
    const parsed = parseJsonResponse<ParseResult>(aiResponse);
    if (parsed) return NextResponse.json(parsed);
  }

  return NextResponse.json(fallbackParse(text));
}
