import { NextRequest, NextResponse } from 'next/server';
import { getHospitals } from '@/lib/store';
import { matchHospitals } from '@/lib/matching';
import { SymptomAnalysis } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { symptoms, lat, lng } = await req.json() as {
    symptoms: SymptomAnalysis;
    lat: number;
    lng: number;
  };

  if (!symptoms || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'symptoms, lat, lng 필수' }, { status: 400 });
  }

  const hospitals = await getHospitals();
  const matched = matchHospitals(hospitals, symptoms, lat, lng);
  return NextResponse.json(matched);
}
