'use client';

import { useState, useEffect } from 'react';
import { Dispatch, KTAS_INFO, KTASLevel, CONSCIOUSNESS_LABELS } from '@/lib/types';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '대기 중', color: '#CA8A04', bg: '#FEF9C3' },
    accepted: { label: '수락됨', color: '#16A34A', bg: '#DCFCE7' },
    rejected: { label: '거절됨', color: '#DC2626', bg: '#FEE2E2' },
    transporting: { label: '이송 중', color: '#2563EB', bg: '#DBEAFE' },
    arrived: { label: '도착', color: '#16A34A', bg: '#DCFCE7' },
    cancelled: { label: '취소', color: '#6B7280', bg: '#F3F4F6' },
  };
  const c = config[status] || config.cancelled;
  return (
    <span className="px-3 py-1.5 rounded-xl text-sm font-bold" style={{ backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

export default function DispatchReportPage() {
  const { id } = useParams<{ id: string }>();
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/dispatch/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => { setDispatch(data); setLoading(false); })
      .catch(() => { setError('이송 요청을 찾을 수 없습니다.'); setLoading(false); });
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

  if (error || !dispatch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error}</p>
          <Link href="/paramedic/input" className="text-blue-600 font-bold hover:underline">돌아가기</Link>
        </div>
      </div>
    );
  }

  const ktas = KTAS_INFO[dispatch.symptoms.ktasLevel as KTASLevel];
  const createdDate = new Date(dispatch.createdAt);
  const updatedDate = new Date(dispatch.updatedAt);
  const responseTime = Math.round((updatedDate.getTime() - createdDate.getTime()) / 1000);

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-4 print:border-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/paramedic/input" className="p-2 -ml-2 active:bg-gray-100 rounded-xl print:hidden">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#6B7280"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </Link>
            <div>
              <h1 className="font-bold text-lg text-gray-900">이송 요청서</h1>
              <p className="text-xs text-gray-400">{dispatch.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={dispatch.status} />
            <button onClick={() => window.print()} className="print:hidden p-2 active:bg-gray-100 rounded-xl">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#6B7280"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-5 space-y-4">
        {/* KTAS Info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center" style={{ backgroundColor: ktas.bg }}>
              <span className="text-2xl font-black" style={{ color: ktas.color }}>{dispatch.symptoms.ktasLevel}</span>
              <span className="text-[9px] font-bold" style={{ color: ktas.color }}>KTAS</span>
            </div>
            <div>
              <h2 className="text-xl font-black" style={{ color: ktas.color }}>{ktas.label}</h2>
              <p className="text-sm text-gray-500">{ktas.description}</p>
            </div>
          </div>
        </div>

        {/* Dispatch Details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-bold text-sm text-gray-800 border-b border-gray-100 pb-2">이송 정보</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 font-bold">대상 병원</p>
              <p className="font-semibold text-gray-800">{dispatch.hospitalName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold">거리 / 예상 시간</p>
              <p className="font-semibold text-gray-800">{dispatch.distance}km / {dispatch.estimatedTime}분</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold">요청 시각</p>
              <p className="font-semibold text-gray-800">{createdDate.toLocaleString('ko-KR')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold">응답 시각</p>
              <p className="font-semibold text-gray-800">
                {dispatch.status !== 'pending' ? updatedDate.toLocaleString('ko-KR') : '-'}
              </p>
            </div>
            {dispatch.status !== 'pending' && (
              <div>
                <p className="text-xs text-gray-400 font-bold">응답 시간</p>
                <p className="font-semibold text-gray-800">{responseTime}초</p>
              </div>
            )}
            {dispatch.rejectReason && (
              <div>
                <p className="text-xs text-gray-400 font-bold">거절 사유</p>
                <p className="font-semibold text-red-600">{dispatch.rejectReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Symptoms */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-bold text-sm text-gray-800 border-b border-gray-100 pb-2">증상 정보</h3>
          {dispatch.symptomsText && (
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1">구급대원 보고</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{dispatch.symptomsText}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1">의심 질환</p>
              <div className="flex flex-wrap gap-1.5">
                {dispatch.symptoms.suspectedConditions.map(c => (
                  <span key={c} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">{c}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1">필요 진료과</p>
              <div className="flex flex-wrap gap-1.5">
                {dispatch.symptoms.requiredSpecialties.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">{s}</span>
                ))}
              </div>
            </div>
          </div>
          {dispatch.symptoms.requiredFacilities.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-bold mb-1">필요 시설</p>
              <div className="flex flex-wrap gap-1.5">
                {dispatch.symptoms.requiredFacilities.map(f => (
                  <span key={f} className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold">{f}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-400 font-bold mb-1">AI 분석 근거</p>
            <p className="text-sm text-gray-600">{dispatch.symptoms.reasoning}</p>
          </div>
        </div>

        {/* Patient Info */}
        {dispatch.patientInfo && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-bold text-sm text-gray-800 border-b border-gray-100 pb-2">환자 정보</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {dispatch.patientInfo.age && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">나이</p>
                  <p className="font-semibold text-gray-800">{dispatch.patientInfo.age}세</p>
                </div>
              )}
              {dispatch.patientInfo.gender !== 'unknown' && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">성별</p>
                  <p className="font-semibold text-gray-800">{dispatch.patientInfo.gender === 'male' ? '남성' : '여성'}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 font-bold">의식 수준</p>
                <p className="font-semibold" style={{ color: CONSCIOUSNESS_LABELS[dispatch.patientInfo.consciousnessLevel].color }}>
                  {CONSCIOUSNESS_LABELS[dispatch.patientInfo.consciousnessLevel].label}
                </p>
              </div>
              {dispatch.patientInfo.bloodPressureSystolic && dispatch.patientInfo.bloodPressureDiastolic && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">혈압</p>
                  <p className="font-semibold text-gray-800">{dispatch.patientInfo.bloodPressureSystolic}/{dispatch.patientInfo.bloodPressureDiastolic} mmHg</p>
                </div>
              )}
              {dispatch.patientInfo.heartRate && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">심박수</p>
                  <p className="font-semibold text-gray-800">{dispatch.patientInfo.heartRate} bpm</p>
                </div>
              )}
              {dispatch.patientInfo.oxygenSaturation && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">산소포화도</p>
                  <p className={`font-semibold ${dispatch.patientInfo.oxygenSaturation < 94 ? 'text-red-600' : 'text-gray-800'}`}>
                    {dispatch.patientInfo.oxygenSaturation}%
                  </p>
                </div>
              )}
              {dispatch.patientInfo.temperature && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">체온</p>
                  <p className={`font-semibold ${dispatch.patientInfo.temperature >= 38 ? 'text-red-600' : 'text-gray-800'}`}>
                    {dispatch.patientInfo.temperature}°C
                  </p>
                </div>
              )}
              {dispatch.patientInfo.respiratoryRate && (
                <div>
                  <p className="text-xs text-gray-400 font-bold">호흡수</p>
                  <p className="font-semibold text-gray-800">{dispatch.patientInfo.respiratoryRate}/min</p>
                </div>
              )}
            </div>
            {dispatch.patientInfo.allergies && (
              <div>
                <p className="text-xs text-gray-400 font-bold">알레르기</p>
                <p className="text-sm text-gray-800">{dispatch.patientInfo.allergies}</p>
              </div>
            )}
            {dispatch.patientInfo.medications && (
              <div>
                <p className="text-xs text-gray-400 font-bold">복용 약물</p>
                <p className="text-sm text-gray-800">{dispatch.patientInfo.medications}</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4 print:py-8">
          <p>GoldenLink 지능형 응급 병원 매칭 시스템</p>
          <p>이 문서는 자동 생성되었습니다. {new Date().toLocaleString('ko-KR')}</p>
        </div>
      </main>
    </div>
  );
}
