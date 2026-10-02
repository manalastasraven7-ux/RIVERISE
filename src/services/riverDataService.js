import { supabase, isSupabaseConfigured, getSupabaseErrorMessage } from './supabaseClient';
import { appConfig } from '../config/appConfig';

function debugSosLog(...args) {
  if (import.meta.env.DEV) console.debug('[Community SOS]', ...args);
}

export async function getLatestRiverReading() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data, error } = await supabase
    .from('river_readings')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

export async function getRiverReadings(limit = 24) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data, error } = await supabase
    .from('river_readings')
    .select('*')
    .order('recorded_at', { ascending: true })
    .limit(limit);

  return { data: data || [], error };
}

export async function saveResidentSafetyStatus({ status, latitude, longitude, notes }) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new Error('You must sign in before updating your safety status.') };
  }

  const { data, error } = await supabase
    .from('resident_safety_status')
    .upsert(
      {
        user_id: user.id,
        status,
        latitude,
        longitude,
        notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  return { data, error };
}

export async function getResidentSafetyStatus() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new Error('You must sign in before viewing your safety status.') };
  }

  const { data, error } = await supabase
    .from('resident_safety_status')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return { data, error };
}

export async function submitSosRequest({ latitude, longitude, note, locationShared = false }) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: new Error('You must sign in before submitting an SOS request.') };
  }

  debugSosLog('SOS submission started', { userId: user.id, locationShared: Boolean(locationShared) });

  const validCoordinates = latitude !== null
    && latitude !== undefined
    && longitude !== null
    && longitude !== undefined
    && Number.isFinite(Number(latitude))
    && Number.isFinite(Number(longitude))
    && Number(latitude) >= -90
    && Number(latitude) <= 90
    && Number(longitude) >= -180
    && Number(longitude) <= 180;

  const manualLocation = String(note || '').trim();
  if ((locationShared && !validCoordinates) || (!locationShared && !manualLocation)) {
    const locationError = new Error('Share your current location or enter a place name before submitting an SOS.');
    if (import.meta.env.DEV) console.error('[Community SOS] submit_own_sos validation error', locationError);
    return { data: null, error: locationError };
  }

  const { data, error } = await supabase.rpc('submit_own_sos', {
    sos_latitude: locationShared ? Number(latitude) : null,
    sos_longitude: locationShared ? Number(longitude) : null,
    sos_note: manualLocation || null,
    sos_expires_at: new Date(Date.now() + appConfig.sosExpiryMinutes * 60 * 1000).toISOString(),
  });

  const sosRecord = Array.isArray(data) ? data[0] || null : data;
  if (error) {
    if (import.meta.env.DEV) console.error('[Community SOS] submit_own_sos RPC error', error);
  } else if (!sosRecord) {
    if (import.meta.env.DEV) console.error('[Community SOS] submit_own_sos returned no SOS record');
  } else {
    debugSosLog('submit_own_sos RPC success', {
      sosId: sosRecord?.id || null,
      status: sosRecord?.status || null,
      createdAt: sosRecord?.created_at || null,
    });
  }

  return { data: sosRecord, error, existing: false };
}

export async function fetchNearbyActiveSos({ latitude, longitude }) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data, error } = await supabase.rpc('get_nearby_active_sos', {
    viewer_latitude: latitude,
    viewer_longitude: longitude,
    radius_meters: appConfig.sosAlertRadiusMeters,
  });

  return { data: data || [], error };
}

export async function cancelOwnSos(requestId) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data, error } = await supabase.rpc('cancel_own_sos', { request_id: requestId });
  return { data, error };
}

export async function fetchAlertHistory() {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: new Error('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.') };
  }

  const { data, error } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
  return { data: data || [], error };
}

export function describeSupabaseSetupError(error) {
  return getSupabaseErrorMessage(error, 'Supabase configuration is required.');
}
