-- Add a public alert-history lifecycle while keeping is_active for existing readers.

alter table public.alerts
  add column if not exists location text,
  add column if not exists status text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references auth.users(id),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id);

update public.alerts
set status = case when is_active then 'ACTIVE' else 'RESOLVED' end
where status is null;

alter table public.alerts
  alter column status set default 'ACTIVE',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'alerts_status_check'
      and conrelid = 'public.alerts'::regclass
  ) then
    alter table public.alerts
      add constraint alerts_status_check
      check (status in ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'));
  end if;
end;
$$;

update public.alerts
set is_active = status in ('ACTIVE', 'ACKNOWLEDGED');

drop policy if exists "Residents can view active alerts" on public.alerts;
drop policy if exists "Residents can view alert history" on public.alerts;
create policy "Residents can view alert history" on public.alerts
for select using (true);

create index if not exists alerts_status_created_at_idx
  on public.alerts(status, created_at desc);