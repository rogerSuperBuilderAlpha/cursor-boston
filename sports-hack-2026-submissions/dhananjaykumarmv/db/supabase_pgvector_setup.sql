-- Supabase (Postgres) setup for Athlete Intel vector store (pgvector).
--
-- IMPORTANT: Embedding dimension (DIM)
-- - This script defaults to DIM = 1024.
-- - You MUST match this to your embedding model output dimension.
--   If your embedding model returns a different length, edit every occurrence of `vector(1024)` below.
-- - Cohere common default: `embed-english-v3.0` returns 1024 dims (verify for your chosen model).
--
-- Recommended: run this in Supabase SQL Editor once.

begin;

-- Extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Table
create table if not exists public.athlete_documents (
  id uuid primary key default gen_random_uuid(),
  player_key text not null,
  sport text not null,
  document_type text not null default 'player_profile',
  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  brand_power_score numeric,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_documents_player_key_document_type_key unique (player_key, document_type)
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists athlete_documents_set_updated_at on public.athlete_documents;
create trigger athlete_documents_set_updated_at
before update on public.athlete_documents
for each row execute function public.set_updated_at();

-- Vector index (cosine similarity)
-- Note: ivfflat requires ANALYZE for good recall; tune `lists` based on row count.
create index if not exists athlete_documents_embedding_ivfflat_idx
on public.athlete_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists athlete_documents_player_key_idx
on public.athlete_documents (player_key);

create index if not exists athlete_documents_sport_idx
on public.athlete_documents (sport);

-- RLS
alter table public.athlete_documents enable row level security;

-- Allow authenticated reads (tighten if needed by sport / ownership later).
drop policy if exists athlete_documents_read_authenticated on public.athlete_documents;
create policy athlete_documents_read_authenticated
on public.athlete_documents
for select
to authenticated
using (true);

-- No direct client writes by default.
drop policy if exists athlete_documents_no_client_writes on public.athlete_documents;
create policy athlete_documents_no_client_writes
on public.athlete_documents
for all
to authenticated
using (false)
with check (false);

-- Upsert RPC (service-role only)
-- Expects `embedding_as_text` in pgvector input format, e.g. '[0.1,0.2,...]'.
--
-- NOTE: The pipeline CLI calls `public.upsert_player_document(...)`.
-- We keep `upsert_athlete_document` as the underlying implementation and expose a wrapper
-- with the plan-compatible name for stability.
create or replace function public.upsert_athlete_document(
  in p_player_key text,
  in p_sport text,
  in p_document_type text,
  in p_embedding_as_text text,
  in p_content jsonb,
  in p_metadata jsonb,
  in p_brand_power_score numeric default null
)
returns public.athlete_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), current_user);
  v_embedding vector(1024);
  v_embedding_any vector;
  v_dim int;
  v_row public.athlete_documents;
begin
  -- Guard: only allow Supabase service_role (or direct SQL as postgres).
  if v_role not in ('service_role', 'postgres') then
    raise exception 'not authorized (role=%)', v_role using errcode = '42501';
  end if;

  if p_player_key is null or length(trim(p_player_key)) = 0 then
    raise exception 'player_key is required' using errcode = '22023';
  end if;
  if p_sport is null or length(trim(p_sport)) = 0 then
    raise exception 'sport is required' using errcode = '22023';
  end if;

  -- Cast embedding text -> vector and validate dimension.
  if p_embedding_as_text is not null and length(trim(p_embedding_as_text)) > 0 then
    v_embedding_any := p_embedding_as_text::vector;
    v_dim := vector_dims(v_embedding_any);
    if v_dim <> 1024 then
      raise exception 'embedding dim mismatch: expected %, got %', 1024, v_dim using errcode = '22023';
    end if;
    v_embedding := v_embedding_any::vector(1024);
  else
    v_embedding := null;
  end if;

  insert into public.athlete_documents (
    player_key,
    sport,
    document_type,
    embedding,
    content,
    metadata,
    brand_power_score
  ) values (
    p_player_key,
    p_sport,
    coalesce(nullif(trim(p_document_type), ''), 'player_profile'),
    v_embedding,
    coalesce(p_content, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    p_brand_power_score
  )
  on conflict (player_key, document_type) do update set
    sport = excluded.sport,
    embedding = excluded.embedding,
    content = excluded.content,
    metadata = excluded.metadata,
    brand_power_score = excluded.brand_power_score,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- Lock down function privileges (only callable explicitly by service role).
revoke all on function public.upsert_athlete_document(text, text, text, text, jsonb, jsonb, numeric) from public;
revoke all on function public.upsert_athlete_document(text, text, text, text, jsonb, jsonb, numeric) from anon;
revoke all on function public.upsert_athlete_document(text, text, text, text, jsonb, jsonb, numeric) from authenticated;
grant execute on function public.upsert_athlete_document(text, text, text, text, jsonb, jsonb, numeric) to service_role;

-- Plan-compatible wrapper name (same signature).
create or replace function public.upsert_player_document(
  in p_player_key text,
  in p_sport text,
  in p_document_type text,
  in p_embedding_as_text text,
  in p_content jsonb,
  in p_metadata jsonb,
  in p_brand_power_score numeric default null
)
returns public.athlete_documents
language sql
security definer
set search_path = public
as $$
  select public.upsert_athlete_document(
    p_player_key,
    p_sport,
    p_document_type,
    p_embedding_as_text,
    p_content,
    p_metadata,
    p_brand_power_score
  );
$$;

revoke all on function public.upsert_player_document(text, text, text, text, jsonb, jsonb, numeric) from public;
revoke all on function public.upsert_player_document(text, text, text, text, jsonb, jsonb, numeric) from anon;
revoke all on function public.upsert_player_document(text, text, text, text, jsonb, jsonb, numeric) from authenticated;
grant execute on function public.upsert_player_document(text, text, text, text, jsonb, jsonb, numeric) to service_role;

commit;
