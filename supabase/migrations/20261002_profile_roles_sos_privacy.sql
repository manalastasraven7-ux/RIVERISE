-- Prevent self-service role escalation and restrict precise SOS locations to responders.

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id and new.role is distinct from old.role then
    raise exception 'Profile roles can only be changed by an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
before update of role on public.profiles
for each row execute function public.prevent_profile_role_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'resident')
  on conflict (id) do nothing;
  return new;
end;
$$;

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

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('responder', 'admin')
  ) then
    raise exception 'Responder or administrator access required';
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
  has_coordinates boolean := sos_latitude is not null and sos_longitude is not null;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if (sos_latitude is null) <> (sos_longitude is null) then
    raise exception 'Both coordinates must be provided together';
  end if;

  if has_coordinates and (
    sos_latitude < -90 or sos_latitude > 90
    or sos_longitude < -180 or sos_longitude > 180
  ) then
    raise exception 'Valid location coordinates are required';
  end if;

  if not has_coordinates and nullif(trim(sos_note), '') is null then
    raise exception 'Share a current location or provide a place name';
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
    case when has_coordinates then sos_latitude::text || ', ' || sos_longitude::text else sos_note end,
    sos_note, has_coordinates, sos_expires_at, now(), now()
  ) returning * into created_request;

  return created_request;
end;
$$;

revoke all on function public.submit_own_sos(double precision, double precision, text, timestamptz) from public;
grant execute on function public.submit_own_sos(double precision, double precision, text, timestamptz) to authenticated;

alter table public.sos_requests
  add column if not exists handled_by uuid references auth.users(id),
  add column if not exists resolved_by uuid references auth.users(id);

create or replace function public.get_responder_safety_responses()
returns table (
  response_id uuid,
  resident_name text,
  status text,
  response_type text,
  latitude double precision,
  longitude double precision,
  location text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('responder', 'admin')
  ) then
    raise exception 'Responder or administrator access required';
  end if;

  return query
  select
    responses.response_id,
    responses.resident_name,
    responses.status,
    responses.response_type,
    responses.latitude,
    responses.longitude,
    responses.location,
    responses.created_at,
    responses.updated_at
  from (
    select
      request.id as response_id,
      coalesce(nullif(trim(profile.full_name), ''), 'Resident') as resident_name,
      request.status,
      'SOS'::text as response_type,
      request.latitude,
      request.longitude,
      coalesce(nullif(trim(request.notes), ''), nullif(trim(request.location), ''), 'Location not provided') as location,
      request.created_at,
      request.updated_at
    from public.sos_requests request
    left join public.profiles profile on profile.id = request.user_id

    union all

    select
      response.id as response_id,
      coalesce(nullif(trim(profile.full_name), ''), 'Resident') as resident_name,
      response.status,
      'SAFE'::text as response_type,
      response.latitude,
      response.longitude,
      coalesce(nullif(trim(response.notes), ''), 'Location not provided') as location,
      response.updated_at as created_at,
      response.updated_at
    from public.resident_safety_status response
    left join public.profiles profile on profile.id = response.user_id
  ) responses
  order by responses.created_at desc;
end;
$$;

revoke all on function public.get_responder_safety_responses() from public;
grant execute on function public.get_responder_safety_responses() to authenticated;