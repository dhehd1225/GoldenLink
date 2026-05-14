'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SymptomAnalysis, KTAS_INFO, KTASLevel, PatientInfo, DEFAULT_PATIENT_INFO, CONSCIOUSNESS_LABELS } from '@/lib/types';
import { getDemoScenario, DemoScenario } from '@/lib/demo-scenarios';
import { FieldGuideResponse } from '@/app/api/field-guide/route';

const QUICK_SYMPTOMS = [
  { label: '흉통', icon: 'heart', text: '흉통, 가슴 압박감, 호흡곤란' },
  { label: '교통사고', icon: 'car', text: '교통사고, 다발성 외상' },
  { label: '뇌졸중', icon: 'brain', text: '편측 마비, 언어장애, 두통' },
  { label: '호흡곤란', icon: 'lung', text: '호흡곤란, 산소포화도 저하' },
  { label: '의식저하', icon: 'alert', text: '의식저하, 반응 없음' },
  { label: '복부 통증', icon: 'stomach', text: '심한 복통, 복부 경직' },
  { label: '출혈', icon: 'blood', text: '대량 출혈, 지혈 곤란' },
  { label: '화상', icon: 'burn', text: '화상, 피부 손상' },
];

const QUICK_ICONS: Record<string, React.ReactNode> = {
  heart: <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />,
  car: <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />,
  brain: <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />,
  lung: <path d="M12 4c0-.55-.45-1-1-1s-1 .45-1 1v3.17L7.83 5 6.41 6.41 10 10.01V20c0 .55.45 1 1 1s1-.45 1-1v-9.99l3.59-3.6L14.17 5 12 7.17V4zm6 8c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zM8 14c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />,
  alert: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />,
  stomach: <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />,
  blood: <path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z" />,
  burn: <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />,
};

const AVPU_VISIBLE: Array<Exclude<PatientInfo['consciousnessLevel'], 'unset'>> = ['alert', 'verbal', 'pain', 'unresponsive'];

// AI 분석 중 사용자에게 진행 단계를 시각적으로 보여주는 메시지 (8초 분석 동안 cycling)
const ANALYSIS_STEPS = [
  '환자 정보 정리 중...',
  'AI가 KTAS 등급 분석 중...',
  '의심 질환·진료과 도출 중...',
  '결과 정리 중...',
];

export default function ParamedicInputPage() {
  const router = useRouter();
  const [demoId, setDemoId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [selectedQuickSymptoms, setSelectedQuickSymptoms] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [error, setError] = useState('');
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({ ...DEFAULT_PATIENT_INFO });
  const [demoStep, setDemoStep] = useState<string>('');
  const [demoStage, setDemoStage] = useState(0); // 1-6 시연 진행 단계 (전체 흐름의 1-3은 입력 페이지)
  const [isParsing, setIsParsing] = useState(false);
  const [autoFilledAt, setAutoFilledAt] = useState<number | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [fieldGuide, setFieldGuide] = useState<FieldGuideResponse | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const demoStartedRef = useRef(false);
  const accumulatedRef = useRef('');

  const parseAndFill = useCallback(async (rawText: string) => {
    if (rawText.trim().length < 4) return;
    setIsParsing(true);
    try {
      const res = await fetch('/api/parse-patient-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });
      if (!res.ok) throw new Error('parse failed');
      const { patientInfo: parsed, symptomsText: parsedSymptoms } = await res.json() as {
        patientInfo: PatientInfo; symptomsText: string;
      };
      setPatientInfo(prev => ({ ...prev, ...parsed }));
      setText(parsedSymptoms || rawText);
      setShowPatientInfo(true);
      setAutoFilledAt(Date.now());
    } catch {
      // 파싱 실패해도 원본 텍스트는 그대로 유지
    } finally {
      setIsParsing(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('이 브라우저는 음성 입력을 지원하지 않습니다. Chrome, Edge, Safari를 사용해 주세요.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    accumulatedRef.current = '';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalTranscript += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalTranscript) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalTranscript;
        setText(prev => prev + (prev ? ' ' : '') + finalTranscript);
        setAnalysis(null);
      }
      setInterimText(interim);
    };
    recognition.onerror = (event: Event & { error?: string }) => {
      setIsRecording(false);
      setInterimText('');
      const errType = event.error;
      if (errType === 'not-allowed') {
        setError('마이크 권한이 거부되었습니다.');
        setShowPermissionGuide(true);
      } else if (errType === 'no-speech') {
        setError('음성이 감지되지 않았습니다. 다시 시도해 주세요.');
      } else if (errType === 'network') {
        setError('네트워크 오류입니다. 연결 상태를 확인해 주세요.');
      } else if (errType === 'audio-capture') {
        setError('마이크를 찾을 수 없습니다. 마이크 연결을 확인해 주세요.');
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
      const accumulated = accumulatedRef.current;
      accumulatedRef.current = '';
      if (accumulated.trim()) parseAndFill(accumulated);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setError('');
    setShowPermissionGuide(false);
  }, [parseAndFill]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  useEffect(() => {
    if (!autoFilledAt) return;
    const t = setTimeout(() => setAutoFilledAt(null), 12000);
    return () => clearTimeout(t);
  }, [autoFilledAt]);

  // AI 분석 중 메시지 cycling (8초 호출 동안 사용자에게 시각적 피드백)
  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisStep(0);
      return;
    }
    const interval = setInterval(() => {
      setAnalysisStep(s => Math.min(s + 1, ANALYSIS_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // 분석 완료 시 자동으로 현장 처치 가이드 호출
  useEffect(() => {
    if (!analysis) { setFieldGuide(null); return; }
    let cancelled = false;
    setIsLoadingGuide(true);
    fetch('/api/field-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis, patientInfo }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setFieldGuide(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoadingGuide(false); });
    return () => { cancelled = true; };
  }, [analysis, patientInfo]);

  const runDemoSequence = useCallback(async (scenario: DemoScenario) => {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    setDemoStep('환자 정보 자동 입력 중...');
    setDemoStage(1);
    setShowPatientInfo(true);
    await sleep(600);
    setPatientInfo(scenario.patientInfo);
    await sleep(1100);

    setDemoStep('빠른 증상 칩 선택');
    setDemoStage(2);
    setSelectedQuickSymptoms(new Set(scenario.quickSymptoms));
    await sleep(800);

    setDemoStep('현장 증상 입력 (음성 인식 시뮬레이션)');
    for (let i = 0; i <= scenario.symptomsText.length; i++) {
      setText(scenario.symptomsText.slice(0, i));
      await sleep(35);
    }
    await sleep(700);

    setDemoStep('AI 증상 분석 중...');
    setDemoStage(3);
    setIsAnalyzing(true);
    setError('');

    const chipsText = scenario.quickSymptoms
      .map(label => QUICK_SYMPTOMS.find(q => q.label === label)?.text || '')
      .filter(Boolean)
      .join(', ');
    const symptomsCombined = [chipsText, scenario.symptomsText].filter(Boolean).join(', ');

    let prompt = symptomsCombined;
    const p = scenario.patientInfo;
    if (p.age) {
      const g = p.gender === 'male' ? '남성' : p.gender === 'female' ? '여성' : '';
      prompt = `${p.age}세${g ? ` ${g}` : ''}, ${prompt}`;
    }
    if (p.consciousnessLevel !== 'alert' && p.consciousnessLevel !== 'unset') {
      prompt += `, 의식수준: ${CONSCIOUSNESS_LABELS[p.consciousnessLevel].label}`;
    }
    if (p.oxygenSaturation) prompt += `, SpO2: ${p.oxygenSaturation}%`;
    if (p.heartRate) prompt += `, HR: ${p.heartRate}`;
    if (p.respiratoryRate) prompt += `, RR: ${p.respiratoryRate}`;
    if (p.bloodPressureSystolic && p.bloodPressureDiastolic) {
      prompt += `, BP: ${p.bloodPressureSystolic}/${p.bloodPressureDiastolic}`;
    }
    if (p.temperature) prompt += `, BT: ${p.temperature}°C`;

    try {
      const res = await fetch('/api/analyze-symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt }),
      });
      const result: SymptomAnalysis = await res.json();
      setAnalysis(result);
      setIsAnalyzing(false);
      setDemoStep('KTAS 분류 완료 → 병원 매칭으로 이동');
      setDemoStage(4);
      await sleep(2200);

      sessionStorage.setItem('goldenlink_analysis', JSON.stringify(result));
      sessionStorage.setItem('goldenlink_symptoms_text', symptomsCombined);
      sessionStorage.setItem('goldenlink_patient_info', JSON.stringify(scenario.patientInfo));
      router.push(`/paramedic/result?demo=${scenario.id}`);
    } catch {
      setIsAnalyzing(false);
      setError('데모 분석에 실패했습니다.');
      setDemoStep('');
    }
  }, [router]);

  useEffect(() => {
    if (demoStartedRef.current) return;
    const id = new URLSearchParams(window.location.search).get('demo');
    if (!id) return;
    const scenario = getDemoScenario(id);
    if (!scenario) return;
    demoStartedRef.current = true;
    setDemoId(id);
    runDemoSequence(scenario);
  }, [runDemoSequence]);

  const toggleQuickSymptom = (label: string) => {
    setSelectedQuickSymptoms(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    setAnalysis(null);
  };

  const updatePatient = <K extends keyof PatientInfo>(field: K, value: PatientInfo[K]) => {
    setPatientInfo(prev => ({ ...prev, [field]: value }));
  };

  const buildSymptomsText = () => {
    const chipsText = QUICK_SYMPTOMS
      .filter(s => selectedQuickSymptoms.has(s.label))
      .map(s => s.text)
      .join(', ');
    const userText = text.trim();
    return [chipsText, userText].filter(Boolean).join(', ');
  };

  // 환자 정보 + 증상을 AI에 보낼 최종 프롬프트로 결합 (미리보기 + analyzeSymptoms 공통)
  const buildFullPrompt = () => {
    let prompt = buildSymptomsText();
    if (!prompt) return '';
    if (patientInfo.age) {
      const g = patientInfo.gender === 'male' ? '남성' : patientInfo.gender === 'female' ? '여성' : '';
      prompt = `${patientInfo.age}세${g ? ` ${g}` : ''}, ${prompt}`;
    }
    if (patientInfo.consciousnessLevel !== 'alert' && patientInfo.consciousnessLevel !== 'unset') {
      prompt += `, 의식수준: ${CONSCIOUSNESS_LABELS[patientInfo.consciousnessLevel].label}`;
    }
    if (patientInfo.oxygenSaturation) prompt += `, SpO2: ${patientInfo.oxygenSaturation}%`;
    if (patientInfo.heartRate) prompt += `, HR: ${patientInfo.heartRate}`;
    if (patientInfo.respiratoryRate) prompt += `, RR: ${patientInfo.respiratoryRate}`;
    if (patientInfo.bloodPressureSystolic && patientInfo.bloodPressureDiastolic) {
      prompt += `, BP: ${patientInfo.bloodPressureSystolic}/${patientInfo.bloodPressureDiastolic}`;
    }
    if (patientInfo.temperature) prompt += `, BT: ${patientInfo.temperature}°C`;
    if (patientInfo.allergies && patientInfo.allergies !== '없음' && patientInfo.allergies !== '확인불가') {
      prompt += `, 알레르기: ${patientInfo.allergies}`;
    }
    if (patientInfo.medications && patientInfo.medications !== '없음' && patientInfo.medications !== '확인불가') {
      prompt += `, 복용약물: ${patientInfo.medications}`;
    }
    return prompt;
  };

  const analyzeSymptoms = async () => {
    const prompt = buildFullPrompt();
    if (!prompt) { setError('증상을 입력하거나 빠른 입력을 선택해 주세요.'); return; }
    setIsAnalyzing(true);
    setError('');
    try {
      const res = await fetch('/api/analyze-symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt }),
      });
      if (!res.ok) throw new Error('분석 실패');
      setAnalysis(await res.json());
    } catch {
      setError('증상 분석에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const goToResult = () => {
    if (!analysis) return;
    sessionStorage.setItem('goldenlink_analysis', JSON.stringify(analysis));
    sessionStorage.setItem('goldenlink_symptoms_text', buildSymptomsText());
    sessionStorage.setItem('goldenlink_patient_info', JSON.stringify(patientInfo));
    router.push('/paramedic/result');
  };

  const ktas = analysis ? KTAS_INFO[analysis.ktasLevel as KTASLevel] : null;

  // 위험 신호: 환자 정보 토글 닫혀있어도 보이게
  const consciousnessLow = patientInfo.consciousnessLevel === 'pain' || patientInfo.consciousnessLevel === 'unresponsive';
  const consciousnessUnset = patientInfo.consciousnessLevel === 'unset';
  const spo2Low = patientInfo.oxygenSaturation !== null && patientInfo.oxygenSaturation < 94;
  const spo2Critical = patientInfo.oxygenSaturation !== null && patientInfo.oxygenSaturation < 90;
  const hrAbnormal = patientInfo.heartRate !== null && (patientInfo.heartRate > 130 || patientInfo.heartRate < 50);
  const bpLow = patientInfo.bloodPressureSystolic !== null && patientInfo.bloodPressureSystolic < 90;
  const hasDanger = consciousnessLow || spo2Critical || hrAbnormal || bpLow;

  const summaryParts: string[] = [];
  if (patientInfo.age) summaryParts.push(`${patientInfo.age}세`);
  if (patientInfo.gender !== 'unknown') summaryParts.push(patientInfo.gender === 'male' ? '남' : '여');
  if (patientInfo.consciousnessLevel !== 'unset' && patientInfo.consciousnessLevel !== 'alert') {
    summaryParts.push(CONSCIOUSNESS_LABELS[patientInfo.consciousnessLevel].label);
  }
  if (patientInfo.oxygenSaturation) summaryParts.push(`SpO2 ${patientInfo.oxygenSaturation}%`);
  if (patientInfo.heartRate) summaryParts.push(`HR ${patientInfo.heartRate}`);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 shadow-lg shadow-red-900/20">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push('/')} className="w-11 h-11 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center active:scale-95 transition-transform" aria-label="홈으로">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">GoldenLink</h1>
            <p className="text-red-200 text-xs">구급대원 증상 입력</p>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-3 py-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full status-live" />
            <span className="text-xs font-medium">LIVE</span>
          </div>
        </div>
      </header>

      {/* Demo Mode Banner */}
      {demoId && (
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white px-5 py-2.5">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center justify-center w-6 h-6 bg-white/20 backdrop-blur rounded-md flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </span>
                <span className="text-xs font-bold flex-shrink-0">DEMO</span>
                <span className="text-xs text-white/90 truncate">— {demoStep || '준비 중'}</span>
                {demoStage > 0 && (
                  <span className="text-[10px] text-white/70 font-bold whitespace-nowrap flex-shrink-0">{demoStage}/6</span>
                )}
              </div>
              <button onClick={() => router.push('/')} className="text-xs text-white/90 hover:text-white underline whitespace-nowrap flex-shrink-0">
                중단
              </button>
            </div>
            {demoStage > 0 && (
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3, 4, 5, 6].map(s => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                      s < demoStage ? 'bg-white' :
                      s === demoStage ? 'bg-white/80 animate-pulse' :
                      'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-4 flex flex-col gap-3 max-w-2xl mx-auto w-full pb-8">
        {/* Patient Info Toggle */}
        <button
          onClick={() => setShowPatientInfo(!showPatientInfo)}
          className={`card !p-4 flex items-center justify-between active:scale-[0.99] transition-transform ${hasDanger ? 'ring-2 ring-red-300' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${hasDanger ? 'bg-red-50' : 'bg-blue-50'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={hasDanger ? '#DC2626' : '#2563EB'}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div className="text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-gray-800 text-sm">환자 정보</p>
                {hasDanger && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md">위험</span>
                )}
                {!hasDanger && consciousnessUnset && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">의식수준 미입력</span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {summaryParts.length > 0 ? summaryParts.join(' · ') : '나이, 성별, 의식수준, 바이탈 입력'}
              </p>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#94A3B8" className={`flex-shrink-0 transition-transform ${showPatientInfo ? 'rotate-180' : ''}`}>
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>

        {/* Patient Info Form */}
        {showPatientInfo && (
          <section className="card space-y-4 animate-slide-up">
            {autoFilledAt && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#9333EA" className="flex-shrink-0 mt-0.5"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"/></svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-purple-700">음성에서 자동 추출됨</p>
                  <p className="text-[11px] text-purple-600/80 mt-0.5">잘못된 항목이 있으면 직접 수정해 주세요. 누락된 정보도 추가 가능합니다.</p>
                </div>
                <button onClick={() => setAutoFilledAt(null)} className="text-purple-400 hover:text-purple-600 flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            )}
            {/* Age & Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">나이</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={patientInfo.age || ''}
                  onChange={e => updatePatient('age', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="예: 65"
                  className="w-full mt-1 border-2 border-gray-200 rounded-xl p-3 text-lg font-bold focus:border-blue-400 focus:outline-none bg-gray-50/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">성별</label>
                <div className="flex gap-2 mt-1">
                  {(['male', 'female'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => updatePatient('gender', g)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        patientInfo.gender === g
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                    >
                      {g === 'male' ? '남성' : '여성'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Consciousness Level (AVPU) */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">의식 수준 (AVPU)</label>
                {consciousnessUnset && (
                  <span className="text-[10px] font-bold text-amber-600">평가 후 선택</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {AVPU_VISIBLE.map(level => {
                  const info = CONSCIOUSNESS_LABELS[level];
                  const isActive = patientInfo.consciousnessLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => updatePatient('consciousnessLevel', level)}
                      className={`py-2.5 rounded-xl text-xs font-bold leading-tight transition-all border-2 ${
                        isActive ? 'shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                      style={isActive ? { backgroundColor: `${info.color}15`, borderColor: info.color, color: info.color } : {}}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vitals */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">바이탈 사인</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className={`flex items-center gap-1 rounded-xl p-2.5 ${bpLow ? 'bg-red-50 ring-1 ring-red-200' : 'bg-gray-50'}`}>
                  <span className="text-xs font-bold text-red-500 w-8">BP</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={patientInfo.bloodPressureSystolic || ''}
                    onChange={e => updatePatient('bloodPressureSystolic', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="수축기"
                    aria-label="수축기 혈압"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none min-w-0"
                  />
                  <span className="text-gray-400 text-base font-bold px-0.5">/</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={patientInfo.bloodPressureDiastolic || ''}
                    onChange={e => updatePatient('bloodPressureDiastolic', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="이완기"
                    aria-label="이완기 혈압"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none min-w-0"
                  />
                </div>
                <div className={`flex items-center gap-2 rounded-xl p-2.5 ${hrAbnormal ? 'bg-red-50 ring-1 ring-red-200' : 'bg-gray-50'}`}>
                  <span className="text-xs font-bold text-pink-500 w-10">HR</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={patientInfo.heartRate || ''}
                    onChange={e => updatePatient('heartRate', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="심박"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none min-w-0"
                  />
                  <span className="text-xs text-gray-400">bpm</span>
                </div>
                <div className={`flex items-center gap-2 rounded-xl p-2.5 ${spo2Low ? (spo2Critical ? 'bg-red-50 ring-1 ring-red-200' : 'bg-amber-50 ring-1 ring-amber-200') : 'bg-gray-50'}`}>
                  <span className="text-xs font-bold text-blue-500 w-10">SpO2</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={patientInfo.oxygenSaturation || ''}
                    onChange={e => updatePatient('oxygenSaturation', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="포화"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none min-w-0"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                  <span className="text-xs font-bold text-emerald-500 w-10">RR</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={patientInfo.respiratoryRate || ''}
                    onChange={e => updatePatient('respiratoryRate', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="호흡"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none min-w-0"
                  />
                  <span className="text-xs text-gray-400">/분</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5 col-span-2">
                  <span className="text-xs font-bold text-orange-500 w-10">BT</span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={patientInfo.temperature || ''}
                    onChange={e => updatePatient('temperature', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="체온"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none min-w-0"
                  />
                  <span className="text-xs text-gray-400">°C</span>
                </div>
              </div>
            </div>

            {/* Allergies & Medications */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">알레르기</label>
                <input
                  type="text"
                  value={patientInfo.allergies}
                  onChange={e => updatePatient('allergies', e.target.value)}
                  placeholder="없음 / 약물명"
                  className="w-full mt-1 border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-blue-400 focus:outline-none bg-gray-50/50"
                />
                <div className="flex gap-1 mt-1.5">
                  {['없음', '확인불가'].map(v => (
                    <button
                      key={v}
                      onClick={() => updatePatient('allergies', v)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        patientInfo.allergies === v
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 active:bg-gray-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">복용약물</label>
                <input
                  type="text"
                  value={patientInfo.medications}
                  onChange={e => updatePatient('medications', e.target.value)}
                  placeholder="없음 / 약물명"
                  className="w-full mt-1 border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-blue-400 focus:outline-none bg-gray-50/50"
                />
                <div className="flex gap-1 mt-1.5">
                  {['없음', '확인불가'].map(v => (
                    <button
                      key={v}
                      onClick={() => updatePatient('medications', v)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                        patientInfo.medications === v
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-500 active:bg-gray-50'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Voice + Quick Input Combined */}
        <section className="card">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative rounded-full flex-shrink-0 flex items-center justify-center text-white transition-all w-[72px] h-[72px]
                ${isRecording ? 'bg-red-600 shadow-xl shadow-red-600/40' : 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-lg active:shadow-md active:scale-95'}`}
              aria-label={isRecording ? '음성 입력 중지' : '음성 입력 시작'}
            >
              {isRecording ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              ) : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
              {isRecording && <span className="recording-pulse absolute inset-0 rounded-full" />}
            </button>
            <div className="flex-1">
              <p className="font-bold text-base text-gray-800">
                {isParsing ? 'AI가 환자정보 추출 중...' : isRecording ? '듣고 있습니다...' : '음성으로 한번에 입력'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isParsing ? '잠시만 기다려 주세요' :
                 isRecording ? '버튼을 다시 탭하면 종료 + 자동 추출' :
                 '환자정보 + 증상을 한 번에 말하면 자동 분류'}
              </p>
            </div>
            {isParsing && (
              <svg className="animate-spin h-5 w-5 text-purple-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            )}
          </div>

          {/* Live interim transcript */}
          {isRecording && interimText && (
            <div className="mb-3 px-3 py-2 bg-red-50/50 border border-red-100 rounded-xl text-sm text-gray-500 italic">
              <span className="text-red-500 font-bold not-italic mr-1">●</span>
              {interimText}
            </div>
          )}

          {/* Voice example hint */}
          {!isRecording && !isParsing && (
            <div className="mb-3 px-3 py-2 bg-purple-50/50 border border-purple-100 rounded-xl">
              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-0.5">예시 발화</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                &ldquo;65세 남자, 의식 흐림, 혈압 145에 90, 심박 110, 산소포화도 94, 가슴 통증 호소&rdquo;
              </p>
            </div>
          )}

          {/* Quick symptom chips */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">빠른 입력 (탭하여 추가/제거)</p>
              {selectedQuickSymptoms.size > 0 && (
                <button
                  onClick={() => { setSelectedQuickSymptoms(new Set()); setAnalysis(null); }}
                  className="text-[10px] font-semibold text-gray-400 hover:text-red-500"
                >
                  모두 해제
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SYMPTOMS.map(s => {
                const active = selectedQuickSymptoms.has(s.label);
                return (
                  <button
                    key={s.label}
                    onClick={() => toggleQuickSymptom(s.label)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                      active
                        ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/30'
                        : 'bg-red-50 text-red-700 border-red-100 active:bg-red-100'
                    }`}
                    aria-pressed={active}
                  >
                    {active ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">{QUICK_ICONS[s.icon]}</svg>
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text area */}
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setAnalysis(null); }}
            placeholder="추가 증상을 직접 입력하거나 음성 입력. 예: 의식 흐림, 식은땀..."
            className="w-full border-2 border-gray-200 rounded-2xl p-4 text-base min-h-[90px] focus:border-red-400 focus:outline-none resize-none bg-gray-50/50 placeholder:text-gray-300"
          />
          {(text || selectedQuickSymptoms.size > 0) && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-300">
                {selectedQuickSymptoms.size > 0 && `칩 ${selectedQuickSymptoms.size}개`}
                {selectedQuickSymptoms.size > 0 && text && ' · '}
                {text && `${text.length}자`}
              </span>
              <button
                onClick={() => { setText(''); setSelectedQuickSymptoms(new Set()); setAnalysis(null); }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                초기화
              </button>
            </div>
          )}

          {/* AI에 보낼 내용 미리보기 — 투명성 */}
          {buildFullPrompt() && !isAnalyzing && (
            <details className="mt-2 group">
              <summary className="text-[10px] font-bold text-purple-500 uppercase tracking-wider cursor-pointer hover:text-purple-700 transition-colors inline-flex items-center gap-1 select-none">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"/></svg>
                AI에 보낼 내용 미리보기
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="group-open:rotate-180 transition-transform"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
              </summary>
              <p className="mt-2 px-3 py-2 bg-purple-50/40 border border-purple-100/50 rounded-xl text-[11px] text-gray-700 leading-relaxed">
                <span className="text-purple-600 font-bold mr-1">→</span>{buildFullPrompt()}
              </p>
            </details>
          )}

          {/* Analyze button */}
          <button
            onClick={analyzeSymptoms}
            disabled={(!text.trim() && selectedQuickSymptoms.size === 0) || isAnalyzing}
            className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span className="transition-opacity duration-300">{ANALYSIS_STEPS[analysisStep]}</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                AI 증상 분석
              </>
            )}
          </button>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-medium flex items-start gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <div className="flex-1">
              <p>{error}</p>
              {showPermissionGuide && (
                <p className="text-xs text-red-600/80 mt-2 leading-relaxed">
                  <strong>권한 다시 허용하기:</strong><br />
                  · Chrome/Edge: 주소창 왼쪽 자물쇠 → 사이트 설정 → 마이크 허용<br />
                  · Safari (iOS): 설정 → Safari → 마이크 → 허용<br />
                  · Android: 설정 → 앱 → 브라우저 → 권한 → 마이크 허용
                </p>
              )}
            </div>
          </div>
        )}

        {/* Analysis Result */}
        {analysis && ktas && (
          <section
            className="relative overflow-hidden rounded-3xl shadow-xl animate-slide-up"
            style={{
              background: `linear-gradient(135deg, ${ktas.bg} 0%, white 60%)`,
              borderTop: `4px solid ${ktas.color}`,
            }}
          >
            {/* AI 배지 */}
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-purple-600">
                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"/>
              </svg>
              <span className="text-[10px] font-bold text-purple-700 tracking-wider">AI 분석</span>
            </div>

            <div className="p-5">
              {/* KTAS Hero */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-shrink-0">
                  {analysis.ktasLevel <= 2 && (
                    <span className="absolute inset-0 rounded-3xl animate-ping opacity-40" style={{ backgroundColor: ktas.color }} />
                  )}
                  <div
                    className="relative w-20 h-20 rounded-3xl flex flex-col items-center justify-center shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${ktas.color}, ${ktas.color}cc)` }}
                  >
                    <span className="text-4xl font-black text-white leading-none">{analysis.ktasLevel}</span>
                    <span className="text-[9px] font-bold text-white/90 mt-1 tracking-wider">KTAS</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">응급도 분류</p>
                  <p className="text-3xl font-black leading-tight" style={{ color: ktas.color }}>{ktas.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{ktas.description}</p>
                </div>
              </div>

              {/* 의심 질환 — 메인 강조 */}
              {analysis.suspectedConditions.length > 0 && (
                <div className="bg-white/90 backdrop-blur rounded-2xl p-3.5 mb-2.5 shadow-sm border border-gray-100/80">
                  <div className="flex items-center gap-1.5 mb-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400"><path d="M19 8h-1.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H5v2h1.09c-.05.33-.09.66-.09 1v1H5v2h1v1c0 .34.04.67.09 1H5v2h1.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H19v-2h-1.09c.05-.33.09-.66.09-1v-1h1v-2h-1v-1c0-.34-.04-.67-.09-1H19V8zm-6 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">의심 질환</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.suspectedConditions.map(c => (
                      <span key={c} className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-800 text-sm font-bold">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* 진료과 + 시설 */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-blue-100/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">진료과</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {analysis.requiredSpecialties.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold">{s}</span>
                    ))}
                  </div>
                </div>
                {analysis.requiredFacilities.length > 0 ? (
                  <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-purple-100/60">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-purple-600"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/></svg>
                      <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">필요 시설</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.requiredFacilities.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-lg bg-purple-600 text-white text-[11px] font-bold">{f}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/40 backdrop-blur rounded-2xl p-3 border border-gray-100/60 flex items-center justify-center text-[10px] text-gray-300 italic">
                    특수 시설 불필요
                  </div>
                )}
              </div>

              {/* Reasoning — quote */}
              <div className="flex gap-2 px-1 mb-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-gray-300 flex-shrink-0 mt-0.5"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
                <p className="text-xs text-gray-600 italic leading-relaxed">{analysis.reasoning}</p>
              </div>

              {/* Find Hospital */}
              <button onClick={goToResult} className="btn-secondary w-full flex items-center justify-center gap-2 text-xl">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                병원 찾기
              </button>
            </div>
          </section>
        )}

        {/* Field Guide - 현장 처치 가이드 + 악화 위험도 */}
        {analysis && (isLoadingGuide || fieldGuide) && (
          <section className="card animate-slide-up !p-0 overflow-hidden">
            {isLoadingGuide && !fieldGuide ? (
              <div className="p-5 flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-emerald-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <span className="text-sm text-gray-500 font-medium">현장 처치 가이드 생성 중...</span>
              </div>
            ) : fieldGuide && (
              <>
                {/* 악화 위험도 바 */}
                <div className={`px-5 py-3 flex items-center justify-between ${
                  fieldGuide.riskLevel === 'critical' ? 'bg-red-600' :
                  fieldGuide.riskLevel === 'high' ? 'bg-orange-500' :
                  fieldGuide.riskLevel === 'moderate' ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <span className="text-white text-xs font-bold uppercase tracking-wider">30분 내 악화 위험도</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-2xl font-black">{fieldGuide.deteriorationRisk}%</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      fieldGuide.riskLevel === 'critical' ? 'bg-white/30 text-white' :
                      fieldGuide.riskLevel === 'high' ? 'bg-white/30 text-white' :
                      'bg-white/30 text-white'
                    }`}>
                      {fieldGuide.riskLevel === 'critical' ? '위험' :
                       fieldGuide.riskLevel === 'high' ? '높음' :
                       fieldGuide.riskLevel === 'moderate' ? '주의' : '안정'}
                    </span>
                  </div>
                </div>

                {/* 위험 요인 */}
                {fieldGuide.riskFactors.length > 0 && (
                  <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="flex flex-wrap gap-1.5">
                      {fieldGuide.riskFactors.map((f, i) => (
                        <span key={i} className="text-[11px] text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200">{f}</span>
                      ))}
                      <span className="text-[11px] text-gray-400 bg-white px-2 py-0.5 rounded-md border border-gray-200">
                        모니터링 {fieldGuide.monitoringInterval}분 간격
                      </span>
                    </div>
                  </div>
                )}

                {/* 처치 지침 */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#059669"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">이송 중 처치 가이드</p>
                  </div>
                  <ol className="space-y-2">
                    {fieldGuide.treatments.map((t, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white mt-0.5 ${
                          i === 0 ? 'bg-emerald-600' : 'bg-gray-400'
                        }`}>{i + 1}</span>
                        <span className="text-sm text-gray-800 font-medium leading-snug">{t}</span>
                      </li>
                    ))}
                  </ol>

                  {/* 금기사항 */}
                  {fieldGuide.contraindications.length > 0 && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#DC2626"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                        <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">금기사항</span>
                      </div>
                      {fieldGuide.contraindications.map((c, i) => (
                        <p key={i} className="text-xs text-red-700 font-semibold mt-1">- {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
