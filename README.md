# GoldenLink — 지능형 응급 병원 매칭 시스템

> **골든타임, AI가 지킵니다.**

응급 환자의 증상을 AI가 자동 분류(KTAS 1~5)하고 진료과·시설·거리·혼잡도를 종합해 최적 병원을 추천하는 모바일 우선 응급 이송 플랫폼.

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| 🎤 음성 입력 + AI 파싱 | 구급대원이 환자정보·증상을 한 번에 말하면 자동 추출 (Web Speech API) |
| 🧠 KTAS AI 자동 분류 | Gemini 2.5 Flash로 1~5단계 응급도 즉시 판단 |
| 🏥 다요소 매칭 알고리즘 | 진료과(30%) · 거리(25%) · 병상(20%) · 시설(15%) · 수술실(10%) 가중 점수 |
| ⚡ 캐스케이드 자동 매칭 | 첫 병원 거절·시간초과 시 다음 순위 병원 자동 요청 |
| 📡 실시간 병원 대시보드 | Supabase Realtime 푸시 알림 + 가용 자원 즉시 동기화 |
| 📈 운영 통계 | KTAS 분포·병원별 수락률·시간대별 요청량 시각화 |

---

## 1분 자동 시연

홈 화면 상단의 보라색 **"1분 자동 시연"** 버튼 → 시나리오 선택 → 입력·분류·매칭·캐스케이드까지 자동 재생.

| 시나리오 | 어필 포인트 |
|---|---|
| 🫀 60대 흉통 | 캐스케이드 자동 매칭 (1순위 거절 → 2순위 자동 전환) |
| 🚨 30대 의식 없음 | AI가 KTAS 1 자동 분류 → 즉각 1순위 매칭 |
| 🚗 40대 교통사고 | 외상소생실 보유 병원 자동 우선순위 |

---

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router, RSC) · React 18 · TypeScript · Tailwind CSS
- **AI 계층**:
  - 1차: Google Gemini 2.5 Flash (구조화 JSON 응답)
  - 2차: Anthropic Claude Sonnet 4.6 (fallback)
  - 3차: 키워드 기반 휴리스틱 (offline fallback)
- **데이터베이스**: Supabase Postgres
  - 격리 스키마 `goldenlink` (다른 앱과 충돌 방지)
  - Realtime publication on `dispatches`, `hospitals`
- **지도**: 네이버 Maps API (한국 응급의료 환경 최적화)
- **음성**: Web Speech API (브라우저 내장)

---

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local`에 다음 값을 채워주세요:

| 변수 | 필수 | 발급처 |
|---|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | https://supabase.com |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 프로젝트 Settings → API |
| `GEMINI_API_KEY` | 권장 | https://aistudio.google.com (무료, 분당 15회) |
| `NEXT_PUBLIC_NAVER_MAP_KEY` | 권장 | https://console.ncloud.com |
| `ANTHROPIC_API_KEY` | 선택 | https://console.anthropic.com |

> env 비어있어도 in-memory + 키워드 fallback으로 동작합니다 (시연 가능).

### 3. DB 초기화 (Supabase 사용 시, 최초 1회)

Supabase 대시보드 → SQL Editor에서 다음을 순서대로 실행:

1. `supabase/schema.sql` (스키마 + 테이블 + RLS + Realtime publication)
2. `supabase/seed.sql` (병원 12개 시드)

그 후 **Settings → API → Exposed schemas**에 `goldenlink` 추가 후 Save.

### 4. 개발 서버 실행 (포트 3030 고정)

```bash
npm run dev
```

→ http://localhost:3030

---

## 아키텍처

```
구급대원 (모바일)              병원 대시보드 (PC/태블릿)
       │                              │
       ▼                              ▼
   ┌────────────────────────────────────────┐
   │      Next.js 14 (App Router + RSC)    │
   ├────────────────────────────────────────┤
   │  /api/parse-patient-info  → Gemini    │
   │  /api/analyze-symptoms    → Gemini    │
   │  /api/match-hospitals     → Local     │
   │  /api/dispatch (CRUD)     → Supabase  │
   └─────────────────┬──────────────────────┘
                     │ supabase-js + realtime
                     ▼
   ┌────────────────────────────────────────┐
   │   Supabase Postgres (schema: goldenlink) │
   │   - hospitals      (12 seeded)         │
   │   - dispatches     (cascade group id)  │
   │   - activity_log                       │
   └────────────────────────────────────────┘
```

---

## KTAS 매칭 가중치

| 요소 | 가중치 | 이유 |
|---|---:|---|
| 전문의 적합도 | **30%** | 응급 진단·수술 가능 여부 |
| 거리 (≤20km) | **25%** | 골든타임 직접 영향 |
| 가용 병상 | **20%** | 수용 가능성 |
| 시설 (CT/MRI/응급수술실 등) | **15%** | 처치 가능성 |
| 수술실 가용 | **10%** | 외과 응급 시 |

**추가 페널티**:
- 20km 초과 → 30% 감점
- 실시간 정보 미등록 (L2 미가입) → 50% 감점
- 혼잡도 높음 → 15% 감점
- KTAS 1-2 + 수술 필요 + 수술실 0 → 40% 감점

---

## 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx                # 홈 (역할 선택 + 자동 시연)
│   ├── paramedic/
│   │   ├── input/page.tsx      # 증상 입력 (음성 + 빠른 칩)
│   │   └── result/page.tsx     # 매칭 결과 + 캐스케이드 dispatch
│   ├── hospital/
│   │   ├── dashboard/page.tsx  # 병원 대시보드 (이송 요청 수신)
│   │   └── [id]/page.tsx       # 병원 상세
│   ├── admin/page.tsx          # 통계 · 운영 현황
│   ├── dispatch/[id]/page.tsx  # 이송 요청서 (인쇄 가능)
│   └── api/                    # 8개 라우트
├── lib/
│   ├── types.ts                # 도메인 타입 (KTAS, Hospital, Dispatch...)
│   ├── matching.ts             # 매칭 알고리즘 (Haversine + 가중 점수)
│   ├── ai.ts                   # Gemini/Claude 3단 fallback
│   ├── store.ts                # Supabase + in-memory dual mode
│   ├── supabase.ts             # 격리 스키마 클라이언트
│   ├── realtime.ts             # 클라이언트 push 구독
│   ├── demo-scenarios.ts       # 1분 자동 시연 시나리오
│   └── mock-data.ts            # 12개 병원 (env 없을 때 fallback)
└── components/
    ├── NaverMap.tsx
    └── KakaoMap.tsx (예비)
supabase/
├── schema.sql                  # goldenlink 스키마 + RLS + Realtime
└── seed.sql                    # 병원 시드
```

---

## 향후 계획

- [ ] **공공데이터포털 응급의료기관 API** 연동 → 전국 400+ 병원 실시간 동기화
- [ ] **의료진 인증** (Supabase Auth) → RLS 정책 강화
- [ ] **환자 PHI 암호화** 저장 + 감사 로그
- [ ] **PWA** 변환 + 오프라인 대응 (Service Worker)
- [ ] **119 종합상황실** 연동 API
- [ ] **수도권 외 지역** 시드 확장 + 권역별 캐스케이드

---

## 보안 주의사항

- 현재 RLS는 시연 단계로 `anon`에 전체 권한 부여. **출시 전 반드시 인증 도입 + 정책 강화 필요**.
- Anon 키가 클라이언트에 노출되므로 환자 PHI 저장 시 추가 암호화 필수.
- `.env.local`은 절대 커밋 금지 (`.gitignore` 기본 처리됨).

---

## 라이선스

공모전 출품작. 상업적 사용 전 별도 협의 필요.
