import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'GoldenLink - 지능형 응급 병원 매칭 시스템',
  description: 'AI 기반 응급 환자 증상 분석 및 최적 병원 매칭 시스템. 골든타임을 지키는 스마트 이송 플랫폼.',
  keywords: ['응급의료', 'AI', '병원 매칭', 'KTAS', '골든타임', '구급대원', '이송 시스템'],
  authors: [{ name: 'GoldenLink Team' }],
  openGraph: {
    title: 'GoldenLink - 골든타임, AI가 지킵니다',
    description: '증상 분석부터 병원 매칭, 이송 요청까지 한 번에 연결하는 지능형 응급 시스템',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 접근성: 사용자 확대 허용 (WCAG 1.4.4 — 시각 약자가 화면 200%까지 확대 가능)
  themeColor: '#DC2626',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
