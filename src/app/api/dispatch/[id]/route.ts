import { NextRequest, NextResponse } from 'next/server';
import { getDispatch, updateDispatchStatus } from '@/lib/store';
import { DispatchStatus } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = params instanceof Promise ? await params : params;
  const dispatch = getDispatch(id);
  if (!dispatch) return NextResponse.json({ error: '이송 요청을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(dispatch);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const { id } = params instanceof Promise ? await params : params;
  const { status, rejectReason } = await req.json() as { status: DispatchStatus; rejectReason?: string };

  const dispatch = updateDispatchStatus(id, status, rejectReason);
  if (!dispatch) return NextResponse.json({ error: '이송 요청을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json(dispatch);
}
