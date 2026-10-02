-- Add optional verified/display metadata without inventing center or contact records.

alter table public.announcements
  add column if not exists category text,
  add column if not exists affected_location text,
  add column if not exists issuing_office text;

alter table public.evacuation_centers
  add column if not exists barangay text,
  add column if not exists status_verified boolean not null default false,
  add column if not exists status_verified_at timestamptz,
  add column if not exists status_verified_by uuid references auth.users(id);

alter table public.emergency_contacts
  add column if not exists category text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz;

alter table public.sensors
  add column if not exists location text,
  add column if not exists barangay text;