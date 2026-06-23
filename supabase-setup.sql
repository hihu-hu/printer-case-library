create table if not exists public.app_admins (
  email text primary key
);

create table if not exists public.printer_cases (
  id bigint primary key,
  title text not null,
  model text not null default '其他',
  category text not null default '未分类',
  level text not null default '常见',
  problem text not null default '',
  summary text not null default '',
  customer text not null default '',
  steps jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  solution_media_by_step jsonb not null default '[]'::jsonb,
  solution_media jsonb not null default '[]'::jsonb,
  user_created boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.app_admins enable row level security;
alter table public.printer_cases enable row level security;

drop policy if exists "admins can read admins" on public.app_admins;
drop policy if exists "everyone can read cases" on public.printer_cases;
drop policy if exists "admins can insert cases" on public.printer_cases;
drop policy if exists "admins can update cases" on public.printer_cases;
drop policy if exists "admins can delete cases" on public.printer_cases;

create policy "admins can read admins"
on public.app_admins
for select
to authenticated
using (public.is_app_admin());

create policy "everyone can read cases"
on public.printer_cases
for select
to anon, authenticated
using (true);

create policy "admins can insert cases"
on public.printer_cases
for insert
to authenticated
with check (public.is_app_admin());

create policy "admins can update cases"
on public.printer_cases
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create policy "admins can delete cases"
on public.printer_cases
for delete
to authenticated
using (public.is_app_admin());

insert into storage.buckets (id, name, public)
values ('case-media', 'case-media', true)
on conflict (id) do update set public = true;

drop policy if exists "everyone can read case media" on storage.objects;
drop policy if exists "admins can upload case media" on storage.objects;
drop policy if exists "admins can update case media" on storage.objects;
drop policy if exists "admins can delete case media" on storage.objects;

create policy "everyone can read case media"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'case-media');

create policy "admins can upload case media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'case-media' and public.is_app_admin());

create policy "admins can update case media"
on storage.objects
for update
to authenticated
using (bucket_id = 'case-media' and public.is_app_admin())
with check (bucket_id = 'case-media' and public.is_app_admin());

create policy "admins can delete case media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'case-media' and public.is_app_admin());

-- 把下面这行 email 改成你自己的管理员邮箱，然后执行。
insert into public.app_admins (email)
values ('1226152439@qq.com')
on conflict (email) do nothing;
