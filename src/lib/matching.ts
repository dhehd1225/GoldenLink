import { Hospital, SymptomAnalysis, MatchedHospital } from './types';

// Haversine formula
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchHospitals(
  hospitals: Hospital[],
  symptoms: SymptomAnalysis,
  userLat: number,
  userLng: number,
): MatchedHospital[] {
  const results: MatchedHospital[] = hospitals.map(hospital => {
    const reasons: string[] = [];
    const distance = getDistanceKm(userLat, userLng, hospital.lat, hospital.lng);
    // 구급차 평균 속도: 도심 ~40km/h, 최소 5분
    const estimatedTime = Math.max(5, Math.round(distance * 2));

    // 1. Specialist score (30%)
    let specialistScore = 0;
    const neededSpecs = symptoms.requiredSpecialties;
    if (neededSpecs.length > 0) {
      const matched = neededSpecs.filter(s => hospital.specialists[s] === true);
      specialistScore = matched.length / neededSpecs.length;
      if (matched.length > 0) reasons.push(`전문의: ${matched.join(', ')}`);
    } else {
      specialistScore = 1;
    }

    // 2. Bed score (20%)
    let bedScore = 0;
    if (hospital.totalBeds > 0) {
      const ratio = hospital.availableBeds / hospital.totalBeds;
      bedScore = Math.min(ratio * 2, 1);
      if (hospital.availableBeds > 0) reasons.push(`가용 병상 ${hospital.availableBeds}개`);
    }

    // 3. Operating room score (10%)
    let orScore = 0;
    const needsOR = neededSpecs.some(s => s.includes('외과')) ||
      symptoms.requiredFacilities.some(f => f === '응급수술실');
    if (needsOR) {
      if (hospital.operatingRooms.total > 0 && hospital.operatingRooms.available > 0) {
        orScore = hospital.operatingRooms.available / hospital.operatingRooms.total;
        reasons.push(`수술실 ${hospital.operatingRooms.available}개 가용`);
      }
    } else {
      orScore = 1;
    }

    // 4. Facility score (15%)
    let facilityScore = 0;
    const neededFacilities = symptoms.requiredFacilities;
    if (neededFacilities.length > 0) {
      const matchedFacilities = neededFacilities.filter(f => hospital.facilities.includes(f));
      facilityScore = matchedFacilities.length / neededFacilities.length;
      if (matchedFacilities.length > 0) reasons.push(`시설: ${matchedFacilities.join(', ')}`);
    } else {
      facilityScore = 1;
    }

    // 5. Distance score (25%) — closer is better, max 20km
    //    응급에서 거리는 매우 중요 → 가중치 상향
    const distanceScore = Math.max(0, 1 - distance / 20);
    reasons.push(`거리 ${distance.toFixed(1)}km (약 ${estimatedTime}분)`);

    // Weighted sum = 0.30 + 0.20 + 0.10 + 0.15 + 0.25 = 1.00
    let score = specialistScore * 0.30
      + bedScore * 0.20
      + orScore * 0.10
      + facilityScore * 0.15
      + distanceScore * 0.25;

    // 20km 초과 → 추가 패널티 (너무 먼 병원은 실질적으로 부적합)
    if (distance > 20) {
      score *= 0.7;
      reasons.push('거리 초과 (30% 감점)');
    }

    // L2 penalty
    if (!hospital.isL2Registered) {
      score *= 0.5;
      reasons.push('실시간 정보 미등록 (50% 감점)');
    }

    // Congestion penalty
    if (hospital.congestionLevel === 'high') {
      score *= 0.85;
      reasons.push('혼잡도 높음');
    }

    // KTAS 1-2 + 수술 필요한데 수술실 0이면 큰 감점
    if (symptoms.ktasLevel <= 2 && needsOR && hospital.operatingRooms.available === 0) {
      score *= 0.6;
      reasons.push('긴급 수술 불가 (수술실 없음)');
    }

    return {
      ...hospital,
      score: Math.round(score * 100),
      distance: Math.round(distance * 10) / 10,
      estimatedTime,
      matchReasons: reasons,
    };
  });

  // Stable sort: same score → closer hospital first
  return results.sort((a, b) => b.score - a.score || a.distance - b.distance);
}
