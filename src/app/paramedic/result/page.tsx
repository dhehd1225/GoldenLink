'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SymptomAnalysis, MatchedHospital, KTAS_INFO, KTASLevel, Dispatch, PatientInfo } from '@/lib/types';
import NaverMap from '@/components/NaverMap';

const CONGESTION_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  low: { text: '여유', color: '#16A34A', bg: '#DCFCE7' },
  medium: { text: '보통', color: '#CA8A04', bg: '#FEF9C3' },
  high: { text: '혼잡', color: '#DC2626', bg: '#FEE2E2' },
};

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
}

function CountdownTimer({ deadline, onExpired }: { deadline: string; onExpired?: () => void }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, new Date(deadline).getTime() - Date.now());
      setRemaining(left);
      if (left === 0 && onExpired) onExpired();
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
    const stored = sessionStorage.getItem('goldenlink_analysis');
    const storedText = sessionStorage.getItem('goldenlink_symptoms_text') || '';
    const storedPatient = sessionStorage.getItem('goldenlink_patient_info');
    if (!stored) { router.push('/paramedic/input'); return; }
    setAnalysis(JSON.parse(stored));
    setSymptomsText(storedText);
    if (storedPatient) setPatientInfo(JSON.parse(storedPatient));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocationReady(true); },
        () => setLocationReady(true),
        { timeout: 5000, maximumAge: 60000 },
      );
    } else {
      setLocationReady(true);
    }
  }, [router]);

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
          if (!selectedId && data.length > 0) setSelectedId(data[0].id);
        }
      })
      .catch(e => { if (e.name !== 'AbortError') console.error(e); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [analysis, locationReady, userLat, userLng, selectedId]);

  useEffect(() => {
    setLoading(true);
    fetchHospitals();
  }, [fetchHospitals]);

  // Auto-refresh (not during dispatch)
  useEffect(() => {
    if (dispatch) return;
    const interval = setInterval(fetchHospitals, 30000);
    return () => clearInterval(interval);
  }, [fetchHospitals, dispatch]);

  // Poll dispatch status
  useEffect(() => {
    if (!dispatch || dispatch.status === 'accepted' || dispatch.status === 'rejected') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/dispatch/${dispatch.id}`);
        if (res.ok) {
          const updated: Dispatch = await res.json();
          setDispatch(updated);
          if (updated.status === 'accepted') {
            clearInterval(interval);
          } else if (updated.status === 'rejected') {
            clearInterval(interval);
            // Auto-cascade to next hospital
            if (cascadeEnabled) {
              handleCascadeReject(updated);
            }
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [dispatch, cascadeEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCascadeReject = (rejected: Dispatch) => {
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
      // Auto-dispatch to next hospital after a short delay
      setTimeout(() => {
        dispatchToHospital(nextHospital, nextIndex);
      }, 1500);
    }
  };

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);

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
          cascadeGroupId: cascadeHistory.length > 0 ? 'cascade' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDispatchError(data.error || '이송 요청에 실패했습니다.');
        // Try next hospital if bed shortage
        if (cascadeEnabled && idx < Math.min(hospitals.length, 5) - 1) {
          setCascadeHistory(prev => [...prev, { hospitalName: hospital.name, status: 'failed', reason: data.error }]);
          const nextIdx = idx + 1;
          setCascadeIndex(nextIdx);
          setSelectedId(hospitals[nextIdx].id);
          setTimeout(() => dispatchToHospital(hospitals[nextIdx], nextIdx), 1000);
        }
      } else {
        setDispatch(data);
      }
    } catch {
      setDispatchError('네트워크 오류입니다.');
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
    dispatchToHospital(selected, idx);
  };

  const handleDeadlineExpired = useCallback(() => {
    // When hospital doesn't respond in time, auto-cascade
    if (dispatch && dispatch.status === 'pending' && cascadeEnabled) {
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
      }
    }
  }, [dispatch, cascadeEnabled, cascadeIndex, hospitals]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNavigation = (h: MatchedHospital) => {
    window.open(`https://map.naver.com/v5/directions/-/-/-/car?c=${h.lng},${h.lat},15,0,0,0,dh`, '_blank');
  };

  if (!analysis) return null;
  const ktas = KTAS_INFO[analysis.ktasLevel as KTASLevel];
  const top5 = hospitals.slice(0, 5);
  const selected = hospitals.find(h => h.id === selectedId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-3 flex items-center gap-3 shadow-lg">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:bg-red-800 rounded-xl transition-colors">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">병원 추천 결과</h1>
        </div>
        <div className="badge text-xs px-3 py-1.5" style={{ backgroundColor: ktas.bg, color: ktas.color }}>
          KTAS {analysis.ktasLevel} {ktas.label}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Map */}
        <div className="p-4 pb-0">
          <NaverMap hospitals={hospitals} userLat={userLat} userLng={userLng} selectedId={selectedId} onSelect={handleSelect} />
        </div>

        {/* Cascade History */}
        {cascadeHistory.length > 0 && (
          <div className="mx-4 mt-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-orange-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
              자동 캐스케이드 이력
            </p>
            <div className="space-y-1.5">
              {cascadeHistory.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                    h.status === 'rejected' ? 'bg-red-500' : h.status === 'timeout' ? 'bg-amber-500' : 'bg-gray-400'
                  }`}>{i + 1}</span>
                  <span className="font-semibold text-gray-700">{h.hospitalName}</span>
                  <span className={`font-bold ${h.status === 'rejected' ? 'text-red-500' : h.status === 'timeout' ? 'text-amber-500' : 'text-gray-400'}`}>
                    {h.status === 'rejected' ? '거절' : h.status === 'timeout' ? '시간초과' : '실패'}
                  </span>
                  {h.reason && <span className="text-gray-400 truncate">- {h.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dispatch Status Banner */}
        {dispatch && (
          <div className={`mx-4 mt-3 p-4 rounded-2xl border-2 transition-all ${
            dispatch.status === 'pending' ? 'bg-amber-50 border-amber-300' :
            dispatch.status === 'accepted' ? 'bg-green-50 border-green-400' :
            dispatch.status === 'rejected' ? 'bg-red-50 border-red-300' :
            'bg-blue-50 border-blue-300'
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
                  <button onClick={() => openNavigation(selected)} className="bg-green-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm active:scale-95 transition-all shadow-lg shadow-green-600/30">
                    출발
                  </button>
                )}
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
            <div className="text-center py-12 text-gray-400">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mx-auto mb-3 text-gray-300"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              조건에 맞는 병원이 없습니다.
            </div>
          ) : (
            top5.map((h, i) => {
              const isSelected = h.id === selectedId;
              const congestion = CONGESTION_LABEL[h.congestionLevel];
              const rankColors = ['#DC2626', '#EA580C', '#CA8A04', '#2563EB', '#6B7280'];
              const isCascadeCurrent = dispatch?.status === 'pending' && dispatch.hospitalId === h.id;

              return (
                <button
                  key={h.id}
                  onClick={() => !dispatch && setSelectedId(h.id)}
                  disabled={!!dispatch && dispatch.status !== 'rejected'}
                  className={`card w-full text-left transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''
                  } ${isCascadeCurrent ? 'ring-2 ring-amber-400 alert-flash' : ''} ${
                    dispatch && !isCascadeCurrent ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-lg" style={{ backgroundColor: rankColors[i], boxShadow: `0 4px 12px ${rankColors[i]}30` }}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-base truncate">{h.name}</h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-sm font-black text-blue-600">{h.score}</span>
                          <span className="text-xs text-gray-400">점</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                          {h.distance}km ({h.estimatedTime}분)
                        </span>
                        <span>병상 <b className="text-gray-800">{h.availableBeds}</b>/{h.totalBeds}</span>
                        <span>수술실 <b className="text-gray-800">{h.operatingRooms.available}</b>/{h.operatingRooms.total}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: congestion.bg, color: congestion.color }}>{congestion.text}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="score-bar h-full rounded-full transition-all duration-500" style={{ width: `${h.score}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {h.matchReasons.slice(0, 3).map(r => (
                          <span key={r} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-md">{r}</span>
                        ))}
                      </div>
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
            <button onClick={() => openNavigation(selected)} className="w-full flex items-center justify-center gap-3 py-3 font-bold text-xl active:scale-95 transition-all">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ambulance-drive"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
              {selected.name} 내비게이션 시작
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
