import { NextRequest, NextResponse } from 'next/server';
import { SymptomAnalysis, PatientInfo } from '@/lib/types';
import { callAI, parseJsonResponse } from '@/lib/ai';

export interface FieldGuideResponse {
  treatments: string[];         // 3-5 현장 처치 지침
  contraindications: string[];  // 금기사항 (알레르기/약물 기반)
  deteriorationRisk: number;    // 0-100 악화 위험도 %
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskFactors: string[];        // 위험 요인 설명 (1-3줄)
  monitoringInterval: number;   // 바이탈 체크 권장 간격 (분)
}

const SYSTEM_PROMPT = `당신은 대한민국 119 구급대원을 위한 현장 응급처치 AI 어드바이저입니다.
KTAS 분석 결과와 환자 정보를 바탕으로, 이송 중 구급대원이 수행해야 할 처치를 안내합니다.

아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.

{
  "treatments": ["처치1", "처치2", "처치3"],
  "contraindications": ["금기사항1"],
  "deteriorationRisk": 0~100,
  "riskLevel": "low|moderate|high|critical",
  "riskFactors": ["위험요인1"],
  "monitoringInterval": 숫자(분)
}

## treatments 작성 규칙:
- 구급대원이 현장/이송 중 실제 수행 가능한 처치만 포함
- 각 항목은 한 문장, 15자~40자 내외로 간결하게
- 우선순위 높은 순으로 정렬
- 3~5개 항목
- 예: "산소 마스크 10L/min 투여", "12유도 심전도 측정", "정맥로 확보 (NS 1L)"

## contraindications 작성 규칙:
- 환자의 알레르기/복용약물과 충돌하는 처치가 있으면 경고
- 없으면 빈 배열

## deteriorationRisk 산정 기준:
- KTAS 1: 기본 80-95%
- KTAS 2: 기본 50-80%
- KTAS 3: 기본 20-50%
- KTAS 4-5: 기본 5-20%
- 의식수준 P/U: +15%
- SpO2 < 90%: +15%
- HR > 130 또는 < 50: +10%
- BP 수축기 < 90: +20%
- 고령(75+): +10%

## riskLevel 기준:
- 0-25: "low"
- 26-50: "moderate"
- 51-75: "high"
- 76-100: "critical"

## monitoringInterval 기준:
- KTAS 1: 1분
- KTAS 2: 3분
- KTAS 3: 5분
- KTAS 4-5: 10분
- 의식 저하/쇼크 의심 시 1분으로 단축`;

function fallbackFieldGuide(analysis: SymptomAnalysis, patientInfo?: PatientInfo): FieldGuideResponse {
  const treatments: string[] = [];
  const contraindications: string[] = [];
  const riskFactors: string[] = [];
  const ktasLevel = analysis.ktasLevel;

  // Basic treatments by KTAS
  if (ktasLevel <= 2) {
    treatments.push('정맥로 확보 (NS 1L open)');
    treatments.push('심전도 모니터링 시작');
  }

  // Condition-specific treatments
  const conditions = analysis.suspectedConditions.join(' ');
  if (conditions.includes('심정지')) {
    treatments.unshift('고품질 CPR 지속 (30:2)');
    treatments.push('제세동기 부착 및 리듬 분석');
    treatments.push('에피네프린 1mg IV 준비');
  } else if (conditions.includes('심근경색') || conditions.includes('흉통') || conditions.includes('협심증')) {
    treatments.push('산소 투여 (SpO2 < 94% 시)');
    treatments.push('12유도 심전도 측정');
    treatments.push('니트로글리세린 설하 투여 고려');
    treatments.push('아스피린 300mg 경구 투여 고려');
  } else if (conditions.includes('뇌졸중')) {
    treatments.push('기도 확보 및 두부 30도 거상');
    treatments.push('혈당 측정 (저혈당 배제)');
    treatments.push('발병 시각 정확히 기록');
    treatments.push('산소 투여 (SpO2 < 94% 시)');
  } else if (conditions.includes('외상')) {
    treatments.push('경추 고정 (C-spine immobilization)');
    treatments.push('직접 압박 지혈');
    treatments.push('산소 투여 10L/min');
    treatments.push('보온 유지 (저체온 방지)');
  } else if (conditions.includes('호흡')) {
    treatments.push('좌위 유지 (앉은 자세)');
    treatments.push('산소 마스크 10-15L/min 투여');
    treatments.push('네블라이저 기관지확장제 고려');
  } else if (conditions.includes('출혈')) {
    treatments.push('직접 압박 지혈');
    treatments.push('하지 거상 (쇼크 체위)');
    treatments.push('대량 수액 투여 (NS rapid)');
    treatments.push('보온 유지');
  } else {
    treatments.push('활력징후 지속 모니터링');
    treatments.push('산소 투여 (필요시)');
    if (ktasLevel <= 3) treatments.push('정맥로 확보');
  }

  // Contraindications based on allergies/meds
  if (patientInfo) {
    const allergies = (patientInfo.allergies || '').toLowerCase();
    const meds = (patientInfo.medications || '').toLowerCase();

    if (allergies.includes('아스피린') || allergies.includes('nsaid')) {
      contraindications.push('아스피린 투여 금기 (알레르기)');
    }
    if (meds.includes('와파린') || meds.includes('warfarin')) {
      contraindications.push('출혈 위험 증가 (항응고제 복용 중)');
    }
    if (meds.includes('베타차단') || meds.includes('beta')) {
      contraindications.push('서맥 주의 (베타차단제 복용 중)');
    }
  }

  // Deterioration risk calculation
  let risk = 0;
  if (ktasLevel === 1) risk = 85;
  else if (ktasLevel === 2) risk = 60;
  else if (ktasLevel === 3) risk = 35;
  else if (ktasLevel === 4) risk = 15;
  else risk = 8;

  if (patientInfo) {
    if (patientInfo.consciousnessLevel === 'pain' || patientInfo.consciousnessLevel === 'unresponsive') {
      risk += 15;
      riskFactors.push('의식수준 저하');
    }
    if (patientInfo.oxygenSaturation && patientInfo.oxygenSaturation < 90) {
      risk += 15;
      riskFactors.push(`산소포화도 저하 (${patientInfo.oxygenSaturation}%)`);
    }
    if (patientInfo.heartRate && (patientInfo.heartRate > 130 || patientInfo.heartRate < 50)) {
      risk += 10;
      riskFactors.push(`심박수 이상 (${patientInfo.heartRate}bpm)`);
    }
    if (patientInfo.bloodPressureSystolic && patientInfo.bloodPressureSystolic < 90) {
      risk += 20;
      riskFactors.push(`저혈압/쇼크 의심 (${patientInfo.bloodPressureSystolic}mmHg)`);
    }
    if (patientInfo.age && patientInfo.age >= 75) {
      risk += 10;
      riskFactors.push('고령 환자 (75세 이상)');
    }
  }

  risk = Math.min(risk, 99);

  if (riskFactors.length === 0) {
    if (ktasLevel <= 2) riskFactors.push('높은 응급도 (KTAS ' + ktasLevel + '등급)');
    else riskFactors.push('현재 바이탈 안정');
  }

  let riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  if (risk <= 25) riskLevel = 'low';
  else if (risk <= 50) riskLevel = 'moderate';
  else if (risk <= 75) riskLevel = 'high';
  else riskLevel = 'critical';

  // Monitoring interval
  let monitoringInterval: number;
  if (ktasLevel === 1) monitoringInterval = 1;
  else if (ktasLevel === 2) monitoringInterval = 3;
  else if (ktasLevel === 3) monitoringInterval = 5;
  else monitoringInterval = 10;

  if (patientInfo?.consciousnessLevel === 'unresponsive' || patientInfo?.consciousnessLevel === 'pain') {
    monitoringInterval = 1;
  }
  if (patientInfo?.bloodPressureSystolic && patientInfo.bloodPressureSystolic < 90) {
    monitoringInterval = 1;
  }

  return {
    treatments: treatments.slice(0, 5),
    contraindications,
    deteriorationRisk: risk,
    riskLevel,
    riskFactors,
    monitoringInterval,
  };
}

export async function POST(req: NextRequest) {
  const { analysis, patientInfo } = await req.json() as {
    analysis: SymptomAnalysis;
    patientInfo?: PatientInfo;
  };

  if (!analysis) {
    return NextResponse.json({ error: '증상 분석 결과가 필요합니다.' }, { status: 400 });
  }

  // Build context for AI
  let userPrompt = `KTAS ${analysis.ktasLevel}등급 (${analysis.ktasLabel})
의심 질환: ${analysis.suspectedConditions.join(', ')}
필요 진료과: ${analysis.requiredSpecialties.join(', ')}
필요 시설: ${analysis.requiredFacilities.join(', ')}`;

  if (patientInfo) {
    if (patientInfo.age) userPrompt += `\n나이: ${patientInfo.age}세`;
    if (patientInfo.gender !== 'unknown') userPrompt += ` / 성별: ${patientInfo.gender === 'male' ? '남' : '여'}`;
    if (patientInfo.consciousnessLevel !== 'unset') userPrompt += `\n의식수준: ${patientInfo.consciousnessLevel}`;
    if (patientInfo.bloodPressureSystolic) userPrompt += `\nBP: ${patientInfo.bloodPressureSystolic}/${patientInfo.bloodPressureDiastolic}`;
    if (patientInfo.heartRate) userPrompt += `\nHR: ${patientInfo.heartRate}`;
    if (patientInfo.oxygenSaturation) userPrompt += `\nSpO2: ${patientInfo.oxygenSaturation}%`;
    if (patientInfo.respiratoryRate) userPrompt += `\nRR: ${patientInfo.respiratoryRate}`;
    if (patientInfo.temperature) userPrompt += `\nBT: ${patientInfo.temperature}°C`;
    if (patientInfo.allergies && patientInfo.allergies !== '없음' && patientInfo.allergies !== '확인불가') {
      userPrompt += `\n알레르기: ${patientInfo.allergies}`;
    }
    if (patientInfo.medications && patientInfo.medications !== '없음' && patientInfo.medications !== '확인불가') {
      userPrompt += `\n복용약물: ${patientInfo.medications}`;
    }
  }

  const aiResponse = await callAI({
    systemPrompt: SYSTEM_PROMPT,
    userText: userPrompt,
    maxTokens: 1024,
  });

  if (aiResponse) {
    const parsed = parseJsonResponse<FieldGuideResponse>(aiResponse);
    if (parsed) return NextResponse.json(parsed);
  }

  return NextResponse.json(fallbackFieldGuide(analysis, patientInfo));
}
