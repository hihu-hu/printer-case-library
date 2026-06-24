create table if not exists public.app_admins (
  email text primary key
);

create extension if not exists pgcrypto;

create table if not exists public.app_admin_logins (
  username text primary key,
  password_hash text not null
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
alter table public.app_admin_logins enable row level security;
alter table public.printer_cases enable row level security;

drop policy if exists "admins can read admins" on public.app_admins;
drop policy if exists "nobody can read admin logins" on public.app_admin_logins;
drop policy if exists "everyone can read cases" on public.printer_cases;
drop policy if exists "admins can insert cases" on public.printer_cases;
drop policy if exists "admins can update cases" on public.printer_cases;
drop policy if exists "admins can delete cases" on public.printer_cases;

create policy "admins can read admins"
on public.app_admins
for select
to authenticated
using (public.is_app_admin());

create policy "nobody can read admin logins"
on public.app_admin_logins
for select
to anon, authenticated
using (false);

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

create or replace function public.verify_admin_login(admin_username text, admin_password text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from app_admin_logins
    where username = admin_username
      and password_hash = encode(extensions.digest(admin_password, 'sha256'), 'hex')
  );
$$;

create or replace function public.save_printer_case(case_data jsonb, admin_username text, admin_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_admin_login(admin_username, admin_password) then
    raise exception '管理员账号或密码错误';
  end if;

  insert into printer_cases (
    id,
    title,
    model,
    category,
    level,
    problem,
    summary,
    customer,
    steps,
    media,
    solution_media_by_step,
    solution_media,
    user_created,
    updated_at
  )
  values (
    (case_data ->> 'id')::bigint,
    coalesce(case_data ->> 'title', ''),
    coalesce(case_data ->> 'model', '其他'),
    coalesce(case_data ->> 'category', '未分类'),
    coalesce(case_data ->> 'level', '常见'),
    coalesce(case_data ->> 'problem', ''),
    coalesce(case_data ->> 'summary', ''),
    coalesce(case_data ->> 'customer', ''),
    coalesce(case_data -> 'steps', '[]'::jsonb),
    coalesce(case_data -> 'media', '[]'::jsonb),
    coalesce(case_data -> 'solution_media_by_step', '[]'::jsonb),
    coalesce(case_data -> 'solution_media', '[]'::jsonb),
    coalesce((case_data ->> 'user_created')::boolean, true),
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    model = excluded.model,
    category = excluded.category,
    level = excluded.level,
    problem = excluded.problem,
    summary = excluded.summary,
    customer = excluded.customer,
    steps = excluded.steps,
    media = excluded.media,
    solution_media_by_step = excluded.solution_media_by_step,
    solution_media = excluded.solution_media,
    user_created = excluded.user_created,
    updated_at = now();
end;
$$;

create or replace function public.delete_printer_case(case_id bigint, admin_username text, admin_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_admin_login(admin_username, admin_password) then
    raise exception '管理员账号或密码错误';
  end if;

  delete from printer_cases where id = case_id;
end;
$$;

grant execute on function public.verify_admin_login(text, text) to anon, authenticated;
grant execute on function public.save_printer_case(jsonb, text, text) to anon, authenticated;
grant execute on function public.delete_printer_case(bigint, text, text) to anon, authenticated;

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
to anon, authenticated
with check (bucket_id = 'case-media');

create policy "admins can update case media"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'case-media')
with check (bucket_id = 'case-media');

create policy "admins can delete case media"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'case-media');

-- 把下面这行 email 改成你自己的管理员邮箱，然后执行。
insert into public.app_admins (email)
values ('1226152439@qq.com')
on conflict (email) do nothing;

insert into public.app_admin_logins (username, password_hash)
values ('CCCC', '80f9d13d80e61f491f1a86af786c946a338feabc0d0d10143f65a3c4131f7b76')
on conflict (username) do update set password_hash = excluded.password_hash;
