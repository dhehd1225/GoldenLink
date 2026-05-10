'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Hospital, Dispatch, KTAS_INFO, KTASLevel, PatientInfo, CONSCIOUSNESS_LABELS } from '@/lib/types';
import { ALL_SPECIALTIES } from '@/lib/mock-data';

const CONGESTION_OPTIONS = [
  { value: 'low', label: '여유', color: '#16A34A', bg: '#DCFCE7' },
  { value: 'medium', label: '보통', color: '#CA8A04', bg: '#FEF9C3' },
  { value: 'high', label: '혼잡', color: '#DC2626', bg: '#FEE2E2' },
] as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
}

// Notification sound using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playTone(880, 0, 0.15);
    playTone(1100, 0.18, 0.15);
    playTone(880, 0.36, 0.2);
  } catch { /* Audio not supported */ }
}

function ResponseTimer({ deadline }: { deadline?: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const left = Math.max(0, new Date(deadline).getTime() - Date.now());
      setRemaining(left);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  const isUrgent = totalSeconds < 60;

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
      isUrgent ? 'bg-red-100 text-red-700 timer-urgent' : 'bg-amber-100 text-amber-700'
    }`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
      {min}:{String(sec).padStart(2, '0')}
    </div>
  );
}

function PatientInfoCard({ info }: { info?: PatientInfo }) {
  if (!info) return null;
  const hasVitals = info.heartRate || info.bloodPressureSystolic || info.oxygenSaturation || info.temperature;

  return (
    <div className="bg-blue-50/50 rounded-xl p-3 mt-2 space-y-1.5">
      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">환자 정보</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {info.age && <span className="bg-white px-2 py-0.5 rounded-md font-semibold text-gray-700">{info.age}세</span>}
        {info.gender !== 'unknown' && <span className="bg-white px-2 py-0.5 rounded-md font-semibold text-gray-700">{info.gender === 'male' ? '남성' : '여성'}</span>}
        {info.consciousnessLevel !== 'alert' && (
          <span className="px-2 py-0.5 rounded-md font-bold" style={{ backgroundColor: `${CONSCIOUSNESS_LABELS[info.consciousnessLevel].color}15`, color: CONSCIOUSNESS_LABELS[info.consciousnessLevel].color }}>
            {CONSCIOUSNESS_LABELS[info.consciousnessLevel].label}
          </span>
        )}
      </div>
      {hasVitals && (
        <div className="flex flex-wrap gap-2 text-xs">
          {info.bloodPressureSystolic && info.bloodPressureDiastolic && (
            <span className="bg-white px-2 py-0.5 rounded-md"><b className="text-red-600">BP</b> {info.bloodPressureSystolic}/{info.bloodPressureDiastolic}</span>
          )}
          {info.heartRate && <span className="bg-white px-2 py-0.5 rounded-md"><b className="text-pink-600">HR</b> {info.heartRate}bpm</span>}
          {info.oxygenSaturation && (
            <span className={`bg-white px-2 py-0.5 rounded-md ${info.oxygenSaturation < 94 ? 'ring-1 ring-red-300' : ''}`}>
              <b className="text-blue-600">SpO2</b> {info.oxygenSaturation}%
            </span>
          )}
          {info.temperature && (
            <span className={`bg-white px-2 py-0.5 rounded-md ${info.temperature >= 38 ? 'ring-1 ring-red-300' : ''}`}>
              <b className="text-orange-600">BT</b> {info.temperature}°C
            </span>
          )}
        </div>
      )}
      {info.allergies && <p className="text-xs text-gray-500">알레르기: {info.allergies}</p>}
      {info.medications && <p className="text-xs text-gray-500">복용약: {info.medications}</p>}
    </div>
  );
}

export default function HospitalDashboardPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'dispatches' | 'management'>('dispatches');

  const [specialists, setSpecialists] = useState<Record<string, boolean>>({});
  const [orAvailable, setOrAvailable] = useState(0);
  const [congestion, setCongestion] = useState<'low' | 'medium' | 'high'>('medium');
  const [availableBeds, setAvailableBeds] = useState(0);

  // Dispatch state
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevPendingCountRef = useRef(0);

  useEffect(() => {
    fetch('/api/hospitals').then(r => r.json()).then((data: Hospital[]) => {
      setHospitals(data);
      if (data.length > 0) setSelectedId(data[0].id);
    });
  }, []);

  const fetchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    fetch(`/api/hospital/${selectedId}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: Hospital) => {
        if (controller.signal.aborted) return;
        setHospital(data);
        setSpecialists({ ...data.specialists });
        setOrAvailable(data.operatingRooms.available);
        setCongestion(data.congestionLevel);
        setAvailableBeds(data.availableBeds);
        setSaved(false);
      })
      .catch(e => { if (e.name !== 'AbortError') console.error(e); });

    return () => controller.abort();
  }, [selectedId]);

  // Poll dispatches every 3s
  const fetchDispatches = useCallback(() => {
    if (!selectedId) return;
    fetch(`/api/dispatch?hospitalId=${selectedId}`)
      .then(r => r.json())
      .then((data: Dispatch[]) => {
        setDispatches(data);
        // Play sound for new pending dispatches
        const newPendingCount = data.filter((d: Dispatch) => d.status === 'pending').length;
        if (soundEnabled && newPendingCount > prevPendingCountRef.current) {
          playAlertSound();
        }
        prevPendingCountRef.current = newPendingCount;
      })
      .catch(() => {});
  }, [selectedId, soundEnabled]);

  useEffect(() => {
    fetchDispatches();
    const interval = setInterval(fetchDispatches, 3000);
    return () => clearInterval(interval);
  }, [fetchDispatches]);

  const pendingDispatches = dispatches.filter(d => d.status === 'pending');
  const activeDispatches = dispatches.filter(d => d.status === 'accepted' || d.status === 'transporting');
  const recentDispatches = dispatches.filter(d => d.status === 'rejected' || d.status === 'arrived').slice(0, 10);

  const respondDispatch = async (id: string, status: 'accepted' | 'rejected') => {
    await fetch(`/api/dispatch/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectReason: status === 'rejected' ? (rejectReason || '수용 불가') : undefined }),
    });
    setRejectingId(null);
    setRejectReason('');
    fetchDispatches();
  };

  const toggleSpecialist = (spec: string) => {
    setSpecialists(prev => ({ ...prev, [spec]: !prev[spec] }));
    setSaved(false);
  };

  const saveChanges = async () => {
    if (!hospital) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/hospital/${hospital.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialists,
          availableSpecialties: Object.entries(specialists).filter(([, v]) => v).map(([k]) => k),
          operatingRooms: { total: hospital.operatingRooms.total, available: orAvailable },
          congestionLevel: congestion,
          availableBeds,
        }),
      });
      if (res.ok) {
        setHospital(await res.json());
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!hospital) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-slate-100">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 mx-auto mb-3 text-blue-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <p className="text-sm text-gray-400">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  const bedRatio = hospital.totalBeds > 0 ? (availableBeds / hospital.totalBeds) * 100 : 0;
  const activeSpecs = Object.values(specialists).filter(Boolean).length;
  const currentCongestion = CONGESTION_OPTIONS.find(o => o.value === congestion)!;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-4 shadow-lg shadow-blue-900/20">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = '/'} className="w-10 h-10 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center active:scale-95 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">병원 대시보드</h1>
              <p className="text-blue-200 text-xs">응급 코디네이터</p>
            </div>
            {pendingDispatches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500 rounded-full px-3 py-1.5 badge-bounce">
                <span className="text-sm font-bold">{pendingDispatches.length}건</span>
              </div>
            )}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="w-9 h-9 flex items-center justify-center bg-white/15 backdrop-blur rounded-xl active:scale-95 transition-transform"
              title={soundEnabled ? '알림음 끄기' : '알림음 켜기'}
            >
              {soundEnabled ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              )}
            </button>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-full px-3 py-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full status-live" />
              <span className="text-xs font-medium">LIVE</span>
            </div>
          </div>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full mt-3 bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-2.5 text-white text-base font-semibold focus:outline-none appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}
          >
            {hospitals.map(h => (
              <option key={h.id} value={h.id} className="text-gray-800">{h.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="bg-white border-b border-gray-200 px-5">
        <div className="max-w-2xl mx-auto flex gap-1">
          <button
            onClick={() => setActiveTab('dispatches')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'dispatches' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
            }`}
          >
            이송 요청
            {pendingDispatches.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingDispatches.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'management' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
            }`}
          >
            병원 관리
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 space-y-3 max-w-2xl mx-auto w-full pb-28">
        {activeTab === 'dispatches' ? (
          <>
            {/* Status Overview - Always visible */}
            <div className="grid grid-cols-3 gap-2">
              <div className="card !p-3 text-center">
                <p className="text-2xl font-black text-blue-600">{availableBeds}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">가용 병상</p>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${bedRatio}%`, backgroundColor: bedRatio > 50 ? '#16A34A' : bedRatio > 20 ? '#CA8A04' : '#DC2626' }} />
                </div>
              </div>
              <div className="card !p-3 text-center">
                <p className="text-2xl font-black" style={{ color: currentCongestion.color }}>
                  {congestion === 'low' ? '여유' : congestion === 'medium' ? '보통' : '혼잡'}
                </p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">혼잡도</p>
                <div className="h-1 rounded-full mt-1.5" style={{ backgroundColor: currentCongestion.bg }}>
                  <div className="h-full rounded-full" style={{ backgroundColor: currentCongestion.color, width: congestion === 'low' ? '33%' : congestion === 'medium' ? '66%' : '100%' }} />
                </div>
              </div>
              <div className="card !p-3 text-center">
                <p className="text-2xl font-black text-green-600">{orAvailable}<span className="text-sm text-gray-300">/{hospital.operatingRooms.total}</span></p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">수술실</p>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${hospital.operatingRooms.total > 0 ? (orAvailable / hospital.operatingRooms.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            {/* Incoming Dispatch Alerts */}
            {pendingDispatches.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-black text-red-600 text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  이송 요청 수신 ({pendingDispatches.length}건)
                </h2>
                {pendingDispatches.map(d => {
                  const ktas = KTAS_INFO[d.symptoms.ktasLevel as KTASLevel];
                  return (
                    <div key={d.id} className="card border-2 border-red-300 bg-red-50/50 !p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: ktas.bg }}>
                          <span className="text-lg font-black" style={{ color: ktas.color }}>{d.symptoms.ktasLevel}</span>
                          <span className="text-[8px] font-bold" style={{ color: ktas.color }}>KTAS</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm" style={{ color: ktas.color }}>{ktas.label}</span>
                            <ResponseTimer deadline={d.responseDeadline} />
                            <span className="text-[10px] text-gray-400">{d.id}</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{d.symptomsText || d.symptoms.suspectedConditions.join(', ')}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {d.symptoms.requiredSpecialties.map(s => (
                              <span key={s} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-semibold">{s}</span>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            도착 예상: {d.estimatedTime}분 ({d.distance}km)
                            {d.cascadeIndex !== undefined && d.cascadeIndex > 0 && (
                              <span className="text-orange-600 font-bold ml-1.5">캐스케이드 #{d.cascadeIndex + 1}</span>
                            )}
                          </p>

                          {/* Patient Info */}
                          <PatientInfoCard info={d.patientInfo} />
                        </div>
                      </div>

                      {rejectingId === d.id ? (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="거절 사유 (예: 전문의 부재, 수술실 풀)"
                            className="w-full border-2 border-gray-200 rounded-xl p-2.5 text-sm focus:border-red-400 focus:outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => setRejectingId(null)} className="btn-outline flex-1 !py-2 !min-h-0 text-sm">취소</button>
                            <button onClick={() => respondDispatch(d.id, 'rejected')} className="flex-1 bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-sm active:scale-95 transition-all">거절 확인</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setRejectingId(d.id)}
                            className="flex-1 border-2 border-red-200 text-red-600 font-bold py-2.5 rounded-xl active:scale-95 transition-all text-sm"
                          >거절</button>
                          <button
                            onClick={() => respondDispatch(d.id, 'accepted')}
                            className="flex-[2] bg-green-600 text-white font-bold py-2.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-green-600/30 text-sm"
                          >수락</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {/* Active transports */}
            {activeDispatches.length > 0 && (
              <section className="card border-2 border-green-200 bg-green-50/50 !p-4">
                <h2 className="font-bold text-green-700 text-sm mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full status-live" />
                  이송 중 ({activeDispatches.length}건)
                </h2>
                {activeDispatches.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-2 border-t border-green-100 first:border-0">
                    <div className="flex items-center gap-2">
                      <div className="ambulance-drive text-green-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>
                      </div>
                      <div>
                        <span className="text-sm font-semibold">{d.symptoms.suspectedConditions.join(', ')}</span>
                        <span className="text-xs text-gray-400 ml-2">KTAS {d.symptoms.ktasLevel}</span>
                      </div>
                    </div>
                    <span className="text-sm text-green-600 font-bold">약 {d.estimatedTime}분</span>
                  </div>
                ))}
              </section>
            )}

            {/* No dispatches */}
            {pendingDispatches.length === 0 && activeDispatches.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#CBD5E1"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <p className="text-gray-400 font-medium">대기 중인 이송 요청이 없습니다</p>
                <p className="text-xs text-gray-300 mt-1">새 요청이 도착하면 알림음과 함께 표시됩니다</p>
              </div>
            )}

            {/* Recent dispatch history */}
            {recentDispatches.length > 0 && (
              <div className="card !p-4">
                <h2 className="font-bold text-sm mb-2 text-gray-700">최근 이송 이력</h2>
                <div className="space-y-1">
                  {recentDispatches.map(d => (
                    <div key={d.id} className="flex items-center justify-between py-1.5 border-t border-gray-100 first:border-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'rejected' ? 'bg-red-500' : 'bg-green-500'}`} />
                        <span className={`font-bold ${d.status === 'rejected' ? 'text-red-500' : 'text-green-600'}`}>
                          {d.status === 'rejected' ? '거절' : '완료'}
                        </span>
                        <span className="text-gray-500">KTAS {d.symptoms.ktasLevel} | {d.symptoms.suspectedConditions.join(', ')}</span>
                      </div>
                      <span className="text-gray-400">{timeAgo(d.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Management Tab */}
            {/* Bed Control */}
            <div className="card !p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm">가용 병상</h2>
                <span className="text-xs text-gray-400">총 {hospital.totalBeds}개</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setAvailableBeds(Math.max(0, availableBeds - 1)); setSaved(false); }} className="w-14 h-14 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 text-2xl font-bold flex items-center justify-center active:scale-90 transition-all">-</button>
                <div className="flex-1 text-center">
                  <input type="number" value={availableBeds} onChange={e => { setAvailableBeds(Math.max(0, Math.min(hospital.totalBeds, parseInt(e.target.value) || 0))); setSaved(false); }} className="w-full text-center text-4xl font-black text-gray-800 bg-transparent focus:outline-none" />
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${bedRatio}%`, backgroundColor: bedRatio > 50 ? '#16A34A' : bedRatio > 20 ? '#CA8A04' : '#DC2626' }} />
                  </div>
                </div>
                <button onClick={() => { setAvailableBeds(Math.min(hospital.totalBeds, availableBeds + 1)); setSaved(false); }} className="w-14 h-14 rounded-xl bg-green-50 border-2 border-green-200 text-green-600 text-2xl font-bold flex items-center justify-center active:scale-90 transition-all">+</button>
              </div>
            </div>

            {/* Congestion */}
            <div className="card !p-4">
              <h2 className="font-bold text-sm mb-3">혼잡도</h2>
              <div className="grid grid-cols-3 gap-2">
                {CONGESTION_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { setCongestion(opt.value); setSaved(false); }}
                    className={`py-3 rounded-xl font-bold text-sm transition-all border-2 active:scale-95 ${congestion === opt.value ? 'shadow-md' : 'border-transparent opacity-40'}`}
                    style={{ backgroundColor: congestion === opt.value ? opt.bg : '#F8FAFC', color: congestion === opt.value ? opt.color : '#94A3B8', borderColor: congestion === opt.value ? opt.color : 'transparent' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Operating Rooms */}
            <div className="card !p-4">
              <h2 className="font-bold text-sm mb-3">수술실 현황</h2>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: hospital.operatingRooms.total }).map((_, i) => {
                  const isAvail = i < orAvailable;
                  return (
                    <button key={i} onClick={() => { setOrAvailable(i < orAvailable ? i : i + 1); setSaved(false); }}
                      className={`aspect-square rounded-xl font-bold text-center transition-all border-2 active:scale-90 flex flex-col items-center justify-center ${isAvail ? 'bg-green-50 border-green-400 text-green-700 shadow-sm' : 'bg-red-50 border-red-200 text-red-400'}`}
                    >
                      <span className="text-base font-black">{i + 1}</span>
                      <span className="text-[9px] font-bold mt-0.5">{isAvail ? 'OK' : '사용중'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Specialists */}
            <div className="card !p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm">전문의 현황</h2>
                <span className="badge bg-blue-50 text-blue-600 text-xs">{activeSpecs}명 가용</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SPECIALTIES.map(spec => {
                  const isOn = specialists[spec] || false;
                  return (
                    <button key={spec} onClick={() => toggleSpecialist(spec)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border-2 active:scale-[0.97] ${isOn ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50/50 border-gray-100 text-gray-300'}`}
                    >
                      <span>{spec}</span>
                      <div className={`w-9 h-5 rounded-full relative transition-all duration-200 ${isOn ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-0.5 shadow-sm transition-all duration-200 ${isOn ? 'left-[18px]' : 'left-0.5'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating Save - only on management tab */}
      {activeTab === 'management' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 px-5 py-3">
          <div className="max-w-2xl mx-auto">
            <button onClick={saveChanges} disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl text-base font-bold transition-all active:scale-[0.97] select-none ${saved ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 active:bg-blue-700'} disabled:bg-gray-300 disabled:shadow-none`}
            >
              {saving ? (
                <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>저장 중...</>
              ) : saved ? (
                <><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>저장 완료!</>
              ) : '상태 업데이트'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
