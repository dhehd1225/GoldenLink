import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '병원 대시보드 — GoldenLink',
  description: '응급 코디네이터: 이송 요청 실시간 수신 · 가용 병상·전문의·수술실 관리.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
