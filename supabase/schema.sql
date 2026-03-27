-- Flowers for Fighters — Supabase Schema
-- Run this in the Supabase SQL editor

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Profiles ──────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific data
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  role text default 'supporter' check (role in ('supporter', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Notes ─────────────────────────────────────────────────────────────────
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade,
  author_name text,
  hospital text not null check (hospital in ('shriners', 'whittier', 'healthbridge', 'pvhmc')),
  patient_prompt text,
  body text not null check (length(body) >= 20 and length(body) <= 500),
  status text default 'queued' check (status in ('queued', 'printed', 'archived')),
  created_at timestamptz default now(),
  printed_at timestamptz
);

-- ── Volunteer Hours ────────────────────────────────────────────────────────
create table if not exists volunteer_hours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade,
  minutes integer default 15,
  logged_at timestamptz default now()
);

-- ── Row-Level Security ─────────────────────────────────────────────────────

-- Profiles: users can read/update their own; admins can read all
alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Admins can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Notes: users can read/insert their own; admins can read/update all
alter table notes enable row level security;

create policy "Users can insert their own notes"
  on notes for insert with check (auth.uid() = author_id);

create policy "Users can view their own notes"
  on notes for select using (auth.uid() = author_id);

create policy "Admins can view all notes"
  on notes for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can update all notes"
  on notes for update
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Volunteer hours: users can read their own; admins can read all
alter table volunteer_hours enable row level security;

create policy "Users can view their own hours"
  on volunteer_hours for select using (auth.uid() = user_id);

create policy "Service role can insert hours"
  on volunteer_hours for insert with check (true);

create policy "Admins can view all hours"
  on volunteer_hours for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Indexes ────────────────────────────────────────────────────────────────
create index if not exists notes_author_id_idx on notes(author_id);
create index if not exists notes_hospital_idx on notes(hospital);
create index if not exists notes_status_idx on notes(status);
create index if not exists volunteer_hours_user_id_idx on volunteer_hours(user_id);
