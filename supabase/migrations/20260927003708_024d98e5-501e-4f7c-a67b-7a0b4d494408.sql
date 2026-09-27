create table public.pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  channel text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  desktop_seen_at timestamptz,
  mobile_connected_at timestamptz,
  mobile_agent text,
  revoked boolean not null default false
);
grant all on public.pairing_sessions to service_role;
alter table public.pairing_sessions enable row level security;
-- No anon/authenticated policies: sessions are only reachable through trusted server functions.
create index pairing_sessions_expires_idx on public.pairing_sessions (expires_at);