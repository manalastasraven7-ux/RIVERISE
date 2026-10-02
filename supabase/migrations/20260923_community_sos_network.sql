-- Community SOS network migration.
-- Apply this migration to the existing Supabase project before using nearby alerts.

alter table public.sos_requests
  add column if not exists location_shared boolean not null default false,
  add column if not exists expires_at timestamptz,
  add column if not exists resolved_at timestamptz;

update public.sos_requests
set location_shared = (latitude is not null and longitude is not null)
where location_shared = false
  and latitude is not null
  and longitude is not null;

create index if not exists sos_requests_active_expiry_idx
  on public.sos_requests(status, expires_at, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sos_requests_coordinate_pair_check'
  ) then
    alter table public.sos_requests
      add constraint sos_requests_coordinate_pair_check
      check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null));
  end if;
end;
$$;

create or replace function public.submit_own_sos(
  sos_latitude double precision,
  sos_longitude double precision,
  sos_note text,
  sos_expires_at timestamptz
)
returns public.sos_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_request public.sos_requests;
  created_request public.sos_requests;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if sos_latitude is null or sos_longitude is null
    or sos_latitude < -90 or sos_latitude > 90
    or sos_longitude < -180 or sos_longitude > 180 then
    raise exception 'Valid location is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  perform public.expire_sos_requests();

  select * into existing_request
  from public.sos_requests
  where user_id = auth.uid()
    and status in ('PENDING', 'ACKNOWLEDGED', 'RESPONDING')
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if existing_request.id is not null then
    return existing_request;
  end if;

  insert into public.sos_requests (
    user_id, status, latitude, longitude, location, notes,
    location_shared, expires_at, created_at, updated_at
  ) values (
    auth.uid(), 'PENDING', sos_latitude, sos_longitude,
    sos_latitude::text || ', ' || sos_longitude::text,
    sos_note, true, sos_expires_at, now(), now()
  ) returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.submit_own_sos(double precision, double precision, text, timestamptz) from public;
grant execute on function public.submit_own_sos(double precision, double precision, text, timestamptz) to authenticated;

create or replace function public.expire_sos_requests()
returns void
language sql
security definer
set search_path = public
as $$
  update public.sos_requests
  set status = 'RESOLVED', resolved_at = coalesce(resolved_at, now()), updated_at = now()
  where status in ('PENDING', 'ACKNOWLEDGED', 'RESPONDING')
    and expires_at is not null
    and expires_at <= now();
$$;

revoke all on function public.expire_sos_requests() from public;
grant execute on function public.expire_sos_requests() to authenticated;

create or replace function public.get_nearby_active_sos(
  viewer_latitude double precision,
  viewer_longitude double precision,
  radius_meters double precision
)
returns table (
  id uuid,
  status text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  distance_meters double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  bounded_radius double precision := least(greatest(radius_meters, 1), 100000);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.expire_sos_requests();

  return query
  select
    request.id,
    request.status,
    request.latitude,
    request.longitude,
    request.created_at,
    request.updated_at,
    request.expires_at,
    6371000 * 2 * asin(sqrt(
      power(sin(radians(request.latitude - viewer_latitude) / 2), 2)
      + cos(radians(viewer_latitude)) * cos(radians(request.latitude))
      * power(sin(radians(request.longitude - viewer_longitude) / 2), 2)
    )) as distance_meters
  from public.sos_requests request
  where request.status in ('PENDING', 'ACKNOWLEDGED', 'RESPONDING')
    and request.location_shared = true
    and request.latitude is not null
    and request.longitude is not null
    and (request.expires_at is null or request.expires_at > now())
    and 6371000 * 2 * asin(sqrt(
      power(sin(radians(request.latitude - viewer_latitude) / 2), 2)
      + cos(radians(viewer_latitude)) * cos(radians(request.latitude))
      * power(sin(radians(request.longitude - viewer_longitude) / 2), 2)
    )) <= bounded_radius
  order by distance_meters asc;
end;
$$;

revoke all on function public.get_nearby_active_sos(double precision, double precision, double precision) from public;
grant execute on function public.get_nearby_active_sos(double precision, double precision, double precision) to authenticated;

create or replace function public.cancel_own_sos(request_id uuid)
returns public.sos_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled_request public.sos_requests;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.sos_requests
  set status = 'RESOLVED', resolved_at = now(), updated_at = now()
  where id = request_id
    and user_id = auth.uid()
    and status in ('PENDING', 'ACKNOWLEDGED', 'RESPONDING')
  returning * into cancelled_request;

  if cancelled_request.id is null then
    raise exception 'Active SOS request not found';
  end if;

  return cancelled_request;
end;
$$;

revoke all on function public.cancel_own_sos(uuid) from public;
grant execute on function public.cancel_own_sos(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sos_requests'
      and policyname = 'Residents can update own SOS requests'
  ) then
    create policy "Residents can update own SOS requests"
      on public.sos_requests for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.broadcast_sos_change()
returns trigger
security definer
set search_path = public, realtime
language plpgsql
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', coalesce(new.id, old.id), 'status', coalesce(new.status, old.status)),
    'sos_changed',
    'community-sos',
    true
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sos_requests_broadcast_trigger on public.sos_requests;
create trigger sos_requests_broadcast_trigger
after insert or update or delete on public.sos_requests
for each row execute function public.broadcast_sos_change();

revoke all on function public.broadcast_sos_change() from public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime'
      and tablename = 'messages'
      and policyname = 'Authenticated users can receive community SOS invalidations'
  ) then
    create policy "Authenticated users can receive community SOS invalidations"
      on realtime.messages for select to authenticated
      using (topic = 'community-sos');
  end if;
end;
$$;

alter table public.sos_requests replica identity full;
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sos_requests'
  ) then
    alter publication supabase_realtime add table public.sos_requests;
  end if;
end;
$$;
