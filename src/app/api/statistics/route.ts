import { NextResponse } from 'next/server';
import { getStatistics } from '@/lib/store';

// Supabase에서 실시간 데이터를 읽어야 하므로 정적 prerender 비활성화
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getStatistics());
}
