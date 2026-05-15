import { Hospital, Dispatch, DispatchStatus, SymptomAnalysis, PatientInfo, Statistics } from './types';
import { mockHospitals } from './mock-data';
import { getSupabase } from './supabase';

// ── Row types (snake_case as in DB) ──

interface DbHospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  available_beds: number;
  total_beds: number;
  congestion_level: 'low' | 'medium' | 'high';
  available_specialties: string[];
  specialists: Record<string, boolean>;
  operating_rooms: { total: number; available: number };
  facilities: string[];
  is_l2_registered: boolean;
  last_updated: string;
}

interface DbDispatch {
  id: string;
  hospital_id: string;
  hospital_name: string;
  symptoms: SymptomAnalysis;
  symptoms_text: string;
  patient_info: PatientInfo | null;
  status: DispatchStatus;
  created_at: string;
  updated_at: string;
  estimated_time: number;
  distance: number;
  reject_reason: string | null;
  cascade_index: number | null;
  cascade_group_id: string | null;
  response_deadline: string | null;
}

function rowToHospital(d: DbHospital): Hospital {
  return {
    id: d.id,
    name: d.name,
    lat: d.lat,
    lng: d.lng,
    address: d.address,
    phone: d.phone,
    availableBeds: d.available_beds,
    totalBeds: d.total_beds,
    congestionLevel: d.congestion_level,
    availableSpecialties: d.available_specialties,
    specialists: d.specialists,
    operatingRooms: d.operating_rooms,
    facilities: d.facilities,
    isL2Registered: d.is_l2_registered,
    lastUpdated: d.last_updated,
  };
}

function hospitalUpdatesToRow(u: Partial<Hospital>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  if ('name' in u) r.name = u.name;
  if ('lat' in u) r.lat = u.lat;
  if ('lng' in u) r.lng = u.lng;
  if ('address' in u) r.address = u.address;
  if ('phone' in u) r.phone = u.phone;
  if ('availableBeds' in u) r.available_beds = u.availableBeds;
  if ('totalBeds' in u) r.total_beds = u.totalBeds;
  if ('congestionLevel' in u) r.congestion_level = u.congestionLevel;
  if ('availableSpecialties' in u) r.available_specialties = u.availableSpecialties;
  if ('specialists' in u) r.specialists = u.specialists;
  if ('operatingRooms' in u) r.operating_rooms = u.operatingRooms;
  if ('facilities' in u) r.facilities = u.facilities;
  if ('isL2Registered' in u) r.is_l2_registered = u.isL2Registered;
  return r;
}

function rowToDispatch(d: DbDispatch): Dispatch {
  return {
    id: d.id,
    hospitalId: d.hospital_id,
    hospitalName: d.hospital_name,
    symptoms: d.symptoms,
    symptomsText: d.symptoms_text,
    patientInfo: d.patient_info ?? undefined,
    status: d.status,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    estimatedTime: d.estimated_time,
    distance: d.distance,
    rejectReason: d.reject_reason ?? undefined,
    cascadeIndex: d.cascade_index ?? undefined,
    cascadeGroupId: d.cascade_group_id ?? undefined,
    responseDeadline: d.response_deadline ?? undefined,
  };
}

// ── In-memory fallback (env가 안 채워졌을 때만) ──
// globalThis에 저장하여 Next.js HMR 시 데이터 유지

interface MemActivity {
  id: string;
  type: 'dispatch_created' | 'dispatch_accepted' | 'dispatch_rejected' | 'hospital_updated';
  description: string;
  timestamp: string;
}

interface MemStore {
  hospitals: Hospital[];
  dispatches: Dispatch[];
  dispatchCounter: number;
  activity: MemActivity[];
  activityCounter: number;
}

const g = globalThis as unknown as { __goldenlink_mem?: MemStore };
if (!g.__goldenlink_mem) {
  g.__goldenlink_mem = {
    hospitals: JSON.parse(JSON.stringify(mockHospitals)),
    dispatches: [],
    dispatchCounter: 0,
    activity: [],
    activityCounter: 0,
  };
}
const mem = g.__goldenlink_mem;
const memHospitals = mem.hospitals;
const memDispatches = mem.dispatches;
const memActivity = mem.activity;

function genDispatchId(): string {
  return `D${Date.now().toString(36).slice(-5).toUpperCase()}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
}

async function addActivity(type: MemActivity['type'], description: string) {
  const sb = getSupabase();
  if (!sb) {
    memActivity.unshift({
      id: `A${String(++mem.activityCounter).padStart(4, '0')}`,
      type,
      description,
      timestamp: new Date().toISOString(),
    });
    if (memActivity.length > 100) memActivity.length = 100;
    return;
  }
  await sb.from('activity_log').insert({ type, description });
}

// ── Hospital store ──

export async function getHospitals(): Promise<Hospital[]> {
  const sb = getSupabase();
  if (!sb) return memHospitals;
  const { data, error } = await sb.from('hospitals').select('*').order('name');
  if (error) {
    console.error('getHospitals error', error);
    return [];
  }
  return (data as DbHospital[]).map(rowToHospital);
}

export async function getHospital(id: string): Promise<Hospital | null> {
  const sb = getSupabase();
  if (!sb) return memHospitals.find(h => h.id === id) ?? null;
  const { data, error } = await sb.from('hospitals').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToHospital(data as DbHospital);
}

export async function updateHospital(id: string, updates: Partial<Hospital>): Promise<Hospital | null> {
  const sb = getSupabase();
  if (!sb) {
    const idx = memHospitals.findIndex(h => h.id === id);
    if (idx === -1) return null;
    memHospitals[idx] = { ...memHospitals[idx], ...updates, lastUpdated: new Date().toISOString() };
    await addActivity('hospital_updated', `${memHospitals[idx].name} 상태 업데이트`);
    return memHospitals[idx];
  }
  const row = { ...hospitalUpdatesToRow(updates), last_updated: new Date().toISOString() };
  const { data, error } = await sb.from('hospitals').update(row).eq('id', id).select().single();
  if (error || !data) return null;
  const updated = rowToHospital(data as DbHospital);
  await addActivity('hospital_updated', `${updated.name} 상태 업데이트`);
  return updated;
}

// ── Dispatch store ──

export async function createDispatch(
  hospitalId: string,
  hospitalName: string,
  symptoms: SymptomAnalysis,
  symptomsText: string,
  estimatedTime: number,
  distance: number,
  patientInfo?: PatientInfo,
  cascadeIndex?: number,
  cascadeGroupId?: string,
): Promise<Dispatch | { error: string }> {
  const sb = getSupabase();

  // 동시 배차 방지 체크
  let pendingCount = 0;
  if (sb) {
    const { count } = await sb
      .from('dispatches')
      .select('*', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .in('status', ['pending', 'accepted', 'transporting']);
    pendingCount = count ?? 0;
  } else {
    pendingCount = memDispatches.filter(
      d => d.hospitalId === hospitalId && (d.status === 'pending' || d.status === 'accepted' || d.status === 'transporting'),
    ).length;
  }

  const hospital = await getHospital(hospitalId);
  if (hospital && hospital.availableBeds <= pendingCount) {
    return { error: `현재 가용 병상(${hospital.availableBeds}개)이 부족합니다. 진행 중인 이송 ${pendingCount}건` };
  }

  const deadlineMinutes = symptoms.ktasLevel <= 2 ? 3 : symptoms.ktasLevel <= 3 ? 5 : 10;
  const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);

  if (!sb) {
    const dispatch: Dispatch = {
      id: `D${String(++mem.dispatchCounter).padStart(4, '0')}`,
      hospitalId,
      hospitalName,
      symptoms,
      symptomsText,
      patientInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedTime,
      distance,
      cascadeIndex,
      cascadeGroupId,
      responseDeadline: deadline.toISOString(),
    };
    memDispatches.unshift(dispatch);
    await addActivity('dispatch_created', `KTAS ${symptoms.ktasLevel} 이송 요청 → ${hospitalName}`);
    return dispatch;
  }

  const id = genDispatchId();
  const { data, error } = await sb
    .from('dispatches')
    .insert({
      id,
      hospital_id: hospitalId,
      hospital_name: hospitalName,
      symptoms,
      symptoms_text: symptomsText,
      patient_info: patientInfo ?? null,
      status: 'pending',
      estimated_time: estimatedTime,
      distance,
      cascade_index: cascadeIndex ?? null,
      cascade_group_id: cascadeGroupId ?? null,
      response_deadline: deadline.toISOString(),
    })
    .select()
    .single();

  if (error || !data) return { error: error?.message ?? '이송 요청 생성 실패' };
  await addActivity('dispatch_created', `KTAS ${symptoms.ktasLevel} 이송 요청 → ${hospitalName}`);
  return rowToDispatch(data as DbDispatch);
}

export async function getDispatches(hospitalId?: string): Promise<Dispatch[]> {
  const sb = getSupabase();
  if (!sb) {
    if (hospitalId) return memDispatches.filter(d => d.hospitalId === hospitalId);
    return memDispatches;
  }
  let query = sb.from('dispatches').select('*').order('created_at', { ascending: false });
  if (hospitalId) query = query.eq('hospital_id', hospitalId);
  const { data, error } = await query;
  if (error) {
    console.error('getDispatches error', error);
    return [];
  }
  if (!data) return [];
  return (data as DbDispatch[]).map(rowToDispatch);
}

export async function getDispatch(id: string): Promise<Dispatch | null> {
  const sb = getSupabase();
  if (!sb) return memDispatches.find(d => d.id === id) ?? null;
  const { data, error } = await sb.from('dispatches').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToDispatch(data as DbDispatch);
}

export async function updateDispatchStatus(
  id: string,
  status: DispatchStatus,
  rejectReason?: string,
): Promise<Dispatch | null> {
  const sb = getSupabase();
  if (!sb) {
    const dispatch = memDispatches.find(d => d.id === id);
    if (!dispatch) return null;
    dispatch.status = status;
    dispatch.updatedAt = new Date().toISOString();
    if (rejectReason) dispatch.rejectReason = rejectReason;
    await addActivity(
      status === 'accepted' ? 'dispatch_accepted' : status === 'rejected' ? 'dispatch_rejected' : 'dispatch_created',
      `${dispatch.hospitalName}: ${dispatch.id} ${status === 'accepted' ? '수락' : status === 'rejected' ? '거절' : status}`,
    );
    return dispatch;
  }
  const updateRow: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (rejectReason) updateRow.reject_reason = rejectReason;
  const { data, error } = await sb.from('dispatches').update(updateRow).eq('id', id).select().single();
  if (error || !data) return null;
  const updated = rowToDispatch(data as DbDispatch);
  await addActivity(
    status === 'accepted' ? 'dispatch_accepted' : status === 'rejected' ? 'dispatch_rejected' : 'dispatch_created',
    `${updated.hospitalName}: ${updated.id} ${status === 'accepted' ? '수락' : status === 'rejected' ? '거절' : status}`,
  );
  return updated;
}

// ── Statistics ──

export async function getStatistics(): Promise<Statistics> {
  const dispatches = await getDispatches();
  const hospitals = await getHospitals();

  const total = dispatches.length;
  const accepted = dispatches.filter(d => d.status === 'accepted' || d.status === 'transporting' || d.status === 'arrived').length;
  const rejected = dispatches.filter(d => d.status === 'rejected').length;
  const pending = dispatches.filter(d => d.status === 'pending').length;

  const respondedDispatches = dispatches.filter(d => d.status !== 'pending' && d.status !== 'cancelled');
  const avgResponseTime = respondedDispatches.length > 0
    ? Math.max(0, respondedDispatches.reduce((sum, d) => sum + Math.max(0, (new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime())) / 1000, 0) / respondedDispatches.length)
    : 0;

  const ktasDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dispatches.forEach(d => {
    ktasDistribution[d.symptoms.ktasLevel] = (ktasDistribution[d.symptoms.ktasLevel] || 0) + 1;
  });

  const hospitalStats = new Map<string, { name: string; total: number; accepted: number; rejected: number; responseTimes: number[] }>();
  dispatches.forEach(d => {
    if (!hospitalStats.has(d.hospitalId)) {
      hospitalStats.set(d.hospitalId, { name: d.hospitalName, total: 0, accepted: 0, rejected: 0, responseTimes: [] });
    }
    const stat = hospitalStats.get(d.hospitalId)!;
    stat.total++;
    if (d.status === 'accepted' || d.status === 'transporting' || d.status === 'arrived') stat.accepted++;
    if (d.status === 'rejected') stat.rejected++;
    if (d.status !== 'pending') {
      stat.responseTimes.push((new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime()) / 1000);
    }
  });

  const hospitalUtilization = Array.from(hospitalStats.entries()).map(([id, stat]) => {
    const hospital = hospitals.find(h => h.id === id);
    return {
      id,
      name: stat.name,
      totalRequests: stat.total,
      accepted: stat.accepted,
      rejected: stat.rejected,
      avgResponseTime: stat.responseTimes.length > 0
        ? stat.responseTimes.reduce((a, b) => a + b, 0) / stat.responseTimes.length
        : 0,
      bedUtilization: hospital
        ? ((hospital.totalBeds - hospital.availableBeds) / hospital.totalBeds) * 100
        : 0,
    };
  });

  const hourlyDispatches = new Array(24).fill(0);
  const now = Date.now();
  dispatches.forEach(d => {
    const hoursAgo = Math.floor((now - new Date(d.createdAt).getTime()) / 3600000);
    if (hoursAgo < 24) hourlyDispatches[23 - hoursAgo]++;
  });

  const transportedDispatches = dispatches.filter(d => d.status === 'transporting' || d.status === 'arrived');
  const avgTransportTime = transportedDispatches.length > 0
    ? transportedDispatches.reduce((sum, d) => sum + d.estimatedTime, 0) / transportedDispatches.length
    : 0;

  // Recent activity
  const sb = getSupabase();
  let recentActivity: Statistics['recentActivity'] = [];
  if (!sb) {
    recentActivity = memActivity.slice(0, 20).map(a => ({ id: a.id, type: a.type, description: a.description, timestamp: a.timestamp }));
  } else {
    const { data } = await sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) {
      recentActivity = (data as Array<{ id: number; type: string; description: string; created_at: string }>).map(a => ({
        id: `A${a.id}`,
        type: a.type as 'dispatch_created' | 'dispatch_accepted' | 'dispatch_rejected' | 'hospital_updated',
        description: a.description,
        timestamp: a.created_at,
      }));
    }
  }

  return {
    totalDispatches: total,
    acceptedDispatches: accepted,
    rejectedDispatches: rejected,
    pendingDispatches: pending,
    averageResponseTime: Math.round(avgResponseTime),
    averageTransportTime: Math.round(avgTransportTime),
    ktasDistribution,
    hospitalUtilization,
    hourlyDispatches,
    recentActivity,
  };
}
