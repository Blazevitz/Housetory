-- Housetory database setup for Supabase (PostgreSQL)
-- Run this entire file in Supabase > SQL Editor > New query.
-- Inventory is shared by all authenticated staff. Only admins can delete items.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  item_id text primary key,
  name text not null,
  category text not null default 'Other',
  status text not null default 'Available'
    check (status in ('Available','In Use','Damaged','Missing','In Laundry')),
  location text,
  value numeric(12,2) not null default 0 check (value >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_housetory_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_housetory on auth.users;
create trigger on_auth_user_created_housetory
after insert on auth.users
for each row execute procedure public.handle_new_housetory_user();

create or replace function public.is_housetory_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "Staff can read own profile" on public.profiles;
create policy "Staff can read own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_housetory_admin());

drop policy if exists "Authenticated staff can read inventory" on public.inventory_items;
create policy "Authenticated staff can read inventory" on public.inventory_items
for select to authenticated using (true);

drop policy if exists "Authenticated staff can add inventory" on public.inventory_items;
create policy "Authenticated staff can add inventory" on public.inventory_items
for insert to authenticated with check (created_by = (select auth.uid()) and updated_by = (select auth.uid()));

drop policy if exists "Authenticated staff can update inventory" on public.inventory_items;
create policy "Authenticated staff can update inventory" on public.inventory_items
for update to authenticated using (true)
with check (updated_by = (select auth.uid()));

drop policy if exists "Only admins can delete inventory" on public.inventory_items;
create policy "Only admins can delete inventory" on public.inventory_items
for delete to authenticated using (public.is_housetory_admin());

-- Enable database change events for live refresh in all staff browsers.
do $$
begin
  alter publication supabase_realtime add table public.inventory_items;
exception when duplicate_object then null;
end $$;

-- After creating your first user in Supabase Authentication > Users,
-- promote that account to administrator by running this query with its exact email:
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@yourhotel.com');
