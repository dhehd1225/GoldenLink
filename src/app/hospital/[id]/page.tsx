'use client';

import { useState, useEffect } from 'react';
import { Hospital } from '@/lib/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const CONGESTION_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  low: { text: '여유', color: '#16A34A', bg: '#DCFCE7' },
  medium: { text: '보통', color: '#CA8A04', bg: '#FEF9C3' },
  high: { text: '혼잡', color: '#DC2626', bg: '#FEE2E2' },
};

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/hospital/${id}`)
      .then(r => r.json())
      .then(data => { setHospital(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="animate-spin h-8 w-8 text-gray-300" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">병원을 찾을 수 없습니다.</p>
          <Link href="/" className="text-blue-600 font-bold hover:underline">돌아가기</Link>
        </div>
      </div>
    );
  }

  const congestion = CONGESTION_LABEL[hospital.congestionLevel];
  const bedRatio = hospital.totalBeds > 0 ? (hospital.availableBeds / hospital.totalBeds) * 100 : 0;
  const activeSpecialties = Object.entries(hospital.specialists).filter(([, v]) => v).map(([k]) => k);
  const inactiveSpecialties = Object.entries(hospital.specialists).filter(([, v]) => !v).map(([k]) => k);

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      <header className="bg-white border-b border-gray-200 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 -ml-2 active:bg-gray-100 rounded-xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#6B7280"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-gray-900">{hospital.name}</h1>
            <p className="text-xs text-gray-400">{hospital.address}</p>
          </div>
          <a href={`tel:${hospital.phone}`} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            전화
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Quick Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card !p-4 text-center">
            <p className="text-3xl font-black text-blue-600">{hospital.availableBeds}</p>
            <p className="text-xs text-gray-400 mt-0.5">가용 병상</p>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full rounded-full transition-all" style={{
                width: `${bedRatio}%`,
                backgroundColor: bedRatio > 50 ? '#16A34A' : bedRatio > 20 ? '#CA8A04' : '#DC2626'
              }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">총 {hospital.totalBeds}개</p>
          </div>
          <div className="card !p-4 text-center">
            <p className="text-3xl font-black" style={{ color: congestion.color }}>{congestion.text}</p>
            <p className="text-xs text-gray-400 mt-0.5">혼잡도</p>
            <div className="mt-2 px-3 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: congestion.bg, color: congestion.color }}>
              {hospital.congestionLevel === 'low' ? '원활' : hospital.congestionLevel === 'medium' ? '보통' : '혼잡'}
            </div>
          </div>
          <div className="card !p-4 text-center">
            <p className="text-3xl font-black text-green-600">{hospital.operatingRooms.available}</p>
            <p className="text-xs text-gray-400 mt-0.5">가용 수술실</p>
            <p className="text-sm text-gray-500 mt-2">총 {hospital.operatingRooms.total}개</p>
          </div>
        </div>

        {/* Available Specialists */}
        <div className="card !p-5">
          <h3 className="font-bold text-sm mb-3">가용 전문의</h3>
          <div className="flex flex-wrap gap-2">
            {activeSpecialties.map(spec => (
              <span key={spec} className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold border border-blue-100">
                {spec}
              </span>
            ))}
          </div>
          {inactiveSpecialties.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mt-3 mb-1.5">비가용</p>
              <div className="flex flex-wrap gap-2">
                {inactiveSpecialties.map(spec => (
                  <span key={spec} className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-semibold line-through">
                    {spec}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Facilities */}
        <div className="card !p-5">
          <h3 className="font-bold text-sm mb-3">보유 시설</h3>
          <div className="grid grid-cols-3 gap-2">
            {hospital.facilities.map(f => (
              <div key={f} className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#16A34A"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                <span className="text-xs font-semibold text-green-700">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="card !p-5 space-y-3">
          <h3 className="font-bold text-sm">기본 정보</h3>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">주소</span>
              <span className="font-semibold text-gray-800">{hospital.address}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">전화번호</span>
              <a href={`tel:${hospital.phone}`} className="font-semibold text-blue-600">{hospital.phone}</a>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">실시간 정보</span>
              <span className={`font-semibold ${hospital.isL2Registered ? 'text-green-600' : 'text-red-500'}`}>
                {hospital.isL2Registered ? '등록됨' : '미등록'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-500">최종 업데이트</span>
              <span className="font-semibold text-gray-800">{new Date(hospital.lastUpdated).toLocaleString('ko-KR')}</span>
            </div>
          </div>
        </div>

        {/* Operating Rooms */}
        <div className="card !p-5">
          <h3 className="font-bold text-sm mb-3">수술실 현황</h3>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: hospital.operatingRooms.total }).map((_, i) => {
              const isAvail = i < hospital.operatingRooms.available;
              return (
                <div key={i} className={`aspect-square rounded-xl flex flex-col items-center justify-center border-2 ${
                  isAvail ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-200 text-red-400'
                }`}>
                  <span className="text-lg font-black">OR{i + 1}</span>
                  <span className="text-[10px] font-bold">{isAvail ? '가용' : '사용중'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
