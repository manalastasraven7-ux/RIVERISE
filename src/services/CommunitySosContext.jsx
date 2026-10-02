import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { appConfig } from '../config/appConfig';
import { fetchNearbyActiveSos } from './riverDataService';
import { supabase } from './supabaseClient';

const CommunitySosContext = createContext({
  viewerLocation: null,
  locationPermissionState: 'Not requested',
  locationError: null,
  nearbySos: [],
  rpcError: null,
  subscriptionStatus: 'DISABLED',
  subscriptionError: null,
  requestViewerLocation: () => {},
});

function debugLog(...args) {
  if (import.meta.env.DEV) console.debug('[Community SOS]', ...args);
}

function getLocationError(code) {
  if (code === 1) return 'Location permission is required to receive nearby SOS alerts.';
  if (code === 3) return 'Location request timed out. Try again to receive nearby SOS alerts.';
  return 'Unable to determine your location. Check device location settings and try again.';
}

export function CommunitySosProvider({ children }) {
  const { user } = useAuth();
  const [viewerLocation, setViewerLocation] = useState(null);
  const [locationPermissionState, setLocationPermissionState] = useState('Not requested');
  const [locationError, setLocationError] = useState(null);
  const [nearbySos, setNearbySos] = useState([]);
  const [rpcError, setRpcError] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState('DISABLED');
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [broadcastVersion, setBroadcastVersion] = useState(0);

  const requestViewerLocation = useCallback(() => {
    if (!user) {
      setLocationError('Please sign in to receive nearby SOS alerts.');
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setLocationPermissionState('Insecure');
      setLocationError('Location access requires a secure connection. Open RIVERISE over HTTPS or use localhost.');
      return;
    }

    if (!navigator.geolocation) {
      setLocationPermissionState('Unsupported');
      setLocationError('Location services are not supported by this browser.');
      return;
    }

    setLocationPermissionState('Requesting');
    setLocationError(null);
    debugLog('requesting Account B location');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setViewerLocation(nextLocation);
        setLocationPermissionState('Granted');
        debugLog('Account B location received', nextLocation);
      },
      (positionError) => {
        setLocationPermissionState('Error');
        setLocationError(getLocationError(positionError.code));
        debugLog('Account B location error', positionError.code);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    let channel = null;

    if (!user || !supabase) {
      setNearbySos([]);
      setSubscriptionStatus(!user ? 'SIGNED_OUT' : 'DISABLED');
      return undefined;
    }

    const connectToCommunitySos = async () => {
      debugLog('authenticated user opening community SOS subscription', user.id);
      setSubscriptionStatus('SUBSCRIBING');
      setSubscriptionError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (sessionError || !accessToken || !isMounted) {
        const message = sessionError?.message || 'No authenticated Supabase session available for Realtime.';
        if (isMounted) {
          setSubscriptionStatus('CHANNEL_ERROR');
          setSubscriptionError(message);
        }
        if (import.meta.env.DEV) console.error('community-sos: CHANNEL_ERROR', sessionError || new Error(message));
        return;
      }

      await supabase.realtime.setAuth(accessToken);
      if (!isMounted) return;

      const existingCommunityChannels = supabase
        .getChannels()
        .filter((existingChannel) => existingChannel.topic === 'realtime:community-sos');
      if (existingCommunityChannels.length) {
        debugLog('removing stale community-sos channels', existingCommunityChannels.length);
        await Promise.all(existingCommunityChannels.map((existingChannel) => supabase.removeChannel(existingChannel)));
      }
      if (!isMounted) return;

      channel = supabase
        .channel('community-sos', { config: { private: true } })
        .on('broadcast', { event: 'sos_changed' }, (payload) => {
          if (import.meta.env.DEV) console.log('community-sos: EVENT RECEIVED', payload);
          setBroadcastVersion((version) => version + 1);
        });

      channel.subscribe((status, error) => {
        if (!isMounted) return;
        setSubscriptionStatus(status);

        if (status === 'SUBSCRIBED') {
          if (import.meta.env.DEV) console.log('community-sos: SUBSCRIBED');
        } else if (status === 'CHANNEL_ERROR') {
          if (import.meta.env.DEV) console.error('community-sos: CHANNEL_ERROR', error);
        } else if (status === 'TIMED_OUT') {
          if (import.meta.env.DEV) console.error('community-sos: TIMED_OUT');
        } else if (status === 'CLOSED') {
          if (import.meta.env.DEV) console.warn('community-sos: CLOSED');
        }

        if (error) {
          setSubscriptionError(error.message || 'Community SOS realtime subscription failed.');
        }
        debugLog('realtime subscription status', status, error || '');
      });
    };

    connectToCommunitySos().catch((connectionError) => {
      if (!isMounted) return;
      setSubscriptionStatus('CHANNEL_ERROR');
      setSubscriptionError(connectionError.message || 'Community SOS realtime subscription failed.');
      if (import.meta.env.DEV) console.error('community-sos: CHANNEL_ERROR', connectionError);
    });

    return () => {
      isMounted = false;
      debugLog('unsubscribing from community-sos');
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    let refreshInterval = null;

    if (!user || !viewerLocation || !supabase) {
      setNearbySos([]);
      return undefined;
    }

    const loadNearbySos = async (source) => {
      debugLog('loading nearby SOS', {
        source,
        viewerLocation,
        radiusMeters: appConfig.sosAlertRadiusMeters,
      });
      const result = await fetchNearbyActiveSos(viewerLocation);
      if (!isMounted) return;
      setNearbySos(result.data || []);
      setRpcError(result.error?.message || null);
      debugLog('nearby SOS result', { count: result.data?.length || 0, error: result.error?.message || null });
      if (result.error) console.error('[Community SOS] get_nearby_active_sos error', result.error);
    };

    loadNearbySos(broadcastVersion ? 'realtime-sos_changed' : 'initial-load');
    refreshInterval = window.setInterval(() => loadNearbySos('expiry-refresh'), 30000);

    return () => {
      isMounted = false;
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, [broadcastVersion, user?.id, viewerLocation]);

  useEffect(() => {
    if (!user) {
      setViewerLocation(null);
      setLocationPermissionState('Not requested');
      setLocationError(null);
      setNearbySos([]);
    }
    debugLog('authentication state', user ? 'authenticated' : 'signed out');
  }, [user]);

  const value = useMemo(() => ({
    viewerLocation,
    locationPermissionState,
    locationError,
    nearbySos,
    rpcError,
    subscriptionStatus,
    subscriptionError,
    requestViewerLocation,
  }), [viewerLocation, locationPermissionState, locationError, nearbySos, rpcError, subscriptionStatus, subscriptionError, requestViewerLocation]);

  return <CommunitySosContext.Provider value={value}>{children}</CommunitySosContext.Provider>;
}

export function useCommunitySos() {
  return useContext(CommunitySosContext);
}
