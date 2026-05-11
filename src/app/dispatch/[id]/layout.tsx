import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이송 요청서 — GoldenLink',
  description: '환자 정보 + AI 분류 + 매칭 근거가 포함된 이송 요청 공식 문서 (인쇄 가능).',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
