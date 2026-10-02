# RIVERISE

RIVERISE is a real-data river monitoring and early warning application for residents and responders.

## Stack
- React + Vite
- Supabase
- Recharts
- Leaflet / OpenStreetMap
- JavaScript

## Required environment variables
Create a local `.env` file based on `.env.example` and add your Supabase project values.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_RIVER_STALE_MINUTES=15
```

## Supabase setup
1. Create a Supabase project.
2. For a new project, run `supabase/schema.sql`. For an existing project, do not rerun the baseline schema; verify that its required tables and policies already exist.
3. Apply `supabase/migrations/20260923_community_sos_network.sql` if it has not already been applied. This is required before the new SOS privacy functions are used.
4. Apply each `20261002_*` migration once, in filename order:
	- `20261002_alert_lifecycle.sql`
	- `20261002_community_metadata.sql`
	- `20261002_profile_roles_sos_privacy.sql`
5. Have an authorized administrator assign responder/admin roles to trusted accounts. Signup metadata is not used for role assignment.
6. Add only verified sensor, alert, announcement, evacuation-center, and emergency-contact information.

## Important notes
- When readings are unavailable, the UI uses clearly labeled, in-memory DEMO MODE examples. They are not written to Supabase and must not be treated as live conditions or official alerts.
- Real evacuation centers and contacts are not invented. A center's operational status and a phone number remain unconfirmed until an authorized user verifies them.
- SOS submission requires resident confirmation. GPS coordinates are shared only after consent; a manually entered place can be sent without public map coordinates. An SOS does not automatically contact emergency services.
- The SQL migrations in `supabase/migrations` are not applied automatically by the app. Have an authorized Supabase administrator review and apply them before using the new database-backed workflows.
- Future Arduino / ESP32 / LoRa device ingestion should be routed through secure backend endpoints or Supabase Edge Functions.

## Local run
```bash
npm install
npm run dev
```
