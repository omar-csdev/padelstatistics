create extension if not exists "pgcrypto";

create table public.matches (
  id           uuid primary key,                                    -- client-generated UUID
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('in_progress','finished')),
  team_a_name  text not null,
  team_b_name  text not null,
  p_tl text not null, p_tr text not null, p_bl text not null, p_br text not null,
  best_of      int  not null check (best_of in (3,5)),
  scoring      text not null check (scoring in ('advantage','golden')),
  first_server text not null check (first_server in ('top','bot'))
);

create table public.events (
  id          uuid primary key,
  match_id    uuid not null references public.matches(id) on delete cascade,
  seq         int  not null,
  ts          timestamptz not null,
  winner_team text not null check (winner_team in ('top','bot')),
  by_pos      text not null check (by_pos in ('tl','tr','bl','br')),
  by_player   text not null,
  result      text not null check (result in ('won','lost')),
  shot        text,
  error_kind  text,
  unique (match_id, seq)
);
create index events_match_seq_idx on public.events (match_id, seq);

create table public.ai_summaries (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  model      text not null,
  payload    jsonb not null
);

create table public.usage_log (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null,                                            -- 'ai_summary'
  ts      timestamptz not null default now()
);
create index usage_log_user_kind_ts_idx on public.usage_log (user_id, kind, ts);

-- Row-level security
alter table public.matches       enable row level security;
alter table public.events        enable row level security;
alter table public.ai_summaries  enable row level security;
alter table public.usage_log     enable row level security;

create policy own_matches on public.matches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy own_events on public.events
  for all
  using (exists (select 1 from public.matches m where m.id = events.match_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.matches m where m.id = events.match_id and m.user_id = auth.uid()));

create policy own_ai_summaries on public.ai_summaries
  for all
  using (exists (select 1 from public.matches m where m.id = ai_summaries.match_id and m.user_id = auth.uid()));

create policy own_usage on public.usage_log
  for select
  using (auth.uid() = user_id);
