import { createClient } from '@supabase/supabase-js';
import { appConfig } from '../config/appConfig';

export const supabase =
  appConfig.supabaseUrl && appConfig.supabaseAnonKey
    ? createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = Boolean(supabase);

export function getSupabaseErrorMessage(error, fallback = 'Something went wrong.') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}
