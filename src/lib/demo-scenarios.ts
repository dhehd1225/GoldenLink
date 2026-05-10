import { PatientInfo } from './types';

export interface DemoScenario {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  highlight: string;
  patientInfo: PatientInfo;
  symptomsText: string;
  quickSymptoms: string[];
  rejectAfterMs: number;
  acceptAfterMs: number;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'cardiac',
    emoji: '🫀',
    title: '60대 남성, 흉통',
    subtitle: 'KTAS 2 · 급성관상동맥증후군 의심',
    description: '가슴 압박감, 식은땀, 좌측 어깨 방사통',
    highlight: '캐스케이드 자동 매칭 — 첫 병원 거절 시 다음 병원 자동 요청',
    patientInfo: {
      age: 65,
      gender: 'male',
      consciousnessLevel: 'verbal',
      bloodPressureSystolic: 145,
      bloodPressureDiastolic: 90,
      heartRate: 110,
      respiratoryRate: 24,
      temperature: 36.5,
      oxygenSaturation: 94,
      chiefComplaint: '',
      allergies: '확인불가',
      medications: '확인불가',
    },
    symptomsText: '가슴 중앙 압박감, 식은땀, 좌측 어깨로 방사',
    quickSymptoms: ['흉통'],
    rejectAfterMs: 4000,
    acceptAfterMs: 5000,
  },
  {
    id: 'unresponsive',
    emoji: '🚨',
    title: '30대 남성, 의식 없음',
    subtitle: 'KTAS 1 · 즉각 소생 필요',
    description: '길에서 쓰러져 발견, 자극에 무반응',
    highlight: 'AI가 KTAS 1 자동 분류 → 응급 1순위 매칭',
    patientInfo: {
      age: 32,
      gender: 'male',
      consciousnessLevel: 'unresponsive',
      bloodPressureSystolic: 80,
      bloodPressureDiastolic: 50,
      heartRate: 140,
      respiratoryRate: 8,
      temperature: 35.8,
      oxygenSaturation: 86,
      chiefComplaint: '',
      allergies: '확인불가',
      medications: '확인불가',
    },
    symptomsText: '길에서 쓰러져 발견, 자극에 무반응',
    quickSymptoms: ['의식저하'],
    rejectAfterMs: 0,
    acceptAfterMs: 4500,
  },
  {
    id: 'trauma',
    emoji: '🚗',
    title: '40대 여성, 교통사고',
    subtitle: 'KTAS 2 · 다발성 외상',
    description: '운전석 추돌, 흉부·복부 통증, 우측 다리 변형, 출혈',
    highlight: '외상소생실 보유 병원 자동 우선순위',
    patientInfo: {
      age: 42,
      gender: 'female',
      consciousnessLevel: 'pain',
      bloodPressureSystolic: 95,
      bloodPressureDiastolic: 60,
      heartRate: 125,
      respiratoryRate: 28,
      temperature: 36.0,
      oxygenSaturation: 93,
      chiefComplaint: '',
      allergies: '없음',
      medications: '없음',
    },
    symptomsText: '운전석 추돌 후 흉부·복부 통증, 우측 다리 변형, 출혈',
    quickSymptoms: ['교통사고', '출혈'],
    rejectAfterMs: 0,
    acceptAfterMs: 5500,
  },
];

export function getDemoScenario(id: string | null): DemoScenario | null {
  if (!id) return null;
  return DEMO_SCENARIOS.find(s => s.id === id) || null;
}
