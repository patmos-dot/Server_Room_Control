-- Isomo Control Room Log: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- Safe to run once on a fresh project.

-- 1. The table that stores every form response -------------------------------
create table public.control_room_entries (
  id              bigint generated always as identity primary key,

  -- Set by the database clock at the moment the row is saved (stored in UTC).
  -- The form never sends this, so a phone with a wrong clock cannot change it.
  submitted_at    timestamptz not null default now(),

  full_name       text not null check (char_length(trim(full_name)) between 2 and 255),
  email           text not null check (
                    char_length(email) <= 255
                    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                  ),
  activity        text not null check (char_length(trim(activity)) between 3 and 2000),

  taking_laptops  boolean not null default false,
  laptop_serials  text[]  not null default '{}',
  laptop_reason   text check (laptop_reason is null or char_length(laptop_reason) <= 2000),

  -- If they take laptops: at least one serial and a reason.
  -- If they do not: no serials and no reason.
  constraint laptop_details_match check (
    (taking_laptops
      and cardinality(laptop_serials) between 1 and 20
      and laptop_reason is not null
      and char_length(trim(laptop_reason)) >= 3)
    or
    (not taking_laptops
      and cardinality(laptop_serials) = 0
      and laptop_reason is null)
  )
);

-- Fast lookups like "who took laptop PF4ABC12?" and "latest entries first"
create index control_room_entries_serials_idx on public.control_room_entries using gin (laptop_serials);
create index control_room_entries_time_idx    on public.control_room_entries (submitted_at desc);


-- 2. Security: the public form can ADD rows, never READ, EDIT or DELETE them ---
alter table public.control_room_entries enable row level security;

create policy "Form can submit entries"
  on public.control_room_entries
  for insert
  to anon
  with check (true);

-- No select/update/delete policies exist, so the public key cannot read or change anything.
-- Column grants also stop anyone from sending their own id or submitted_at.
revoke all on table public.control_room_entries from anon, authenticated;
grant insert (full_name, email, activity, taking_laptops, laptop_serials, laptop_reason)
  on table public.control_room_entries to anon;


-- 3. A staff-friendly view in Kigali time --------------------------------------
-- Open it in Supabase > Table Editor > control_room_log (or export it to CSV).
create view public.control_room_log
with (security_invoker = true) as
select
  id,
  to_char(submitted_at at time zone 'Africa/Kigali', 'YYYY-MM-DD HH24:MI:SS') as submitted_kigali,
  full_name,
  email,
  activity,
  taking_laptops,
  array_to_string(laptop_serials, ', ') as laptop_serials,
  laptop_reason,
  submitted_at
from public.control_room_entries
order by submitted_at desc;

revoke all on public.control_room_log from anon, authenticated;


-- 4. Keep-alive ping (free plan pauses after 7 idle days) ----------------------
-- Returns 1 and touches nothing. Called weekly by .github/workflows/keepalive.yml.
create function public.keepalive()
returns integer
language sql
stable
as $$ select 1 $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;


-- Handy staff queries (run in SQL Editor) --------------------------------------
-- Everything today:
--   select * from control_room_log where submitted_at >= date_trunc('day', now() at time zone 'Africa/Kigali') at time zone 'Africa/Kigali';
-- Who has taken a given laptop:
--   select * from control_room_log where id in (select id from control_room_entries where 'PF4ABC12' = any(laptop_serials));
