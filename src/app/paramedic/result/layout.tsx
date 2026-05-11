import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '병원 추천 결과 — GoldenLink',
  description: 'AI 분류와 진료과·거리·병상·시설을 종합한 최적 병원 매칭. 캐스케이드 자동 이송 요청.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
