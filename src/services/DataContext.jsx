import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { createDemoData } from './demoData';

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
  demoMode: false,
  now: Date.now(),
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
  const [demoMode, setDemoMode] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const applyDemoData = (preserveConfiguredData = false, configured = {}) => {
    const demo = createDemoData();
    setReadings(demo.readings);
    setLatestReading(demo.readings.at(-1) || null);
    setSensors(preserveConfiguredData && configured.sensors?.length ? configured.sensors : demo.sensors);
    setAlerts(preserveConfiguredData && configured.alerts?.length ? configured.alerts : demo.alerts);
    setAnnouncements(preserveConfiguredData && configured.announcements?.length ? configured.announcements : demo.announcements);
    setEvacuationCenters(configured.evacuationCenters || []);
    setEmergencyContacts(configured.emergencyContacts || []);
    setSosRequests(configured.sosRequests || []);
    setDemoMode(true);
  };

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
      applyDemoData();
      setLoading(false);
      setError('Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [readingsResult, sensorsResult, alertsResult, announcementsResult, centersResult, sosResult, contactsResult] = await Promise.all([
        supabase.from('river_readings').select('*').order('recorded_at', { ascending: false }).limit(1000),
        supabase.from('sensors').select('*').order('updated_at', { ascending: false }),
        supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(100),
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
      const latestValidReading = orderedReadings.filter((reading) => (
        reading.water_level !== null
        && reading.water_level !== undefined
        && reading.water_level !== ''
        && Number.isFinite(Number(reading.water_level))
        && Number.isFinite(new Date(reading.recorded_at).getTime())
      )).at(-1) || null;
      const configured = {
        sensors: sensorsResult.data || [],
        alerts: alertsResult.data || [],
        announcements: announcementsResult.data || [],
        evacuationCenters: centersResult.data || [],
        sosRequests: sosResult.data || [],
        emergencyContacts: contactsResult.data || [],
      };

      if (!latestValidReading) {
        applyDemoData(true, configured);
      } else {
        setReadings(orderedReadings);
        setLatestReading(latestValidReading);
        setSensors(configured.sensors);
        setAlerts(configured.alerts);
        setAnnouncements(configured.announcements);
        setEvacuationCenters(configured.evacuationCenters);
        setSosRequests(configured.sosRequests);
        setEmergencyContacts(configured.emergencyContacts);
        setDemoMode(false);
      }
    } catch (fetchError) {
      applyDemoData();
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
      demoMode,
      now,
      refresh: fetchData,
    }),
    [latestReading, readings, sensors, alerts, announcements, evacuationCenters, emergencyContacts, sosRequests, loading, error, demoMode, now],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
