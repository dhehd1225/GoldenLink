'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SymptomAnalysis, MatchedHospital, KTAS_INFO, KTASLevel, Dispatch, PatientInfo, CONSCIOUSNESS_LABELS } from '@/lib/types';
import LeafletMap from '@/components/LeafletMap';
import { getDemoScenario } from '@/lib/demo-scenarios';
import { subscribeToDispatch, isSupabaseConfigured } from '@/lib/realtime';

const CONGESTION_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  low: { text: '여유', color: '#16A34A', bg: '#DCFCE7' },
  medium: { text: '보통', color: '#CA8A04', bg: '#FEF9C3' },
  high: { text: '혼잡', color: '#DC2626', bg: '#FEE2E2' },
};

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

// Haptic 햅틱 — 지원 안 되면 no-op
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
}

function CountdownTimer({ deadline, onExpired }: { deadline: string; onExpired?: () => void }) {
  const [remaining, setRemaining] = useState(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const update = () => {
      const left = Math.max(0, new Date(deadline).getTime() - Date.now());
      setRemaining(left);
      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  const isUrgent = totalSeconds < 60;
  const circumference = 2 * Math.PI * 20;
  // Assume 5 min max for progress ring
  const maxSeconds = 300;
  const progress = Math.min(totalSeconds / maxSeconds, 1);

  return (
    <div className={`flex items-center gap-3 ${isUrgent ? 'timer-urgent' : ''}`}>
      <div className="relative w-12 h-12">
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#E2E8F0" strokeWidth="3" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={isUrgent ? '#DC2626' : '#F59E0B'}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="progress-ring-circle"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-black ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>{min}:{String(sec).padStart(2, '0')}</span>
        </div>
      </div>
      <div>
        <p className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-amber-700'}`}>
          {isUrgent ? '응답 시간 초과 임박' : '병원 응답 대기 중'}
        </p>
        <p className="text-xs text-gray-400">응답 기한까지 {min}분 {sec}초</p>
      </div>
    </div>
  );
}

export default function ParamedicResultPage() {
  const router = useRouter();
  const [demoId, setDemoId] = useState<string | null>(null);
  const demoScenario = getDemoScenario(demoId);
  const demoAutoDispatchedRef = useRef(false);
  const cascadeGroupIdRef = useRef<string | null>(null);
  const cascadingRef = useRef(false);
  const [analysis, setAnalysis] = useState<SymptomAnalysis | null>(null);
  const [symptomsText, setSymptomsText] = useState('');
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [hospitals, setHospitals] = useState<MatchedHospital[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState(DEFAULT_LAT);
  const [userLng, setUserLng] = useState(DEFAULT_LNG);
  const [locationReady, setLocationReady] = useState(false);
  const fetchControllerRef = useRef<AbortController | null>(null);

  // Dispatch states
  const [dispatching, setDispatching] = useState(false);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [dispatchError, setDispatchError] = useState('');

  // Auto-cascade
  const [cascadeEnabled, setCascadeEnabled] = useState(true);
  const [cascadeIndex, setCascadeIndex] = useState(0);
  const [cascadeHistory, setCascadeHistory] = useState<Array<{ hospitalName: string; status: string; reason?: string }>>([]);

  useEffect(() => {
    setDemoId(new URLSearchParams(window.location.search).get('demo'));
  }, []);

  useEffect(() => {
    const ACTIVE_KEY = 'goldenlink_active_dispatch';

    const init = async () => {
      // 1) localStorage에 활성 dispatch가 있으면 우선 복원 (새로고침/탭 재오픈 대응)
      let restored = false;
      const storedId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;
      if (storedId) {
        try {
          const res = await fetch(`/api/dispatch/${storedId}`);
          if (res.ok) {
            const d: Dispatch = await res.json();
            const active = d.status === 'pending' || d.status === 'accepted' || d.status === 'transporting';
            if (active) {
              setDispatch(d);
              setAnalysis(d.symptoms);
              setSymptomsText(d.symptomsText);
              if (d.patientInfo) setPatientInfo(d.patientInfo);
              if (typeof d.cascadeIndex === 'number') setCascadeIndex(d.cascadeIndex);
              if (d.cascadeGroupId) cascadeGroupIdRef.current = d.cascadeGroupId;
              restored = true;
            } else {
              localStorage.removeItem(ACTIVE_KEY);
            }
          } else {
            localStorage.removeItem(ACTIVE_KEY);
          }
        } catch {
          localStorage.removeItem(ACTIVE_KEY);
        }
      }

      // 2) 복원 못 했으면 sessionStorage (정상 input → result 흐름)
      if (!restored) {
        const stored = sessionStorage.getItem('goldenlink_analysis');
        if (!stored) { router.push('/paramedic/input'); return; }
        setAnalysis(JSON.parse(stored));
        setSymptomsText(sessionStorage.getItem('goldenlink_symptoms_text') || '');
        const storedPatient = sessionStorage.getItem('goldenlink_patient_info');
        if (storedPatient) setPatientInfo(JSON.parse(storedPatient));
      }

      // 3) 위치 정보
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocationReady(true); },
          () => setLocationReady(true),
          { timeout: 5000, maximumAge: 60000 },
        );
      } else {
        setLocationReady(true);
      }
    };

    init();
  }, [router]);

  // 이송 중 실시간 GPS 추적
  useEffect(() => {
    if (!dispatch || dispatch.status !== 'transporting') return;
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [dispatch?.status]);

  // localStorage에 활성 dispatch ID 저장/제거 (새로고침/탭 재오픈 후 복원용)
  useEffect(() => {
    if (typeof window === 'undefined' || !dispatch) return;
    const ACTIVE_KEY = 'goldenlink_active_dispatch';
    if (dispatch.status === 'pending' || dispatch.status === 'accepted' || dispatch.status === 'transporting') {
      localStorage.setItem(ACTIVE_KEY, dispatch.id);
    } else {
      localStorage.removeItem(ACTIVE_KEY);
    }
  }, [dispatch]);

  // Haptic — 주요 상태 전이에 모바일 진동 피드백
  useEffect(() => {
    if (!dispatch) return;
    if (dispatch.status === 'accepted') vibrate([100, 50, 100]);
    else if (dispatch.status === 'arrived') vibrate([150, 80, 150, 80, 150]);
  }, [dispatch?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch + auto-refresh every 30s
  const fetchHospitals = useCallback(() => {
    if (!analysis || !locationReady) return;
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    fetch('/api/match-hospitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms: analysis, lat: userLat, lng: userLng }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then((data: MatchedHospital[]) => {
        if (!controller.signal.aborted) {
          setHospitals(data);
          setSelectedId(prev => prev || (data[0]?.id ?? ''));
        }
      })
      .catch(e => { if (e.name !== 'AbortError') console.error(e); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [analysis, locationReady, userLat, userLng]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  // Auto-refresh (not during dispatch)
  useEffect(() => {
    if (dispatch) return;
    const interval = setInterval(fetchHospitals, 30000);
    return () => clearInterval(interval);
  }, [fetchHospitals, dispatch]);

  // Realtime push (env 없으면 2초 폴링 fallback)
  useEffect(() => {
    if (!dispatch || dispatch.status === 'accepted' || dispatch.status === 'rejected' || dispatch.status === 'cancelled') return;

    const checkUpdate = async () => {
      try {
        const res = await fetch(`/api/dispatch/${dispatch.id}`);
        if (!res.ok) return;
        const updated: Dispatch = await res.json();
        setDispatch(updated);
        if (updated.status === 'rejected' && cascadeEnabled) {
          handleCascadeReject(updated);
        }
      } catch { /* ignore */ }
    };

    if (isSupabaseConfigured()) {
      return subscribeToDispatch(dispatch.id, checkUpdate);
    }
    const interval = setInterval(checkUpdate, 2000);
    return () => clearInterval(interval);
  }, [dispatch?.id, dispatch?.status, cascadeEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCascadeReject = (rejected: Dispatch) => {
    if (cascadingRef.current) return; // deadline 만료와 동시 발화 방어
    cascadingRef.current = true;
    setCascadeHistory(prev => [...prev, {
      hospitalName: rejected.hospitalName,
      status: 'rejected',
      reason: rejected.rejectReason,
    }]);

    const nextIndex = cascadeIndex + 1;
    if (nextIndex < Math.min(hospitals.length, 5)) {
      setCascadeIndex(nextIndex);
      const nextHospital = hospitals[nextIndex];
      setSelectedId(nextHospital.id);
      setTimeout(() => {
        dispatchToHospital(nextHospital, nextIndex);
      }, 1500);
    } else {
      cascadingRef.current = false; // 더 시도할 병원 없음
    }
  };

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

  // Demo auto-dispatch: when matching loads, fire first request automatically
  useEffect(() => {
    if (!demoScenario) return;
    if (loading || hospitals.length === 0) return;
    if (dispatch || dispatching) return;
    if (demoAutoDispatchedRef.current) return;
    demoAutoDispatchedRef.current = true;
    cascadeGroupIdRef.current = crypto.randomUUID();
    const t = setTimeout(() => {
      const first = hospitals[0];
      if (first) {
        setSelectedId(first.id);
        setCascadeIndex(0);
        dispatchToHospital(first, 0);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [demoScenario, loading, hospitals, dispatch, dispatching]); // eslint-disable-line react-hooks/exhaustive-deps

  // Demo auto-response: simulate hospital reject/accept based on scenario
  useEffect(() => {
    if (!demoScenario || !dispatch || dispatch.status !== 'pending') return;
    const isFirst = cascadeIndex === 0;
    const shouldReject = isFirst && demoScenario.rejectAfterMs > 0;
    const delay = shouldReject ? demoScenario.rejectAfterMs : demoScenario.acceptAfterMs;
    const timer = setTimeout(async () => {
      const body = shouldReject
        ? { status: 'rejected' as const, rejectReason: '응급 병상 부족 (시연)' }
        : { status: 'accepted' as const };
      try {
        await fetch(`/api/dispatch/${dispatch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch { /* ignore */ }
    }, delay);
    return () => clearTimeout(timer);
  }, [dispatch?.id, dispatch?.status, demoScenario, cascadeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const dispatchToHospital = async (hospital: MatchedHospital, idx: number) => {
    if (!analysis) return;
    setDispatching(true);
    setDispatchError('');
    setDispatch(null);
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          symptoms: analysis,
          symptomsText,
          estimatedTime: hospital.estimatedTime,
          distance: hospital.distance,
          patientInfo,
          cascadeIndex: idx,
          cascadeGroupId: cascadeGroupIdRef.current ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDispatchError(data.error || '이송 요청에 실패했습니다.');
        // 병상 부족 등 서버 거절 → 다음 병원으로 cascade chain 계속
        if (cascadeEnabled && idx < Math.min(hospitals.length, 5) - 1) {
          setCascadeHistory(prev => [...prev, { hospitalName: hospital.name, status: 'failed', reason: data.error }]);
          const nextIdx = idx + 1;
          setCascadeIndex(nextIdx);
          setSelectedId(hospitals[nextIdx].id);
          setTimeout(() => dispatchToHospital(hospitals[nextIdx], nextIdx), 1000);
        } else {
          cascadingRef.current = false; // 더 시도할 곳 없음
        }
      } else {
        setDispatch(data);
        cascadingRef.current = false; // 새 dispatch 정착 → 다음 cascade 허용
      }
    } catch {
      setDispatchError('네트워크 오류입니다.');
      cascadingRef.current = false;
    } finally {
      setDispatching(false);
    }
  };

  const requestDispatch = async () => {
    const selected = hospitals.find(h => h.id === selectedId);
    if (!selected || !analysis) return;
    const idx = hospitals.findIndex(h => h.id === selectedId);
    setCascadeIndex(idx);
    setCascadeHistory([]);
    cascadeGroupIdRef.current = crypto.randomUUID();
    cascadingRef.current = false;
    dispatchToHospital(selected, idx);
  };

  const handleDeadlineExpired = useCallback(() => {
    if (!dispatch || dispatch.status !== 'pending' || !cascadeEnabled) return;
    if (cascadingRef.current) return; // 거절 응답과 동시 발화 방어
    cascadingRef.current = true;

    // 1) 만료된 dispatch를 'cancelled'로 마크 — 병원이 늦게 reject 보내도 race 차단
    fetch(`/api/dispatch/${dispatch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', rejectReason: '응답 시간 초과' }),
    }).catch(() => {});

    // 2) 캐스케이드 진행
    setCascadeHistory(prev => [...prev, {
      hospitalName: dispatch.hospitalName,
      status: 'timeout',
    }]);
    const nextIndex = cascadeIndex + 1;
    if (nextIndex < Math.min(hospitals.length, 5)) {
      setCascadeIndex(nextIndex);
      const nextHospital = hospitals[nextIndex];
      setSelectedId(nextHospital.id);
      setTimeout(() => {
        dispatchToHospital(nextHospital, nextIndex);
      }, 1000);
    } else {
      cascadingRef.current = false;
    }
  }, [dispatch, cascadeEnabled, cascadeIndex, hospitals]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDispatchStatus = useCallback(async (status: 'transporting' | 'arrived') => {
    if (!dispatch) return;
    try {
      const res = await fetch(`/api/dispatch/${dispatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) setDispatch(await res.json());
    } catch { /* ignore */ }
  }, [dispatch]);

  const startTransport = (h: MatchedHospital) => {
    // Update UI immediately (don't wait for server)
    if (dispatch) {
      setDispatch({ ...dispatch, status: 'transporting', updatedAt: new Date().toISOString() });
    }
    setSelectedId(h.id);
    document.getElementById('route-map')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Then sync to server (best-effort)
    updateDispatchStatus('transporting');
  };

  const finishAndGoHome = () => {
    sessionStorage.removeItem('goldenlink_analysis');
    sessionStorage.removeItem('goldenlink_symptoms_text');
    sessionStorage.removeItem('goldenlink_patient_info');
    router.push('/');
  };

  if (!analysis) return null;
  const ktas = KTAS_INFO[analysis.ktasLevel as KTASLevel];
  const top5 = hospitals.slice(0, 5);
  const selected = hospitals.find(h => h.id === selectedId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-3 flex items-center gap-3 shadow-lg">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:bg-red-800 rounded-xl transition-colors" aria-label="뒤로 가기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">병원 추천 결과</h1>
        </div>
        <div className="badge text-xs px-3 py-1.5" style={{ backgroundColor: ktas.bg, color: ktas.color }}>
          KTAS {analysis.ktasLevel} {ktas.label}
        </div>
      </header>

      {demoScenario && (() => {
        const demoStage =
          !dispatch ? 4 :
          (dispatch.status === 'accepted' || dispatch.status === 'transporting' || dispatch.status === 'arrived') ? 6 :
          5;
        return (
          <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white px-5 py-2.5">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center justify-center w-6 h-6 bg-white/20 backdrop-blur rounded-md flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  </span>
                  <span className="text-xs font-bold flex-shrink-0">DEMO</span>
                  <span className="text-xs text-white/90 truncate">
                    {!dispatch ? '병원 매칭 중...' :
                      dispatch.status === 'pending' ? `자동 이송 요청 (${dispatch.hospitalName})` :
                      dispatch.status === 'rejected' ? '거절 → 캐스케이드 자동 전환 중' :
                      dispatch.status === 'accepted' ? '이송 수락 — 시연 완료' :
                      dispatch.status === 'transporting' ? '이송 중' :
                      dispatch.status === 'arrived' ? '도착 완료 — 시연 종료' : ''}
                  </span>
                  <span className="text-[10px] text-white/70 font-bold whitespace-nowrap flex-shrink-0">{demoStage}/6</span>
                </div>
                <button onClick={() => router.push('/')} className="text-xs text-white/90 hover:text-white underline whitespace-nowrap flex-shrink-0">
                  중단
                </button>
              </div>
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
            </div>
          </div>
        );
      })()}

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Patient Summary */}
        {analysis && (
          <section className="px-4 pt-4">
            <div className="card !p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: ktas.bg }}>
                <span className="text-lg font-black leading-none" style={{ color: ktas.color }}>{analysis.ktasLevel}</span>
                <span className="text-[8px] font-bold mt-0.5" style={{ color: ktas.color }}>KTAS</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">환자</span>
                  {patientInfo?.age && <span className="text-sm font-bold text-gray-800">{patientInfo.age}세</span>}
                  {patientInfo && patientInfo.gender !== 'unknown' && (
                    <span className="text-sm font-semibold text-gray-700">{patientInfo.gender === 'male' ? '남' : '여'}</span>
                  )}
                  {patientInfo && patientInfo.consciousnessLevel !== 'alert' && patientInfo.consciousnessLevel !== 'unset' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: `${CONSCIOUSNESS_LABELS[patientInfo.consciousnessLevel].color}15`, color: CONSCIOUSNESS_LABELS[patientInfo.consciousnessLevel].color }}>
                      {CONSCIOUSNESS_LABELS[patientInfo.consciousnessLevel].label}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-2.5 gap-y-0 text-xs text-gray-600 mt-0.5">
                  {patientInfo?.bloodPressureSystolic && patientInfo?.bloodPressureDiastolic && (
                    <span><b className="text-red-600">BP</b> {patientInfo.bloodPressureSystolic}/{patientInfo.bloodPressureDiastolic}</span>
                  )}
                  {patientInfo?.heartRate && <span><b className="text-pink-600">HR</b> {patientInfo.heartRate}</span>}
                  {patientInfo?.oxygenSaturation && (
                    <span className={patientInfo.oxygenSaturation < 94 ? 'text-red-600 font-bold' : ''}>
                      <b className="text-blue-600">SpO2</b> {patientInfo.oxygenSaturation}%
                    </span>
                  )}
                  {patientInfo?.temperature && (
                    <span className={patientInfo.temperature >= 38 ? 'text-red-600 font-bold' : ''}>
                      <b className="text-orange-600">BT</b> {patientInfo.temperature}°C
                    </span>
                  )}
                  {patientInfo?.respiratoryRate && <span><b className="text-emerald-600">RR</b> {patientInfo.respiratoryRate}</span>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Map */}
        <div id="route-map" className="p-4 pb-0">
          {dispatch?.status === 'transporting' && selected && (
            <div className="mb-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-4 flex items-center gap-4 shadow-lg animate-slide-up">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="ambulance-drive"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/70">이송 경로 안내</p>
                <p className="font-bold text-lg truncate">{selected.name}</p>
                <p className="text-sm text-white/80">{selected.distance}km · 약 {selected.estimatedTime}분 소요</p>
              </div>
            </div>
          )}
          <LeafletMap hospitals={hospitals} userLat={userLat} userLng={userLng} selectedId={selectedId} onSelect={handleSelect} transporting={dispatch?.status === 'transporting'} />
        </div>

        {/* Cascade Timeline */}
        {cascadeHistory.length > 0 && (
          <div className="mx-4 mt-3 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200/60">
            <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
              캐스케이드 자동 매칭 진행
            </p>
            <div className="relative">
              {cascadeHistory.map((h, i) => {
                const isLast = i === cascadeHistory.length - 1;
                const showLine = !isLast || dispatch?.status === 'pending';
                return (
                  <div key={i} className="flex items-start gap-3 relative pb-3">
                    {showLine && (
                      <span className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-orange-200" aria-hidden="true" />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 relative z-10 shadow-sm ${
                        h.status === 'rejected' ? 'bg-red-500' : h.status === 'timeout' ? 'bg-amber-500' : 'bg-gray-400'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800 truncate">{h.hospitalName}</p>
                      <div className="flex items-center gap-1.5 text-xs flex-wrap">
                        <span
                          className={`font-bold ${
                            h.status === 'rejected' ? 'text-red-600' :
                            h.status === 'timeout' ? 'text-amber-600' :
                            'text-gray-500'
                          }`}
                        >
                          {h.status === 'rejected' ? '거절' : h.status === 'timeout' ? '시간 초과' : '실패'}
                        </span>
                        {h.reason && <span className="text-gray-500 truncate">— {h.reason}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {dispatch?.status === 'pending' && (
                <div className="flex items-start gap-3 relative">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 relative z-10 shadow-sm bg-blue-500 animate-pulse">
                    {cascadeHistory.length + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{dispatch.hospitalName}</p>
                    <p className="text-xs text-blue-600 font-bold flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                      응답 대기 중
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dispatch Status Banner */}
        {dispatch && (
          <div className={`mx-4 mt-3 p-4 rounded-2xl border-2 transition-all ${
            dispatch.status === 'pending' ? 'bg-amber-50 border-amber-300' :
            dispatch.status === 'accepted' ? 'bg-green-50 border-green-400' :
            dispatch.status === 'rejected' ? 'bg-red-50 border-red-300' :
            dispatch.status === 'transporting' ? 'bg-blue-50 border-blue-400' :
            dispatch.status === 'arrived' ? 'bg-emerald-50 border-emerald-400' :
            'bg-gray-50 border-gray-300'
          }`}>
            {dispatch.status === 'pending' && dispatch.responseDeadline && (
              <CountdownTimer
                deadline={dispatch.responseDeadline}
                onExpired={handleDeadlineExpired}
              />
            )}
            {dispatch.status === 'pending' && !dispatch.responseDeadline && (
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-amber-600 flex-shrink-0" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                <div>
                  <p className="font-bold text-amber-800">이송 요청 대기 중</p>
                  <p className="text-sm text-amber-600">{dispatch.hospitalName}에서 확인 중...</p>
                </div>
              </div>
            )}
            {dispatch.status === 'accepted' && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#16A34A"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-green-800 text-lg">이송 수락!</p>
                  <p className="text-sm text-green-600">{dispatch.hospitalName}에서 환자를 받겠습니다.</p>
                  <a href={`/dispatch/${dispatch.id}`} target="_blank" className="text-xs text-green-500 underline mt-0.5 inline-block">이송 요청서 보기</a>
                </div>
                {selected && (
                  <button onClick={() => startTransport(selected)} className="bg-green-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm active:scale-95 transition-all shadow-lg shadow-green-600/30">
                    출발
                  </button>
                )}
              </div>
            )}
            {dispatch.status === 'transporting' && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#2563EB" className="ambulance-drive"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-blue-800 text-lg">이송 중</p>
                  <p className="text-sm text-blue-600">{dispatch.hospitalName}으로 이송 중입니다.</p>
                </div>
              </div>
            )}
            {dispatch.status === 'arrived' && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#10B981"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-emerald-800 text-lg">도착 완료</p>
                  <p className="text-sm text-emerald-600">{dispatch.hospitalName}에 환자가 도착했습니다.</p>
                </div>
              </div>
            )}
            {dispatch.status === 'rejected' && !cascadeEnabled && (
              <div className="flex items-center gap-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#DC2626" className="flex-shrink-0"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                <div className="flex-1">
                  <p className="font-bold text-red-800">이송 거절됨</p>
                  <p className="text-sm text-red-600">{dispatch.rejectReason || '사유 미기재'}</p>
                </div>
                <button onClick={() => { setDispatch(null); setDispatchError(''); setCascadeHistory([]); setCascadeIndex(0); }} className="text-sm text-red-600 font-bold underline">
                  다시 시도
                </button>
              </div>
            )}
            {dispatch.status === 'rejected' && cascadeEnabled && (
              <div className="flex items-center gap-3">
                <div className="cascade-arrow text-orange-500">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
                </div>
                <div>
                  <p className="font-bold text-orange-800">다음 병원으로 자동 전환 중...</p>
                  <p className="text-sm text-orange-600">{dispatch.hospitalName} 거절 → 다음 순위 병원에 요청</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">요청 ID: {dispatch.id} | {timeAgo(dispatch.createdAt)}</p>
              {dispatch.status === 'pending' && (
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={cascadeEnabled}
                    onChange={e => setCascadeEnabled(e.target.checked)}
                    className="rounded"
                  />
                  자동 캐스케이드
                </label>
              )}
            </div>
          </div>
        )}

        {dispatchError && !dispatch && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-medium">
            {dispatchError}
          </div>
        )}

        {/* Hospital Cards */}
        <div className="flex-1 p-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full skeleton" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 skeleton w-3/4" />
                      <div className="h-4 skeleton w-1/2" />
                      <div className="h-2 skeleton w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : top5.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="#94A3B8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
              <p className="text-gray-700 font-bold text-base">조건에 맞는 병원을 찾지 못했어요</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">현재 위치에서 진료과·시설 조건을<br />모두 충족하는 병원이 없습니다.</p>
              <button onClick={() => router.back()} className="mt-5 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold active:scale-95 transition-all">
                증상 다시 입력
              </button>
            </div>
          ) : (
            top5.map((h, i) => {
              const isSelected = h.id === selectedId;
              const isFirst = i === 0;
              const congestion = CONGESTION_LABEL[h.congestionLevel];
              const rankColors = ['#DC2626', '#EA580C', '#CA8A04', '#2563EB', '#6B7280'];
              const isCascadeCurrent = dispatch?.status === 'pending' && dispatch.hospitalId === h.id;

              return (
                <button
                  key={h.id}
                  onClick={() => !dispatch && setSelectedId(h.id)}
                  disabled={!!dispatch && dispatch.status !== 'rejected'}
                  className={`card w-full text-left transition-all ${
                    isFirst && !dispatch ? 'border-2 border-red-200 !p-5' : ''
                  } ${
                    isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''
                  } ${isCascadeCurrent ? 'ring-2 ring-amber-400 alert-flash' : ''} ${
                    dispatch && !isCascadeCurrent ? 'opacity-50' : ''
                  }`}
                >
                  {isFirst && !dispatch && (
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-600 text-white shadow-sm shadow-red-600/30">1순위 추천</span>
                      <span className="text-[10px] text-gray-400 font-medium">매칭 점수 최고</span>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div
                      className={`${isFirst ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg'} rounded-full flex items-center justify-center text-white font-black flex-shrink-0 shadow-lg`}
                      style={{ backgroundColor: rankColors[i], boxShadow: `0 4px 12px ${rankColors[i]}40` }}
                    >{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-black truncate ${isFirst ? 'text-lg' : 'text-base'}`}>{h.name}</h3>
                        <div className="flex items-baseline gap-1 flex-shrink-0">
                          <span className={`font-black ${isFirst ? 'text-2xl text-red-600' : 'text-sm text-blue-600'}`}>{h.score}</span>
                          <span className="text-[10px] text-gray-400">점</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                          <b className="text-gray-700">{h.distance}km</b> ({h.estimatedTime}분)
                        </span>
                        <span>병상 <b className="text-gray-800">{h.availableBeds}</b>/{h.totalBeds}</span>
                        <span>수술실 <b className="text-gray-800">{h.operatingRooms.available}</b>/{h.operatingRooms.total}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: congestion.bg, color: congestion.color }}>{congestion.text}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="score-bar h-full rounded-full transition-all duration-500" style={{ width: `${h.score}%` }} />
                      </div>
                      {h.matchReasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {h.matchReasons.slice(0, 3).map(r => (
                            <span key={r} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="text-green-500 flex-shrink-0"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom Action */}
        {selected && !dispatch && (
          <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 p-4 shadow-2xl shadow-black/5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">선택된 병원</p>
                <p className="font-bold truncate">{selected.name}</p>
              </div>
              <a href={`tel:${selected.phone}`} className="btn-outline flex items-center gap-2 !py-3 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                전화
              </a>
              <button
                onClick={requestDispatch}
                disabled={dispatching}
                className="btn-primary flex items-center gap-2"
              >
                {dispatching ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
                )}
                이송 요청
              </button>
            </div>
          </div>
        )}

        {/* Navigation bar after accepted */}
        {selected && dispatch?.status === 'accepted' && (
          <div className="sticky bottom-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-4 shadow-2xl">
            <button onClick={() => startTransport(selected)} className="w-full flex items-center justify-center gap-3 py-3 font-bold text-xl active:scale-95 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ambulance-drive"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
              출발 — {selected.name}
            </button>
          </div>
        )}

        {/* Arrival button — transporting 상태 */}
        {dispatch?.status === 'transporting' && (
          <div className="sticky bottom-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl">
            <button onClick={() => { if (dispatch) setDispatch({ ...dispatch, status: 'arrived', updatedAt: new Date().toISOString() }); updateDispatchStatus('arrived'); }} className="w-full flex items-center justify-center gap-3 py-3 font-bold text-xl active:scale-95 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              병원 도착 · 환자 인계 완료
            </button>
          </div>
        )}

        {/* Complete bar — arrived 상태 */}
        {dispatch?.status === 'arrived' && (
          <div className="sticky bottom-0 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 shadow-2xl">
            <button onClick={finishAndGoHome} className="w-full flex items-center justify-center gap-3 py-3 font-bold text-xl active:scale-95 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              이송 완료 · 새 환자 받기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
