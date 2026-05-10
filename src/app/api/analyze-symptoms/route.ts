import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SymptomAnalysis, KTASLevel } from '@/lib/types';

const SYSTEM_PROMPT = `당신은 응급의료 전문 AI입니다. 구급대원이 보고하는 환자 증상을 분석하여 아래 JSON 형식으로만 응답하세요.
설명 없이 JSON만 출력하세요.

{
  "ktasLevel": 1~5,
  "ktasLabel": "소생|긴급|응급|준응급|비응급",
  "requiredSpecialties": ["필요 진료과 배열"],
  "requiredFacilities": ["필요 시설/장비 배열"],
  "suspectedConditions": ["의심 질환 배열"],
  "reasoning": "판단 근거 한 문장"
}

KTAS 기준:
1등급(소생): 심정지, 의식없음, 대량출혈 등 즉각 생명위협
2등급(긴급): 흉통, 뇌졸중 의심, 중증외상 등 시간의존적 생명위협
3등급(응급): 복통+발열, 중등도외상, 호흡곤란 등 응급처치 필요
4등급(준응급): 단순골절, 경미한 열상 등 1-2시간 대기 가능
5등급(비응급): 감기, 경미한 통증 등 경증

환자 바이탈 정보가 포함된 경우 참고하세요:
- SpO2 < 90%: 긴급도 상향 고려
- HR > 130 또는 < 50: 긴급도 상향 고려
- BP 수축기 < 90: 쇼크 의심
- BT > 39°C: 감염/패혈증 고려
- 의식수준 V/P/U: 긴급도 상향

가능한 진료과: 응급의학과, 신경외과, 흉부외과, 심장내과, 정형외과, 일반외과, 신경과, 소아청소년과, 산부인과, 비뇨의학과, 성형외과, 안과, 이비인후과
가능한 시설: CT, MRI, 혈관조영술, 인공심폐기, 응급수술실, 외상소생실, 신생아집중치료실, 화상치료실, 고압산소치료기`;

// Enhanced fallback with better pattern matching
function fallbackAnalysis(text: string): SymptomAnalysis {
  const t = text.toLowerCase();
  let ktasLevel: KTASLevel = 4;
  let ktasLabel = '준응급';
  const specialties: string[] = ['응급의학과'];
  const facilities: string[] = [];
  const conditions: string[] = [];
  let reasoning = '';

  // Extract vitals from text
  const spo2Match = t.match(/spo2[:\s]*(\d+)/);
  const hrMatch = t.match(/hr[:\s]*(\d+)/);
  const bpMatch = t.match(/bp[:\s]*(\d+)/);
  const spo2 = spo2Match ? parseInt(spo2Match[1]) : null;
  const hr = hrMatch ? parseInt(hrMatch[1]) : null;
  const bpSys = bpMatch ? parseInt(bpMatch[1]) : null;

  // Check consciousness level
  const unconscious = t.includes('무반응') || t.includes('unresponsive') || t.includes('u (');
  const painOnly = t.includes('통증반응') || t.includes('p (');

  // ── KTAS 1: Resuscitation ──
  if (t.includes('심정지') || t.includes('심폐정지') || t.includes('cpa') || t.includes('cardiac arrest')) {
    ktasLevel = 1; ktasLabel = '소생';
    specialties.push('심장내과', '흉부외과');
    facilities.push('인공심폐기', '응급수술실');
    conditions.push('심정지');
    reasoning = '심정지 상태로 즉각적 심폐소생술 및 제세동 필요';
  } else if ((t.includes('의식 없') || t.includes('의식없') || t.includes('무의식') || unconscious) && !t.includes('의식 있')) {
    ktasLevel = 1; ktasLabel = '소생';
    specialties.push('신경외과', '신경과');
    facilities.push('CT', 'MRI');
    conditions.push('의식불명');
    reasoning = '의식 소실 상태로 즉각적 평가 및 기도 확보 필요';
  } else if (t.includes('대량출혈') || t.includes('대량 출혈') || (t.includes('출혈') && t.includes('지혈 곤란'))) {
    ktasLevel = 1; ktasLabel = '소생';
    specialties.push('일반외과', '흉부외과');
    facilities.push('응급수술실', '외상소생실');
    conditions.push('대량출혈');
    reasoning = '지혈 곤란한 대량출혈로 즉각적 수술적 처치 필요';
  }
  // ── KTAS 2: Emergent ──
  else if (t.includes('흉통') || t.includes('가슴 통증') || t.includes('가슴통증') || t.includes('가슴 압박') || t.includes('가슴압박')) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('심장내과', '흉부외과');
    facilities.push('혈관조영술', 'CT');
    conditions.push('급성심근경색 의심', '불안정형 협심증');
    reasoning = '흉통은 급성관상동맥증후군 가능성이 있어 긴급 심장 평가 필요';
  } else if (t.includes('뇌') || t.includes('마비') || t.includes('어눌') || t.includes('편마비') || t.includes('언어장애') || t.includes('뇌졸중')) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('신경외과', '신경과');
    facilities.push('CT', 'MRI', '혈관조영술');
    conditions.push('뇌졸중 의심');
    reasoning = '뇌졸중 의심 증상으로 발병 4.5시간 이내 혈전용해술 고려 필요';
  } else if (t.includes('교통사고') || t.includes('추락') || (t.includes('외상') && (t.includes('다발') || t.includes('중증')))) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('정형외과', '일반외과', '신경외과');
    facilities.push('CT', '응급수술실', '외상소생실');
    conditions.push('다발성 외상');
    reasoning = '다발성 외상으로 전신 CT 및 외상팀 활성화 필요';
  } else if (t.includes('호흡곤란') || t.includes('호흡 곤란') || t.includes('숨을 못') || t.includes('산소포화도 저하')) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('흉부외과');
    facilities.push('CT');
    conditions.push('급성 호흡부전');
    reasoning = '급성 호흡곤란으로 기도 확보 및 산소 공급 긴급 필요';
  } else if (t.includes('임신') || t.includes('산모') || t.includes('출산') || t.includes('분만') || t.includes('태아')) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('산부인과');
    facilities.push('응급수술실', '신생아집중치료실');
    conditions.push('산과 응급');
    reasoning = '산과 응급 상황으로 즉각적 산부인과 평가 필요';
    if (t.includes('출혈') || t.includes('피')) {
      conditions.push('산과 출혈');
      reasoning = '산과 출혈로 긴급 수혈 및 수술적 처치 필요 가능';
    }
  } else if (t.includes('출혈') || t.includes('피가') || t.includes('피를')) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('일반외과');
    facilities.push('응급수술실');
    conditions.push('출혈');
    reasoning = '활동성 출혈로 지혈 및 수술적 처치 필요 가능';
  } else if (t.includes('경련') || t.includes('발작') || t.includes('간질')) {
    ktasLevel = 2; ktasLabel = '긴급';
    specialties.push('신경과', '신경외과');
    facilities.push('CT', 'MRI');
    conditions.push('경련/발작');
    reasoning = '경련 발작으로 원인 감별 및 항경련제 투여 필요';
  } else if (t.includes('중독') || t.includes('약물 과다') || t.includes('음독')) {
    ktasLevel = 2; ktasLabel = '긴급';
    conditions.push('급성 중독');
    reasoning = '중독 증상으로 해독제 투여 및 집중 모니터링 필요';
  }
  // ── KTAS 3: Urgent ──
  else if (t.includes('골절') || t.includes('부러') || t.includes('뼈')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('정형외과');
    facilities.push('CT');
    conditions.push('골절');
    reasoning = '골절 의심으로 영상 검사 및 정형외과 진료 필요';
    if (t.includes('개방') || t.includes('복합')) {
      ktasLevel = 2; ktasLabel = '긴급';
      facilities.push('응급수술실');
      conditions.push('개방성 골절');
      reasoning = '개방성 골절로 감염 방지 및 긴급 수술 필요';
    }
  } else if (t.includes('복통') || t.includes('배 아') || t.includes('배아') || t.includes('복부 통증') || t.includes('복부통증')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('일반외과');
    facilities.push('CT');
    conditions.push('급성복증');
    reasoning = '급성복증으로 충수돌기염, 장폐색 등 감별 필요';
    if (t.includes('경직') || t.includes('반발통')) {
      ktasLevel = 2; ktasLabel = '긴급';
      facilities.push('응급수술실');
      conditions.push('복막염 의심');
      reasoning = '복부 경직 동반으로 복막염 의심, 긴급 수술 필요 가능';
    }
  } else if (t.includes('화상')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('성형외과');
    facilities.push('화상치료실');
    conditions.push('화상');
    reasoning = '화상으로 전문 화상치료 필요';
    if (t.includes('3도') || t.includes('전신') || t.includes('기도')) {
      ktasLevel = 2; ktasLabel = '긴급';
      conditions.push('중증 화상');
      reasoning = '중증 화상으로 기도 확보 및 전문 화상센터 이송 필요';
    }
  } else if (t.includes('소아') || t.includes('아이') || t.includes('영아') || t.includes('신생아')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('소아청소년과');
    conditions.push('소아 응급');
    reasoning = '소아 환자로 전문 소아과 진료 필요';
    if (t.includes('신생아') || t.includes('영아')) {
      facilities.push('신생아집중치료실');
    }
  } else if (t.includes('발열') || t.includes('열') || t.includes('고열')) {
    ktasLevel = 3; ktasLabel = '응급';
    conditions.push('고열');
    reasoning = '고열로 감염원 확인 및 해열 처치 필요';
    if (t.includes('면역저하') || t.includes('패혈') || t.includes('오한')) {
      ktasLevel = 2; ktasLabel = '긴급';
      conditions.push('패혈증 의심');
      reasoning = '고열과 전신 증상으로 패혈증 의심, 긴급 항생제 투여 필요';
    }
  } else if (t.includes('열상') || t.includes('찢어') || t.includes('찔림') || t.includes('자상')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('일반외과');
    conditions.push('열상/자상');
    reasoning = '열상으로 봉합 및 감염 방지 처치 필요';
  } else if (t.includes('두통') || t.includes('어지러')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('신경과');
    facilities.push('CT');
    conditions.push('두통/어지럼증');
    reasoning = '두통으로 뇌출혈 등 위험 원인 감별 필요';
  } else if (t.includes('눈') || t.includes('시력') || t.includes('안구')) {
    ktasLevel = 3; ktasLabel = '응급';
    specialties.push('안과');
    conditions.push('안과 응급');
    reasoning = '안과 응급으로 전문 진료 필요';
  }
  // ── KTAS 4: Less Urgent ──
  else if (t.includes('타박') || t.includes('멍') || t.includes('염좌') || t.includes('삐')) {
    ktasLevel = 4; ktasLabel = '준응급';
    specialties.push('정형외과');
    conditions.push('타박상/염좌');
    reasoning = '경미한 근골격계 손상으로 대기 가능';
  } else if (t.includes('알레르기') || t.includes('두드러기')) {
    ktasLevel = 4; ktasLabel = '준응급';
    conditions.push('알레르기 반응');
    reasoning = '알레르기 반응으로 항히스타민제 투여 필요';
    if (t.includes('아나필') || t.includes('목 부음') || t.includes('기도')) {
      ktasLevel = 2; ktasLabel = '긴급';
      conditions.push('아나필락시스');
      reasoning = '아나필락시스 의심으로 에피네프린 투여 및 기도 관리 긴급';
    }
  }
  // ── KTAS 5: Non-Urgent ──
  else if (t.includes('감기') || t.includes('콧물') || t.includes('기침')) {
    ktasLevel = 5; ktasLabel = '비응급';
    conditions.push('상기도 감염');
    reasoning = '경미한 상기도 감염 증상';
  } else {
    // Default
    conditions.push('증상 확인 필요');
    reasoning = '입력된 증상에 대한 추가 평가 필요';
  }

  // Vitals-based severity adjustment
  if (spo2 && spo2 < 90 && ktasLevel > 2) {
    ktasLevel = 2; ktasLabel = '긴급';
    reasoning += ` (SpO2 ${spo2}% 저하 → 긴급도 상향)`;
  }
  if (hr && (hr > 130 || hr < 50) && ktasLevel > 2) {
    ktasLevel = 2; ktasLabel = '긴급';
    reasoning += ` (HR ${hr} 이상 → 긴급도 상향)`;
  }
  if (bpSys && bpSys < 90 && ktasLevel > 2) {
    ktasLevel = 1; ktasLabel = '소생';
    conditions.push('쇼크 의심');
    reasoning += ` (수축기 혈압 ${bpSys}mmHg → 쇼크 의심)`;
  }
  if (painOnly && ktasLevel > 2) {
    ktasLevel = 2; ktasLabel = '긴급';
    reasoning += ' (의식수준 저하 → 긴급도 상향)';
  }
  if (unconscious && ktasLevel > 1) {
    ktasLevel = 1; ktasLabel = '소생';
    reasoning += ' (무반응 → 소생 등급)';
  }

  return {
    ktasLevel,
    ktasLabel,
    requiredSpecialties: Array.from(new Set(specialties)),
    requiredFacilities: Array.from(new Set(facilities)),
    suspectedConditions: conditions.length > 0 ? conditions : ['증상 확인 필요'],
    reasoning: reasoning || '입력된 증상에 대한 키워드 기반 분석',
  };
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: '증상 텍스트가 필요합니다.' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallbackAnalysis(text));
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `환자 증상: ${text}` }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const cleaned = content.text.replace(/```json\n?|\n?```/g, '').trim();
    const analysis: SymptomAnalysis = JSON.parse(cleaned);
    return NextResponse.json(analysis);
  } catch (e) {
    console.error('Claude API error, using fallback:', e);
    return NextResponse.json(fallbackAnalysis(text));
  }
}
