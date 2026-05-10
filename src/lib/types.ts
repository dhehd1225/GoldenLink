export type KTASLevel = 1 | 2 | 3 | 4 | 5;

export const KTAS_INFO: Record<KTASLevel, { label: string; color: string; bg: string; description: string }> = {
  1: { label: '소생', color: '#DC2626', bg: '#FEE2E2', description: '즉각적 생명 위협' },
  2: { label: '긴급', color: '#EA580C', bg: '#FFEDD5', description: '잠재적 생명 위협, 시간 의존적' },
  3: { label: '응급', color: '#CA8A04', bg: '#FEF9C3', description: '잠재적 위급, 응급 처치 필요' },
  4: { label: '준응급', color: '#16A34A', bg: '#DCFCE7', description: '1-2시간 대기 가능' },
  5: { label: '비응급', color: '#2563EB', bg: '#DBEAFE', description: '경증' },
};

// 환자 정보
export interface PatientInfo {
  age: number | null;
  gender: 'male' | 'female' | 'unknown';
  consciousnessLevel: 'alert' | 'verbal' | 'pain' | 'unresponsive'; // AVPU scale
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  chiefComplaint: string;
  allergies: string;
  medications: string;
}

export const DEFAULT_PATIENT_INFO: PatientInfo = {
  age: null,
  gender: 'unknown',
  consciousnessLevel: 'alert',
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  heartRate: null,
  respiratoryRate: null,
  temperature: null,
  oxygenSaturation: null,
  chiefComplaint: '',
  allergies: '',
  medications: '',
};

export const CONSCIOUSNESS_LABELS: Record<PatientInfo['consciousnessLevel'], { label: string; description: string; color: string }> = {
  alert: { label: 'A (명료)', description: '의식 명료, 자발적 반응', color: '#16A34A' },
  verbal: { label: 'V (언어반응)', description: '언어 자극에 반응', color: '#CA8A04' },
  pain: { label: 'P (통증반응)', description: '통증 자극에만 반응', color: '#EA580C' },
  unresponsive: { label: 'U (무반응)', description: '자극에 무반응', color: '#DC2626' },
};

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  availableBeds: number;
  totalBeds: number;
  congestionLevel: 'low' | 'medium' | 'high';
  availableSpecialties: string[];
  specialists: Record<string, boolean>;
  operatingRooms: { total: number; available: number };
  facilities: string[];
  isL2Registered: boolean;
  lastUpdated: string;
}

export interface SymptomAnalysis {
  ktasLevel: KTASLevel;
  ktasLabel: string;
  requiredSpecialties: string[];
  requiredFacilities: string[];
  suspectedConditions: string[];
  reasoning: string;
}

export interface MatchedHospital extends Hospital {
  score: number;
  distance: number;
  estimatedTime: number;
  matchReasons: string[];
}

// 이송 요청
export type DispatchStatus = 'pending' | 'accepted' | 'rejected' | 'transporting' | 'arrived' | 'cancelled';

export interface Dispatch {
  id: string;
  hospitalId: string;
  hospitalName: string;
  symptoms: SymptomAnalysis;
  symptomsText: string;
  patientInfo?: PatientInfo;
  status: DispatchStatus;
  createdAt: string;
  updatedAt: string;
  estimatedTime: number;
  distance: number;
  rejectReason?: string;
  // Auto-cascade tracking
  cascadeIndex?: number; // which hospital in the ranked list
  cascadeGroupId?: string; // groups cascaded dispatches together
  responseDeadline?: string; // ISO string - when hospital must respond by
}

// 통계
export interface Statistics {
  totalDispatches: number;
  acceptedDispatches: number;
  rejectedDispatches: number;
  pendingDispatches: number;
  averageResponseTime: number; // seconds
  averageTransportTime: number; // minutes
  ktasDistribution: Record<number, number>;
  hospitalUtilization: Array<{
    id: string;
    name: string;
    totalRequests: number;
    accepted: number;
    rejected: number;
    avgResponseTime: number;
    bedUtilization: number;
  }>;
  hourlyDispatches: number[];
  recentActivity: Array<{
    id: string;
    type: 'dispatch_created' | 'dispatch_accepted' | 'dispatch_rejected' | 'hospital_updated';
    description: string;
    timestamp: string;
  }>;
}
