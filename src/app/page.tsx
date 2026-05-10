'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
              <h1 className="text-base font-black text-gray-900 tracking-tight leading-none">GoldenLink</h1>
              <p className="text-[10px] text-gray-400 font-medium">응급 병원 매칭 시스템</p>
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
    </div>
  );
}
