import { NextRequest, NextResponse } from 'next/server';
import { getHospital, updateHospital } from '@/lib/store';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = params instanceof Promise ? await params : params;
  const hospital = getHospital(id);
  if (!hospital) return NextResponse.json({ error: '병원을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(hospital);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = params instanceof Promise ? await params : params;
  const updates = await req.json();
  const hospital = updateHospital(id, updates);
  if (!hospital) return NextResponse.json({ error: '병원을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(hospital);
}
