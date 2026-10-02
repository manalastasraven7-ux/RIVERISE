import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const DataContext = createContext({
  latestReading: null,
  readings: [],
  sensors: [],
  alerts: [],
  announcements: [],
  evacuationCenters: [],
  emergencyContacts: [],
  sosRequests: [],
  loading: true,
  error: null,
  refresh: async () => {},
});

export function DataProvider({ children }) {
  const [latestReading, setLatestReading] = useState(null);
  const [readings, setReadings] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [evacuationCenters, setEvacuationCenters] = useState([]);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [sosRequests, setSosRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const safeFetchOptionalTable = async (tableName, queryBuilder) => {
    try {
      const query = typeof queryBuilder === 'function' ? queryBuilder(supabase) : supabase.from(tableName).select('*');
      const { data, error } = await query;

      if (error) {
        const message = String(error.message || '');
        if (/does not exist|Could not find the table|schema cache/i.test(message)) {
          return { data: [] };
        }
        throw error;
      }

      return { data: data || [] };
    } catch (optionalError) {
      const message = String(optionalError?.message || '');
      if (/does not exist|Could not find the table|schema cache/i.test(message)) {
        return { data: [] };
      }
      throw optionalError;
    }
  };

  const fetchData = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setError('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [readingsResult, sensorsResult, alertsResult, announcementsResult, centersResult, sosResult, contactsResult] = await Promise.all([
        supabase.from('river_readings').select('*').order('recorded_at', { ascending: false }).limit(24),
        supabase.from('sensors').select('*').order('updated_at', { ascending: false }),
        supabase.from('alerts').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(10),
        safeFetchOptionalTable('evacuation_centers', (client) => client.from('evacuation_centers').select('*').order('name', { ascending: true })),
        supabase.from('sos_requests').select('*').order('created_at', { ascending: false }).limit(20),
        safeFetchOptionalTable('emergency_contacts', (client) => client.from('emergency_contacts').select('*').order('name', { ascending: true })),
      ]);

      if (readingsResult.error) throw readingsResult.error;
      if (sensorsResult.error) throw sensorsResult.error;
      if (alertsResult.error) throw alertsResult.error;
      if (announcementsResult.error) throw announcementsResult.error;
      if (centersResult.error) throw centersResult.error;
      if (sosResult.error) throw sosResult.error;
      if (contactsResult.error) throw contactsResult.error;

      const orderedReadings = [...(readingsResult.data || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      setReadings(orderedReadings);
      setLatestReading(orderedReadings.at(-1) || null);
      setSensors(sensorsResult.data || []);
      setAlerts(alertsResult.data || []);
      setAnnouncements(announcementsResult.data || []);
      setEvacuationCenters(centersResult.data || []);
      setSosRequests(sosResult.data || []);
      setEmergencyContacts(contactsResult.data || []);
    } catch (fetchError) {
      setError(fetchError.message || 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!isSupabaseConfigured || !supabase) return undefined;

    const channel = supabase
      .channel('riverise-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'river_readings' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensors' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_requests' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const value = useMemo(
    () => ({
      latestReading,
      readings,
      sensors,
      alerts,
      announcements,
      evacuationCenters,
      emergencyContacts,
      sosRequests,
      loading,
      error,
      refresh: fetchData,
    }),
    [latestReading, readings, sensors, alerts, announcements, evacuationCenters, emergencyContacts, sosRequests, loading, error],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
