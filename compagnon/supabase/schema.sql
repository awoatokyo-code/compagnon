-- Compagnon — étape 1 : à coller dans Supabase > SQL Editor > Run
-- Pense à activer Authentication > Providers > "Anonymous sign-ins".

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  companion text not null default 'axo',
  companion_name text not null default 'Axo',
  character text not null default 'joyeux',
  voice_mode text not null default 'text' check (voice_mode in ('voice','text')),
  plan text not null default 'free' check (plan in ('free','premium')),
  age_confirmed boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index messages_user_idx on public.messages (user_id, created_at desc);

create table public.memories (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index memories_user_idx on public.memories (user_id, created_at desc);

create table public.usage_daily (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);

-- Sécurité (RLS) : chacun ne voit que ses lignes
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.usage_daily enable row level security;

create policy "profil: lecture" on public.profiles for select using (auth.uid() = id);
create policy "profil: création" on public.profiles for insert with check (auth.uid() = id);
create policy "profil: modification" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profil: suppression" on public.profiles for delete using (auth.uid() = id);

create policy "messages: lecture" on public.messages for select using (auth.uid() = user_id);
create policy "messages: suppression" on public.messages for delete using (auth.uid() = user_id);

create policy "mémoire: lecture" on public.memories for select using (auth.uid() = user_id);
create policy "mémoire: suppression" on public.memories for delete using (auth.uid() = user_id);
-- messages / memories / usage_daily : écriture uniquement par les edge functions (service role)

-- L'utilisateur ne peut pas se donner le plan premium tout seul
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, companion, companion_name, character, voice_mode, age_confirmed, consented_at)
  on public.profiles to authenticated;
grant update (companion, companion_name, character, voice_mode, age_confirmed, consented_at)
  on public.profiles to authenticated;

-- Compteur de messages du jour (fuseau Paris)
create or replace function public.increment_usage(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare c int;
begin
  insert into usage_daily (user_id, day, n)
  values (p_user, (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (user_id, day) do update set n = usage_daily.n + 1
  returning n into c;
  return c;
end $$;
revoke all on function public.increment_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid) to service_role;
