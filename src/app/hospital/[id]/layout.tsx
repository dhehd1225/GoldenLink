import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '병원 상세 — GoldenLink',
  description: '병원 가용 자원, 전문의, 시설 정보.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
