import { NextResponse } from 'next/server';
import { getStatistics } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getStatistics());
}
