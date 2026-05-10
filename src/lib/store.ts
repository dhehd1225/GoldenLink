import { Hospital, Dispatch, DispatchStatus, SymptomAnalysis, PatientInfo, Statistics } from './types';
import { mockHospitals } from './mock-data';

// ── Hospital Store ──
const hospitals: Hospital[] = JSON.parse(JSON.stringify(mockHospitals));

export function getHospitals(): Hospital[] {
  return hospitals;
}

export function getHospital(id: string): Hospital | undefined {
  return hospitals.find(h => h.id === id);
}

export function updateHospital(id: string, updates: Partial<Hospital>): Hospital | null {
  const index = hospitals.findIndex(h => h.id === id);
  if (index === -1) return null;
  hospitals[index] = { ...hospitals[index], ...updates, lastUpdated: new Date().toISOString() };

  // Log activity
  addActivity({
    type: 'hospital_updated',
    description: `${hospitals[index].name} 상태 업데이트`,
  });

  return hospitals[index];
}

// ── Dispatch Store ──
const dispatches: Dispatch[] = [];
let dispatchCounter = 0;

export function createDispatch(
  hospitalId: string,
  hospitalName: string,
  symptoms: SymptomAnalysis,
  symptomsText: string,
  estimatedTime: number,
  distance: number,
  patientInfo?: PatientInfo,
  cascadeIndex?: number,
  cascadeGroupId?: string,
): Dispatch | { error: string } {
  // 동시 배차 방지: 같은 병원에 pending 상태 요청이 있으면 경고
  const pendingCount = dispatches.filter(
    d => d.hospitalId === hospitalId && (d.status === 'pending' || d.status === 'accepted' || d.status === 'transporting')
  ).length;

  const hospital = getHospital(hospitalId);
  if (hospital && hospital.availableBeds <= pendingCount) {
    return { error: `현재 가용 병상(${hospital.availableBeds}개)이 부족합니다. 진행 중인 이송 ${pendingCount}건` };
  }

  // 응답 기한: KTAS에 따라 다르게 설정
  const deadlineMinutes = symptoms.ktasLevel <= 2 ? 3 : symptoms.ktasLevel <= 3 ? 5 : 10;
  const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);

  const dispatch: Dispatch = {
    id: `D${String(++dispatchCounter).padStart(4, '0')}`,
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
  dispatches.unshift(dispatch);

  // Log activity
  addActivity({
    type: 'dispatch_created',
    description: `KTAS ${symptoms.ktasLevel} 이송 요청 → ${hospitalName}`,
  });

  return dispatch;
}

export function getDispatches(hospitalId?: string): Dispatch[] {
  if (hospitalId) return dispatches.filter(d => d.hospitalId === hospitalId);
  return dispatches;
}

export function getDispatch(id: string): Dispatch | undefined {
  return dispatches.find(d => d.id === id);
}

export function updateDispatchStatus(
  id: string,
  status: DispatchStatus,
  rejectReason?: string,
): Dispatch | null {
  const dispatch = dispatches.find(d => d.id === id);
  if (!dispatch) return null;
  dispatch.status = status;
  dispatch.updatedAt = new Date().toISOString();
  if (rejectReason) dispatch.rejectReason = rejectReason;

  // Log activity
  addActivity({
    type: status === 'accepted' ? 'dispatch_accepted' : status === 'rejected' ? 'dispatch_rejected' : 'dispatch_created',
    description: `${dispatch.hospitalName}: ${dispatch.id} ${status === 'accepted' ? '수락' : status === 'rejected' ? '거절' : status}`,
  });

  return dispatch;
}

// ── Activity Log ──
interface ActivityEntry {
  id: string;
  type: 'dispatch_created' | 'dispatch_accepted' | 'dispatch_rejected' | 'hospital_updated';
  description: string;
  timestamp: string;
}

const activityLog: ActivityEntry[] = [];
let activityCounter = 0;

function addActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
  activityLog.unshift({
    ...entry,
    id: `A${String(++activityCounter).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
  });
  // Keep last 100 entries
  if (activityLog.length > 100) activityLog.length = 100;
}

// ── Statistics ──
export function getStatistics(): Statistics {
  const total = dispatches.length;
  const accepted = dispatches.filter(d => d.status === 'accepted' || d.status === 'transporting' || d.status === 'arrived').length;
  const rejected = dispatches.filter(d => d.status === 'rejected').length;
  const pending = dispatches.filter(d => d.status === 'pending').length;

  // Average response time (for completed dispatches)
  const respondedDispatches = dispatches.filter(d => d.status !== 'pending' && d.status !== 'cancelled');
  const avgResponseTime = respondedDispatches.length > 0
    ? respondedDispatches.reduce((sum, d) => {
        const created = new Date(d.createdAt).getTime();
        const updated = new Date(d.updatedAt).getTime();
        return sum + (updated - created) / 1000;
      }, 0) / respondedDispatches.length
    : 0;

  // KTAS distribution
  const ktasDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dispatches.forEach(d => {
    ktasDistribution[d.symptoms.ktasLevel] = (ktasDistribution[d.symptoms.ktasLevel] || 0) + 1;
  });

  // Hospital utilization
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
    const hospital = getHospital(id);
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

  // Hourly dispatches (last 24h)
  const hourlyDispatches = new Array(24).fill(0);
  const now = Date.now();
  dispatches.forEach(d => {
    const hoursAgo = Math.floor((now - new Date(d.createdAt).getTime()) / 3600000);
    if (hoursAgo < 24) hourlyDispatches[23 - hoursAgo]++;
  });

  // Average transport time
  const transportedDispatches = dispatches.filter(d => d.status === 'transporting' || d.status === 'arrived');
  const avgTransportTime = transportedDispatches.length > 0
    ? transportedDispatches.reduce((sum, d) => sum + d.estimatedTime, 0) / transportedDispatches.length
    : 0;

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
    recentActivity: activityLog.slice(0, 20),
  };
}
