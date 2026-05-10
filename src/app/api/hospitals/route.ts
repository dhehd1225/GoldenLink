import { NextResponse } from 'next/server';
import { getHospitals } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getHospitals());
}
