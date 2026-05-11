import { NextRequest, NextResponse } from 'next/server';
import { createDispatch, getDispatches } from '@/lib/store';

export async function GET(req: NextRequest) {
  const hospitalId = req.nextUrl.searchParams.get('hospitalId') || undefined;
  return NextResponse.json(await getDispatches(hospitalId));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { hospitalId, hospitalName, symptoms, symptomsText, estimatedTime, distance, patientInfo, cascadeIndex, cascadeGroupId } = body;

  if (!hospitalId || !symptoms) {
    return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
  }

  const result = await createDispatch(
    hospitalId,
    hospitalName,
    symptoms,
    symptomsText,
    estimatedTime,
    distance,
    patientInfo,
    cascadeIndex,
    cascadeGroupId,
  );

  if ('error' in result) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result, { status: 201 });
}
