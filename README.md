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
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
3. Configure a minimal Auth flow for residents and responders.
4. Add rows for sensors, river readings, alerts, announcements, evacuation centers, and emergency contacts as real operational data becomes available.
5. Ensure Row Level Security is enabled and policies are enforced.

## Important notes
- This app does not fabricate sensor values or emergency data.
- If Supabase credentials or live sensor data are not available, the UI clearly shows that status instead of showing fake readings.
- Future Arduino / ESP32 / LoRa device ingestion should be routed through secure backend endpoints or Supabase Edge Functions.

## Local run
```bash
npm install
npm run dev
```
