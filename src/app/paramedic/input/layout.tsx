import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '구급대원 증상 입력 — GoldenLink',
  description: '환자 정보와 증상을 음성으로 한 번에 입력하면 AI가 KTAS 등급을 자동 분류합니다.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
