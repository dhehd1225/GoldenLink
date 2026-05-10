'use client';

import { useState, useEffect } from 'react';
import { Statistics, KTAS_INFO, KTASLevel } from '@/lib/types';
import Link from 'next/link';

function StatCard({ title, value, subtitle, color, icon }: {
  title: string; value: string | number; subtitle?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="card !p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black mt-1 stat-number" style={{ color }}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, max, label, color }: { data: number[]; max: number; label: string; color: string }) {
  const maxVal = Math.max(...data, 1);
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end gap-0.5 h-24">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t transition-all duration-500 min-h-[2px]"
              style={{
                height: `${maxVal > 0 ? (v / maxVal) * 100 : 0}%`,
                backgroundColor: v > 0 ? color : '#E2E8F0',
                opacity: v > 0 ? 1 : 0.3,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400">24h 전</span>
        <span className="text-[9px] text-gray-400">현재</span>
      </div>
      <p className="text-xs text-gray-400 text-center mt-0.5">최대 {max}건</p>
    </div>
  );
}

function KTASChart({ distribution }: { distribution: Record<number, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-2">
      {([1, 2, 3, 4, 5] as KTASLevel[]).map(level => {
        const ktas = KTAS_INFO[level];
        const count = distribution[level] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={level} className="flex items-center gap-3">
            <div className="w-16 flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ backgroundColor: ktas.color }}>{level}</div>
              <span className="text-xs font-bold" style={{ color: ktas.color }}>{ktas.label}</span>
            </div>
            <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: ktas.color }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600 w-8 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    fetch('/api/statistics')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col page-enter">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-5 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center active:scale-95 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">통계 대시보드</h1>
            <p className="text-gray-400 text-xs">GoldenLink 운영 현황</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/paramedic/input" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform">구급대원</Link>
            <Link href="/hospital/dashboard" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform">병원</Link>
          </div>
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 bg-green-400 rounded-full status-live" />
            <span className="text-xs font-medium">LIVE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full pb-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card !p-4">
                <div className="h-4 skeleton w-20 mb-2" />
                <div className="h-8 skeleton w-16 mb-1" />
                <div className="h-3 skeleton w-24" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                title="총 이송 요청"
                value={stats.totalDispatches}
                subtitle={`대기 ${stats.pendingDispatches}건`}
                color="#2563EB"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/></svg>}
              />
              <StatCard
                title="수락됨"
                value={stats.acceptedDispatches}
                subtitle={stats.totalDispatches > 0 ? `${Math.round((stats.acceptedDispatches / stats.totalDispatches) * 100)}%` : '-'}
                color="#16A34A"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>}
              />
              <StatCard
                title="거절됨"
                value={stats.rejectedDispatches}
                subtitle={stats.totalDispatches > 0 ? `${Math.round((stats.rejectedDispatches / stats.totalDispatches) * 100)}%` : '-'}
                color="#DC2626"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>}
              />
              <StatCard
                title="평균 응답"
                value={stats.averageResponseTime > 0 ? `${stats.averageResponseTime}초` : '-'}
                subtitle="응답 시간"
                color="#7C3AED"
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* KTAS Distribution */}
              <div className="card !p-4">
                <h3 className="font-bold text-sm mb-3">KTAS 등급 분포</h3>
                <KTASChart distribution={stats.ktasDistribution} />
                {stats.totalDispatches === 0 && (
                  <p className="text-xs text-gray-400 text-center mt-4">아직 이송 데이터가 없습니다</p>
                )}
              </div>

              {/* Hourly Chart */}
              <div className="card !p-4">
                <h3 className="font-bold text-sm mb-3">시간대별 이송 요청 (24시간)</h3>
                <BarChart
                  data={stats.hourlyDispatches}
                  max={Math.max(...stats.hourlyDispatches)}
                  label=""
                  color="#2563EB"
                />
                {stats.totalDispatches === 0 && (
                  <p className="text-xs text-gray-400 text-center mt-2">아직 이송 데이터가 없습니다</p>
                )}
              </div>
            </div>

            {/* Hospital Utilization */}
            <div className="card !p-4">
              <h3 className="font-bold text-sm mb-3">병원별 이용 현황</h3>
              {stats.hospitalUtilization.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 border-b border-gray-100">
                        <th className="text-left py-2 font-medium">병원</th>
                        <th className="text-center py-2 font-medium">요청</th>
                        <th className="text-center py-2 font-medium">수락</th>
                        <th className="text-center py-2 font-medium">거절</th>
                        <th className="text-center py-2 font-medium">수락률</th>
                        <th className="text-center py-2 font-medium">병상</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.hospitalUtilization.map(h => (
                        <tr key={h.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 font-semibold text-gray-800 text-xs">{h.name}</td>
                          <td className="text-center py-2 font-bold text-blue-600">{h.totalRequests}</td>
                          <td className="text-center py-2 font-bold text-green-600">{h.accepted}</td>
                          <td className="text-center py-2 font-bold text-red-500">{h.rejected}</td>
                          <td className="text-center py-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                              h.totalRequests > 0 && (h.accepted / h.totalRequests) >= 0.7
                                ? 'bg-green-50 text-green-700'
                                : h.totalRequests > 0 && (h.accepted / h.totalRequests) >= 0.4
                                ? 'bg-amber-50 text-amber-700'
                                : h.totalRequests > 0
                                ? 'bg-red-50 text-red-700'
                                : 'bg-gray-50 text-gray-400'
                            }`}>
                              {h.totalRequests > 0 ? `${Math.round((h.accepted / h.totalRequests) * 100)}%` : '-'}
                            </span>
                          </td>
                          <td className="text-center py-2">
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[60px] mx-auto">
                              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${h.bedUtilization}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">아직 이송 데이터가 없습니다</p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="card !p-4">
              <h3 className="font-bold text-sm mb-3">최근 활동</h3>
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-1">
                  {stats.recentActivity.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-1.5 border-t border-gray-50 first:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        a.type === 'dispatch_created' ? 'bg-blue-500' :
                        a.type === 'dispatch_accepted' ? 'bg-green-500' :
                        a.type === 'dispatch_rejected' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`} />
                      <p className="text-xs text-gray-600 flex-1">{a.description}</p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {new Date(a.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">활동 내역이 없습니다</p>
              )}
            </div>

            {/* System Info */}
            <div className="card !p-4 bg-gray-50">
              <h3 className="font-bold text-sm mb-2 text-gray-600">시스템 정보</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-gray-400">데이터 소스</p>
                  <p className="font-semibold text-gray-700">In-Memory (Mock)</p>
                </div>
                <div>
                  <p className="text-gray-400">AI 엔진</p>
                  <p className="font-semibold text-gray-700">Claude API</p>
                </div>
                <div>
                  <p className="text-gray-400">갱신 주기</p>
                  <p className="font-semibold text-gray-700">10초</p>
                </div>
                <div>
                  <p className="text-gray-400">지도 API</p>
                  <p className="font-semibold text-gray-700">Naver Maps</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">통계 데이터를 불러올 수 없습니다.</div>
        )}
      </main>
    </div>
  );
}
