'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SymptomAnalysis, KTAS_INFO, KTASLevel, PatientInfo, DEFAULT_PATIENT_INFO, CONSCIOUSNESS_LABELS } from '@/lib/types';

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

export default function ParamedicInputPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [error, setError] = useState('');
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({ ...DEFAULT_PATIENT_INFO });
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('이 브라우저는 음성 입력을 지원하지 않습니다.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) setText(prev => prev + (prev ? ' ' : '') + finalTranscript);
    };
    recognition.onerror = (event: Event & { error?: string }) => {
      setIsRecording(false);
      const errType = event.error;
      if (errType === 'not-allowed') setError('마이크 권한이 거부되었습니다.');
      else if (errType === 'no-speech') setError('음성이 감지되지 않았습니다.');
      else if (errType === 'network') setError('네트워크 오류입니다.');
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setError('');
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const addQuickSymptom = (symptomText: string) => {
    setText(prev => prev ? `${prev}, ${symptomText}` : symptomText);
    setAnalysis(null);
  };

  const updatePatient = (field: keyof PatientInfo, value: unknown) => {
    setPatientInfo(prev => ({ ...prev, [field]: value }));
  };

  const analyzeSymptoms = async () => {
    if (!text.trim()) { setError('증상을 입력해주세요.'); return; }
    setIsAnalyzing(true);
    setError('');
    try {
      // Build enhanced prompt with patient info
      let prompt = text.trim();
      if (patientInfo.age) prompt = `${patientInfo.age}세 ${patientInfo.gender === 'male' ? '남성' : patientInfo.gender === 'female' ? '여성' : ''}, ${prompt}`;
      if (patientInfo.consciousnessLevel !== 'alert') prompt += `, 의식수준: ${CONSCIOUSNESS_LABELS[patientInfo.consciousnessLevel].label}`;
      if (patientInfo.oxygenSaturation) prompt += `, SpO2: ${patientInfo.oxygenSaturation}%`;
      if (patientInfo.heartRate) prompt += `, HR: ${patientInfo.heartRate}`;
      if (patientInfo.bloodPressureSystolic && patientInfo.bloodPressureDiastolic) {
        prompt += `, BP: ${patientInfo.bloodPressureSystolic}/${patientInfo.bloodPressureDiastolic}`;
      }

      const res = await fetch('/api/analyze-symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt }),
      });
      if (!res.ok) throw new Error('분석 실패');
      setAnalysis(await res.json());
    } catch {
      setError('증상 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const goToResult = () => {
    if (!analysis) return;
    sessionStorage.setItem('goldenlink_analysis', JSON.stringify(analysis));
    sessionStorage.setItem('goldenlink_symptoms_text', text);
    sessionStorage.setItem('goldenlink_patient_info', JSON.stringify(patientInfo));
    router.push('/paramedic/result');
  };

  const ktas = analysis ? KTAS_INFO[analysis.ktasLevel as KTASLevel] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 shadow-lg shadow-red-900/20">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push('/')} className="w-11 h-11 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center active:scale-95 transition-transform">
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

      <main className="flex-1 p-4 flex flex-col gap-3 max-w-2xl mx-auto w-full pb-8">
        {/* Patient Info Toggle */}
        <button
          onClick={() => setShowPatientInfo(!showPatientInfo)}
          className="card !p-4 flex items-center justify-between active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#2563EB">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-800 text-sm">환자 정보</p>
              <p className="text-xs text-gray-400">
                {patientInfo.age ? `${patientInfo.age}세` : '미입력'}
                {patientInfo.gender !== 'unknown' ? ` / ${patientInfo.gender === 'male' ? '남' : '여'}` : ''}
                {patientInfo.heartRate ? ` / HR ${patientInfo.heartRate}` : ''}
              </p>
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#94A3B8" className={`transition-transform ${showPatientInfo ? 'rotate-180' : ''}`}>
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
        </button>

        {/* Patient Info Form */}
        {showPatientInfo && (
          <section className="card space-y-4 animate-slide-up">
            {/* Age & Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">나이</label>
                <input
                  type="number"
                  value={patientInfo.age || ''}
                  onChange={e => updatePatient('age', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="세"
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
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">의식 수준 (AVPU)</label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {(Object.keys(CONSCIOUSNESS_LABELS) as Array<keyof typeof CONSCIOUSNESS_LABELS>).map(level => {
                  const info = CONSCIOUSNESS_LABELS[level];
                  const isActive = patientInfo.consciousnessLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => updatePatient('consciousnessLevel', level)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border-2 ${
                        isActive
                          ? 'shadow-sm'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                      }`}
                      style={isActive ? { backgroundColor: `${info.color}10`, borderColor: info.color, color: info.color } : {}}
                    >
                      {info.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vitals */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">바이탈 사인</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                  <span className="text-xs font-bold text-red-500 w-10">BP</span>
                  <input
                    type="number"
                    value={patientInfo.bloodPressureSystolic || ''}
                    onChange={e => updatePatient('bloodPressureSystolic', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="수축"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none"
                  />
                  <span className="text-gray-300">/</span>
                  <input
                    type="number"
                    value={patientInfo.bloodPressureDiastolic || ''}
                    onChange={e => updatePatient('bloodPressureDiastolic', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="이완"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                  <span className="text-xs font-bold text-pink-500 w-10">HR</span>
                  <input
                    type="number"
                    value={patientInfo.heartRate || ''}
                    onChange={e => updatePatient('heartRate', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="심박수"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">bpm</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                  <span className="text-xs font-bold text-blue-500 w-10">SpO2</span>
                  <input
                    type="number"
                    value={patientInfo.oxygenSaturation || ''}
                    onChange={e => updatePatient('oxygenSaturation', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="산소포화도"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                  <span className="text-xs font-bold text-orange-500 w-10">BT</span>
                  <input
                    type="number"
                    step="0.1"
                    value={patientInfo.temperature || ''}
                    onChange={e => updatePatient('temperature', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="체온"
                    className="w-full bg-transparent text-sm font-bold focus:outline-none"
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
                  placeholder="없음"
                  className="w-full mt-1 border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-blue-400 focus:outline-none bg-gray-50/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">복용약물</label>
                <input
                  type="text"
                  value={patientInfo.medications}
                  onChange={e => updatePatient('medications', e.target.value)}
                  placeholder="없음"
                  className="w-full mt-1 border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-blue-400 focus:outline-none bg-gray-50/50"
                />
              </div>
            </div>
          </section>
        )}

        {/* Voice + Quick Input Combined */}
        <section className="card">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative w-18 h-18 rounded-full flex-shrink-0 flex items-center justify-center text-white transition-all
                ${isRecording ? 'bg-red-600 shadow-xl shadow-red-600/40 w-[72px] h-[72px]' : 'bg-gradient-to-br from-gray-700 to-gray-900 shadow-lg active:shadow-md active:scale-95 w-[72px] h-[72px]'}`}
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
                {isRecording ? '듣고 있습니다...' : '음성으로 증상 입력'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isRecording ? '탭하여 중지' : '마이크를 탭하거나 아래에 직접 입력'}
              </p>
            </div>
          </div>

          {/* Quick symptom chips */}
          <div className="mb-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">빠른 입력</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SYMPTOMS.map(s => (
                <button
                  key={s.label}
                  onClick={() => addQuickSymptom(s.text)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold
                    border border-red-100 active:bg-red-100 active:scale-95 transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">{QUICK_ICONS[s.icon]}</svg>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text area */}
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setAnalysis(null); }}
            placeholder="예: 40대 남성, 의식 있음, 좌측 흉부 통증, 호흡곤란..."
            className="w-full border-2 border-gray-200 rounded-2xl p-4 text-base min-h-[90px] focus:border-red-400 focus:outline-none resize-none bg-gray-50/50 placeholder:text-gray-300"
          />
          {text && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-300">{text.length}자</span>
              <button onClick={() => { setText(''); setAnalysis(null); }} className="text-xs text-gray-400 hover:text-red-500 transition-colors">초기화</button>
            </div>
          )}

          {/* Analyze button */}
          <button
            onClick={analyzeSymptoms}
            disabled={!text.trim() || isAnalyzing}
            className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                AI 분석 중...
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
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-medium flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            {error}
          </div>
        )}

        {/* Analysis Result */}
        {analysis && ktas && (
          <section className="card border-l-4 overflow-hidden animate-slide-up" style={{ borderLeftColor: ktas.color }}>
            {/* KTAS Header */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center animate-pulse-glow"
                style={{ backgroundColor: ktas.bg }}
              >
                <span className="text-2xl font-black" style={{ color: ktas.color }}>{analysis.ktasLevel}</span>
                <span className="text-[9px] font-bold" style={{ color: ktas.color }}>KTAS</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black" style={{ color: ktas.color }}>{ktas.label}</span>
                  <span className="badge text-xs" style={{ backgroundColor: ktas.bg, color: ktas.color }}>{analysis.ktasLevel}등급</span>
                </div>
                <p className="text-gray-500 text-sm mt-0.5">{ktas.description}</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="space-y-3">
              {analysis.suspectedConditions.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">의심 질환</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.suspectedConditions.map(c => (
                      <span key={c} className="px-2.5 py-1 rounded-xl bg-white text-gray-700 text-sm font-semibold shadow-sm">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-2xl p-3">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">필요 진료과</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.requiredSpecialties.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">{s}</span>
                    ))}
                  </div>
                </div>
                {analysis.requiredFacilities.length > 0 && (
                  <div className="bg-purple-50 rounded-2xl p-3">
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1.5">필요 시설</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.requiredFacilities.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-700 text-xs font-bold">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 px-1">{analysis.reasoning}</p>
            </div>

            {/* Find Hospital */}
            <button onClick={goToResult} className="btn-secondary w-full mt-4 flex items-center justify-center gap-2 text-xl">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              병원 찾기
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
