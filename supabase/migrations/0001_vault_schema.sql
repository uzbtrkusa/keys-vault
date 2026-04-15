-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Per-user cryptographic metadata
create table public.vault_meta (
  user_id     uuid primary key references auth.users on delete cascade,
  salt        bytea not null,
  kdf_params  jsonb not null,
  verifier    bytea not null,
  created_at  timestamptz not null default now()
);

alter table public.vault_meta enable row level security;

create policy "vault_meta: owner can select"
  on public.vault_meta for select
  using (user_id = auth.uid());

create policy "vault_meta: owner can insert"
  on public.vault_meta for insert
  with check (user_id = auth.uid());

create policy "vault_meta: owner can update kdf_params and verifier"
  on public.vault_meta for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Encrypted vault rows
create table public.vault_rows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  ciphertext  bytea not null,
  iv          bytea not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

create index vault_rows_user_idx on public.vault_rows (user_id);

alter table public.vault_rows enable row level security;

create policy "vault_rows: owner full access"
  on public.vault_rows for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Auto-bump updated_at on any UPDATE
create or replace function public.bump_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vault_rows_updated_at
  before update on public.vault_rows
  for each row execute function public.bump_updated_at();

-- Enable Realtime on vault_rows
alter publication supabase_realtime add table public.vault_rows;
