-- ============================================================
-- MAYN SALES POINT — PHASE 1 SCHEMA
-- Run this once in Supabase: Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Table listing which emails should automatically become Super Admin.
-- Edit this list to your own admin email(s) before or after running.
create table if not exists public.admin_emails (
  email text primary key
);

insert into public.admin_emails (email)
values ('youremail@example.com')  -- ⚠️ replace with your real admin email
on conflict (email) do nothing;

-- 2. Profiles table — one row per user, extending Supabase's built-in auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer'
    check (role in ('super_admin', 'admin', 'vendor', 'sub_vendor', 'customer')),
  vendor_id text unique,
  parent_vendor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Auto-generate a readable vendor ID like MSP-000123.
create sequence if not exists public.vendor_id_seq start 100;

create or replace function public.generate_vendor_id()
returns text
language sql
as $$
  select 'MSP-' || lpad(nextval('public.vendor_id_seq')::text, 6, '0');
$$;

-- 4. Trigger: when someone signs up in auth.users, create their profile row,
-- pull full_name/phone from signup metadata, and assign super_admin
-- automatically if their email is in admin_emails.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text := 'customer';
begin
  if exists (select 1 from public.admin_emails where email = new.email) then
    assigned_role := 'super_admin';
  end if;

  insert into public.profiles (id, full_name, phone, role, vendor_id)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    assigned_role,
    public.generate_vendor_id()
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Row Level Security — never trust the frontend for access control.
alter table public.profiles enable row level security;

-- Every user can read and update their own profile.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
  -- ^ prevents a user from promoting their own role via the update policy

-- Helper function so admin policies don't recursively query profiles under RLS.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('super_admin', 'admin')
  );
$$;

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin(auth.uid()));

alter table public.admin_emails enable row level security;

create policy "admin_emails_admin_only"
  on public.admin_emails for select
  using (public.is_admin(auth.uid()));
