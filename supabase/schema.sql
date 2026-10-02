-- RIVERISE Supabase schema
-- This file is meant to be run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'resident' check (role in ('resident', 'responder', 'admin')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sensors (
  id uuid primary key default gen_random_uuid(),
  station_id text not null unique,
  name text,
  latitude double precision,
  longitude double precision,
  status text not null default 'UNKNOWN' check (status in ('ONLINE','OFFLINE','STALE','UNKNOWN')),
  last_heartbeat timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.river_readings (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references public.sensors(station_id),
  water_level numeric,
  rate_of_rise numeric,
  flow_condition text,
  recorded_at timestamptz not null,
  sensor_status text not null default 'UNKNOWN' check (sensor_status in ('ONLINE','OFFLINE','STALE','UNKNOWN')),
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null check (severity in ('INFORMATION','WATCH','WARNING','CRITICAL')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  is_active boolean not null default true
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  created_by uuid references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.resident_safety_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'SAFE' check (status in ('SAFE')),
  latitude double precision,
  longitude double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  status text not null default 'PENDING' check (status in ('PENDING','ACKNOWLEDGED','RESPONDING','RESOLVED')),
  latitude double precision,
  longitude double precision,
  location_shared boolean not null default false,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.evacuation_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  capacity integer,
  status text not null default 'OPEN' check (status in ('OPEN','FULL','CLOSED')),
  contact_information text,
  created_at timestamptz not null default now()
);

create table if not exists public.safety_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other' check (category in ('Monitoring Station','Evacuation Center','Hospital','Emergency Services','River / Flood Area','Other')),
  latitude double precision,
  longitude double precision,
  address text,
  description text,
  contact text,
  capacity integer,
  status text default 'UNKNOWN' check (status in ('AVAILABLE','FULL','TEMPORARILY UNAVAILABLE','ACTIVE','INACTIVE','UNKNOWN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists river_readings_recorded_at_idx on public.river_readings(recorded_at desc);
create index if not exists river_readings_station_id_idx on public.river_readings(station_id);
create index if not exists sensors_station_id_idx on public.sensors(station_id);
create index if not exists alerts_active_idx on public.alerts(is_active, created_at desc);
create index if not exists announcements_active_idx on public.announcements(is_active, created_at desc);
create index if not exists sos_requests_status_idx on public.sos_requests(status, created_at desc);
create index if not exists sos_requests_active_expiry_idx on public.sos_requests(status, expires_at, created_at desc);
create index if not exists evacuation_centers_status_idx on public.evacuation_centers(status);
create index if not exists safety_locations_category_idx on public.safety_locations(category, status);

alter table public.profiles enable row level security;
alter table public.sensors enable row level security;
alter table public.river_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.announcements enable row level security;
alter table public.resident_safety_status enable row level security;
alter table public.sos_requests enable row level security;
alter table public.evacuation_centers enable row level security;
alter table public.safety_locations enable row level security;
alter table public.emergency_contacts enable row level security;

create policy "Residents can view public river data" on public.river_readings
for select using (true);

create policy "Residents can view public sensor metadata" on public.sensors
for select using (true);

create policy "Residents can view active alerts" on public.alerts
for select using (is_active = true);

create policy "Residents can view active announcements" on public.announcements
for select using (is_active = true);

create policy "Residents can view evacuation centers" on public.evacuation_centers
for select using (true);

create policy "Residents can view safety locations" on public.safety_locations
for select using (true);

create policy "Residents can view emergency contacts" on public.emergency_contacts
for select using (true);

create policy "Residents can read own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Residents can update own profile" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Residents can manage own safety status" on public.resident_safety_status
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Residents can create own SOS requests" on public.sos_requests
for insert with check (auth.uid() = user_id);

create policy "Residents can read own SOS requests" on public.sos_requests
for select using (auth.uid() = user_id);

create policy "Residents can update own SOS requests" on public.sos_requests
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Responders and admins can manage alerts" on public.alerts
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage announcements" on public.announcements
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage centers" on public.evacuation_centers
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage safety locations" on public.safety_locations
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage contacts" on public.emergency_contacts
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can view all safety statuses" on public.resident_safety_status
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage all SOS requests" on public.sos_requests
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can read sensor data" on public.sensors
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage sensor data" on public.sensors
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

create policy "Responders and admins can manage river readings" on public.river_readings
for all using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
) with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('responder', 'admin')
  )
);

-- Trigger to automatically set updated_at.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger sensors_set_updated_at
before update on public.sensors
for each row execute function public.set_updated_at();

create trigger safety_status_set_updated_at
before update on public.resident_safety_status
for each row execute function public.set_updated_at();

create trigger sos_requests_set_updated_at
before update on public.sos_requests
for each row execute function public.set_updated_at();

-- Optional: create a function for new users to insert profile records.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'resident'))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
