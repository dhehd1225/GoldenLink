'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DEMO_SCENARIOS } from '@/lib/demo-scenarios';
import { Dispatch, KTAS_INFO, KTASLevel } from '@/lib/types';

interface QuickStats {
  totalDispatches: number;
  pendingDispatches: number;
  acceptedDispatches: number;
}

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return <span>{time}</span>;
}

export default function Home() {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/statistics')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/statistics').then(r => r.json()).then(data => setStats(data)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // localStorage 활성 dispatch 감지 → 홈에 진행 중 카드 (새로고침/탭재오픈 복귀 path)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = localStorage.getItem('goldenlink_active_dispatch');
    if (!id) return;
    fetch(`/api/dispatch/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: Dispatch | null) => {
        if (!d) {
          localStorage.removeItem('goldenlink_active_dispatch');
          return;
        }
        const active = d.status === 'pending' || d.status === 'accepted' || d.status === 'transporting';
        if (active) setActiveDispatch(d);
        else localStorage.removeItem('goldenlink_active_dispatch');
      })
      .catch(() => localStorage.removeItem('goldenlink_active_dispatch'));
  }, []);

  const startDemo = (scenarioId: string) => {
    setShowDemoModal(false);
    router.push(`/paramedic/input?demo=${scenarioId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200/80 px-5 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center shadow-sm shadow-red-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">GoldenLink</h1>
              <p className="text-[11px] text-gray-400 font-medium tracking-wide">응급 병원 매칭 시스템</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full status-live" />
              <span className="font-medium">운영 중</span>
            </div>
            <span className="font-mono"><LiveClock /></span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center p-5 max-w-3xl mx-auto w-full">
        {/* Active Dispatch — 진행 중 이송 복귀 카드 */}
        {activeDispatch && (
          <Link
            href="/paramedic/result"
            className="mb-5 group relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-5 shadow-xl shadow-emerald-600/30 active:scale-[0.99] hover:shadow-2xl hover:shadow-emerald-600/40 transition-all block"
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
                {activeDispatch.status === 'pending' ? (
                  <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                ) : activeDispatch.status === 'transporting' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white" className="ambulance-drive"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">진행 중</p>
                  <span className="text-[10px] bg-white/20 backdrop-blur px-2 py-0.5 rounded-full font-bold">
                    {activeDispatch.status === 'pending' ? '병원 응답 대기' : activeDispatch.status === 'accepted' ? '수락 — 출발 대기' : '이송 중'}
                  </span>
                </div>
                <p className="text-base font-black mt-0.5 truncate">{activeDispatch.hospitalName}</p>
                <p className="text-xs text-white/80">
                  KTAS {activeDispatch.symptoms.ktasLevel} {KTAS_INFO[activeDispatch.symptoms.ktasLevel as KTASLevel]?.label} · {activeDispatch.distance}km · 약 {activeDispatch.estimatedTime}분
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="flex-shrink-0 group-hover:translate-x-1 transition-transform"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
            </div>
          </Link>
        )}

        {/* Demo CTA — 심사위원/방문자용 자동 시연 */}
        <button
          onClick={() => setShowDemoModal(true)}
          className="mb-5 group relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white rounded-3xl p-5 shadow-xl shadow-purple-600/30 active:scale-[0.99] hover:shadow-2xl hover:shadow-purple-600/40 transition-all"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-black">1분 자동 시연</p>
                <span className="text-[10px] bg-white/20 backdrop-blur px-2 py-0.5 rounded-full font-bold">DEMO</span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">구급대원 입력 → AI 분류 → 병원 매칭 → 캐스케이드 dispatch까지 자동 재생</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="flex-shrink-0 group-hover:translate-x-1 transition-transform"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
          </div>
        </button>

        {/* Live Status Bar */}
        {stats && stats.totalDispatches > 0 && (
          <div className="mb-6 flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-gray-400">현황</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                총 <b className="text-gray-800">{stats.totalDispatches}</b>건
              </span>
              {stats.pendingDispatches > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  대기 {stats.pendingDispatches}건
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                수락 <b className="text-gray-800">{stats.acceptedDispatches}</b>건
              </span>
            </div>
          </div>
        )}

        {/* Role Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Paramedic */}
          <Link
            href="/paramedic/input"
            className="group relative bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-50 to-transparent rounded-bl-full" />
            <div className="relative">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#DC2626">
                  <path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-1">구급대원</h2>
              <p className="text-sm text-gray-500 leading-relaxed">환자 증상 입력 및 AI 분석<br/>최적 병원 매칭 · 이송 요청</p>
              <div className="flex items-center gap-1.5 mt-4 text-red-600 text-sm font-bold group-hover:gap-2.5 transition-all">
                시작
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
              </div>
            </div>
          </Link>

          {/* Hospital */}
          <Link
            href="/hospital/dashboard"
            className="group relative bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full" />
            <div className="relative">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#2563EB">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-1">병원 대시보드</h2>
              <p className="text-sm text-gray-500 leading-relaxed">이송 요청 수신 · 수락/거절<br/>병상 · 전문의 · 수술실 관리</p>
              <div className="flex items-center gap-1.5 mt-4 text-blue-600 text-sm font-bold group-hover:gap-2.5 transition-all">
                접속
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
              </div>
            </div>
          </Link>

          {/* Statistics - Full width */}
          <Link
            href="/admin"
            className="group sm:col-span-2 relative bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-24 bg-gradient-to-bl from-gray-50 to-transparent rounded-bl-full" />
            <div className="relative flex items-center gap-5">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="#374151">
                  <path d="M3 3v18h18V3H3zm6 14H7v-5h2v5zm4 0h-2V7h2v10zm4 0h-2v-3h2v3z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-gray-900 mb-0.5">통계 · 운영 현황</h2>
                <p className="text-sm text-gray-500">이송 요청 분석 · KTAS 분포 · 병원별 응답률 · 실시간 모니터링</p>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 text-sm font-bold group-hover:gap-2.5 transition-all flex-shrink-0">
                보기
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/></svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Info */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="bg-white/60 rounded-xl border border-gray-100/80 p-3 text-center">
            <p className="text-lg font-black text-gray-800">12</p>
            <p className="text-[10px] text-gray-400 font-medium">연결 병원</p>
          </div>
          <div className="bg-white/60 rounded-xl border border-gray-100/80 p-3 text-center">
            <p className="text-lg font-black text-gray-800">5단계</p>
            <p className="text-[10px] text-gray-400 font-medium">KTAS 분류</p>
          </div>
          <div className="bg-white/60 rounded-xl border border-gray-100/80 p-3 text-center">
            <p className="text-lg font-black text-gray-800">AI</p>
            <p className="text-[10px] text-gray-400 font-medium">증상 분석</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-5 py-4 text-center text-[10px] text-gray-300">
        GoldenLink &middot; 지능형 응급 병원 매칭 시스템
      </footer>

      {/* Demo Scenario Modal */}
      {showDemoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowDemoModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">자동 시연</p>
                <h3 className="text-xl font-black text-gray-900 mt-0.5">시나리오 선택</h3>
                <p className="text-xs text-gray-500 mt-1">실제 시스템에 가상 환자 데이터를 흘려 자동으로 진행됩니다</p>
              </div>
              <button onClick={() => setShowDemoModal(false)} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center active:scale-95 flex-shrink-0" aria-label="시연 모달 닫기">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#6B7280"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              {DEMO_SCENARIOS.map(s => (
                <button
                  key={s.id}
                  onClick={() => startDemo(s.id)}
                  className="w-full text-left bg-gradient-to-br from-gray-50 to-white border-2 border-gray-100 hover:border-purple-300 hover:shadow-md rounded-2xl p-4 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-3xl flex-shrink-0">{s.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{s.title}</p>
                      <p className="text-xs text-purple-600 font-bold mt-0.5">{s.subtitle}</p>
                      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{s.description}</p>
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-400">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500 flex-shrink-0"><path d="M11.71 18.36c.39.39 1.02.39 1.41 0L21.59 10c.78-.78.78-2.05 0-2.83-.78-.78-2.05-.78-2.83 0L13.42 12.5l-2.13-2.13c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l2.13 2.13.13.13c.39.39 1.02.39 1.41 0z"/></svg>
                        <span className="font-medium">{s.highlight}</span>
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#9333EA" className="flex-shrink-0 mt-1"><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 pt-0 text-center">
              <p className="text-[10px] text-gray-400">시연 도중 언제든 상단 중단 버튼이나 뒤로가기로 종료할 수 있어요</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
