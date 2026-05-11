-- GoldenLink Supabase 스키마 (한 번만 실행)
-- Supabase 프로젝트 → SQL Editor → New query → 이 내용 통째로 붙여넣고 RUN
--
-- ⚠️ 격리: 모든 객체를 'goldenlink' 스키마에 생성하여
--     동일 Supabase 프로젝트의 다른 앱과 충돌하지 않도록 분리한다.
--     실행 후 반드시 대시보드에서:
--       Settings → API → Exposed schemas 목록에 'goldenlink' 추가

-- ── 스키마 ──
create schema if not exists goldenlink;

-- ── 테이블 ──

create table if not exists goldenlink.hospitals (
  id text primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  phone text,
  available_beds int not null default 0,
  total_beds int not null default 0,
  congestion_level text not null default 'medium' check (congestion_level in ('low','medium','high')),
  available_specialties text[] not null default '{}',
  specialists jsonb not null default '{}'::jsonb,
  operating_rooms jsonb not null default '{"total":0,"available":0}'::jsonb,
  facilities text[] not null default '{}',
  is_l2_registered boolean not null default false,
  last_updated timestamptz not null default now()
);

create table if not exists goldenlink.dispatches (
  id text primary key,
  hospital_id text not null references goldenlink.hospitals(id) on delete cascade,
  hospital_name text not null,
  symptoms jsonb not null,
  symptoms_text text not null,
  patient_info jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','transporting','arrived','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estimated_time int not null,
  distance numeric not null,
  reject_reason text,
  cascade_index int,
  cascade_group_id text,
  response_deadline timestamptz
);

create index if not exists dispatches_hospital_id_idx on goldenlink.dispatches(hospital_id);
create index if not exists dispatches_status_idx on goldenlink.dispatches(status);
create index if not exists dispatches_created_at_idx on goldenlink.dispatches(created_at desc);

create table if not exists goldenlink.activity_log (
  id bigserial primary key,
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_at_idx on goldenlink.activity_log(created_at desc);

-- ── 권한 (PostgREST 노출용) ──
-- public 스키마는 자동으로 anon/authenticated에 노출되지만,
-- 별도 스키마는 GRANT를 명시해야 supabase-js로 접근 가능.
grant usage on schema goldenlink to anon, authenticated, service_role;
grant all on all tables in schema goldenlink to anon, authenticated, service_role;
grant all on all sequences in schema goldenlink to anon, authenticated, service_role;
alter default privileges in schema goldenlink grant all on tables to anon, authenticated, service_role;
alter default privileges in schema goldenlink grant all on sequences to anon, authenticated, service_role;

-- ── RLS (Row Level Security) ──
-- 시연 단계: anon에게 모든 권한 허용
-- 출시 후 인증 도입 시 정책 강화 예정 (P0 보안 이슈)

alter table goldenlink.hospitals enable row level security;
alter table goldenlink.dispatches enable row level security;
alter table goldenlink.activity_log enable row level security;

drop policy if exists "anon_all_hospitals" on goldenlink.hospitals;
drop policy if exists "anon_all_dispatches" on goldenlink.dispatches;
drop policy if exists "anon_all_activity" on goldenlink.activity_log;

create policy "anon_all_hospitals" on goldenlink.hospitals for all using (true) with check (true);
create policy "anon_all_dispatches" on goldenlink.dispatches for all using (true) with check (true);
create policy "anon_all_activity" on goldenlink.activity_log for all using (true) with check (true);

-- ── Realtime ──
-- 병원 대시보드/구급대원 화면이 실시간 동기화되도록 publication에 추가
alter publication supabase_realtime add table goldenlink.dispatches;
alter publication supabase_realtime add table goldenlink.hospitals;
