import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '통계 · 운영 현황 — GoldenLink',
  description: 'KTAS 분포, 병원별 수락률, 시간대별 이송 요청 분석.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
