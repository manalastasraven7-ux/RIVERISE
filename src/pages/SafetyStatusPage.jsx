import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { cancelOwnSos, getResidentSafetyStatus, saveResidentSafetyStatus, submitSosRequest } from '../services/riverDataService';
import { supabase } from '../services/supabaseClient';
import { useData } from '../services/DataContext';

function getLocationOnce() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ location: null, message: 'Location services are not supported by this browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        message: null,
      }),
      (positionError) => {
        if (positionError.code === 1) {
          resolve({ location: null, message: 'Location permission was denied. Please allow location access to use the current location. SOS was sent without location information.' });
        } else if (positionError.code === 3) {
          resolve({ location: null, message: 'Location request timed out. Please try again. SOS was sent without location information.' });
        } else {
          resolve({ location: null, message: 'Unable to determine your current location. Please check your device location settings and try again. SOS was sent without location information.' });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function formatStatusTime(value) {
  if (!value) return 'No status recorded yet';
  return new Date(value).toLocaleString();
}

const activeSosStatuses = new Set(['PENDING', 'ACKNOWLEDGED', 'RESPONDING']);

export default function SafetyStatusPage() {
  const { user, loading: authLoading, error: authError, retry: retryAuth } = useAuth();
  const { sosRequests, refresh } = useData();
  const [safetyStatus, setSafetyStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [action, setAction] = useState(null);
  const [sosSubmitted, setSosSubmitted] = useState(false);
  const [submittedSosRequest, setSubmittedSosRequest] = useState(null);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const activeSosRequest = useMemo(
    () => {
      const isActive = (request) => activeSosStatuses.has(request?.status)
        && (!request.expires_at || new Date(request.expires_at).getTime() > Date.now());
      return (isActive(submittedSosRequest) && submittedSosRequest)
        || sosRequests.find((request) => request.user_id === user?.id && isActive(request));
    },
    [sosRequests, submittedSosRequest, user],
  );

  const activeSos = Boolean(sosSubmitted || activeSosRequest);

  useEffect(() => {
    let isMounted = true;

    const loadStatus = async () => {
      if (!user) {
        if (isMounted) {
          setSafetyStatus(null);
          setLoadingStatus(false);
        }
        return;
      }

      setLoadingStatus(true);
      const result = await getResidentSafetyStatus();
      if (isMounted) {
        setSafetyStatus(result.data || null);
        setError(result.error?.message || null);
        setLoadingStatus(false);
      }
    };

    loadStatus();

    if (!user || !supabase) {
      return () => {
        isMounted = false;
      };
    }

    const channel = supabase
      .channel(`resident-safety-status-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resident_safety_status', filter: `user_id=eq.${user.id}` },
        loadStatus,
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSafe = async () => {
    if (!user || action) return;

    if (activeSosRequest && !window.confirm('Your SOS is active. Marking yourself SAFE will resolve that help request. Continue?')) return;

    setAction('safe');
    setError(null);
    setConfirmation(null);

    try {
      if (activeSosRequest) {
        const cancelResult = await cancelOwnSos(activeSosRequest.id);
        if (cancelResult.error || !cancelResult.data) {
          setError(cancelResult.error?.message || 'Active SOS could not be resolved.');
          return;
        }
        setSosSubmitted(false);
        setSubmittedSosRequest(null);
      }

      const result = await saveResidentSafetyStatus({ status: 'SAFE', latitude: null, longitude: null, notes: null });

      if (result.error || !result.data) {
        setError(result.error?.message || 'SAFE status could not be saved.');
      } else {
        setSafetyStatus(result.data);
        setConfirmation('Your safety status has been updated to SAFE.');
        await refresh();
      }
    } catch (actionError) {
      setError(actionError.message || 'SAFE status could not be saved.');
    } finally {
      setAction(null);
    }
  };

  const handleSos = async () => {
    if (!user || action) return;

    if (activeSos) {
      setError(null);
      setConfirmation(`SOS ACTIVE. Your help request is currently active${activeSosRequest?.status ? ` (${activeSosRequest.status}).` : '.'}`);
      return;
    }

    if (!window.confirm('Are you sure you need help? This will send an SOS request to authorized responders.')) return;

    setAction('sos');
    setError(null);
    setConfirmation(null);

    try {
      const shareLocation = window.confirm('Would you like to share your current location with responders for this SOS?');
      if (!shareLocation) {
        setError('Location sharing is required to show your location to nearby responders.');
        return;
      }

      const locationResult = await getLocationOnce();
      if (!locationResult.location) {
        setError(locationResult.message || 'Location sharing is required to show your location to nearby responders.');
        return;
      }

      const result = await submitSosRequest({
        latitude: locationResult.location?.latitude,
        longitude: locationResult.location?.longitude,
        note: null,
        locationShared: true,
      });

      if (import.meta.env.DEV) {
        if (result.error) {
          console.error('[Community SOS] Account A SOS submission failed', result.error);
        } else {
          console.debug('[Community SOS] Account A SOS record returned', {
            sosId: result.data?.id || null,
            status: result.data?.status || null,
          });
        }
      }

      if (result.error || !result.data) {
        setError(result.error?.message || 'SOS request could not be submitted.');
      } else {
        setSosSubmitted(true);
        setSubmittedSosRequest(result.data);
        setConfirmation(result.existing
          ? `SOS ACTIVE. Your help request is currently active${result.data.status ? ` (${result.data.status}).` : '.'}`
          : locationResult.location
          ? 'SOS SENT. Help request submitted. Responders have been notified with your shared location.'
          : 'SOS SENT. Help request submitted without location information. Responders have been notified.');
        await refresh();
      }
    } catch (actionError) {
      setError(actionError.message || 'SOS request could not be submitted.');
    } finally {
      setAction(null);
    }
  };

  if (authLoading) {
    return <section className="dashboard-shell"><div className="empty-state">Checking sign-in status...</div></section>;
  }

  if (authError) {
    return (
      <section className="dashboard-shell">
        <div className="section-header"><h2>My Safety Status</h2></div>
        <div className="panel safety-status-card">
          <div className="error-box">Unable to verify your sign-in status. Please refresh the page and try again.</div>
          <button className="filter-button is-active" type="button" onClick={retryAuth}>Try Again</button>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="dashboard-shell">
        <div className="section-header"><h2>My Safety Status</h2></div>
        <div className="panel safety-status-card">
          <h3>Sign in required</h3>
          <p className="muted">Please sign in to submit an SOS request or update your safety status.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Community response</p>
          <h2>My Safety Status</h2>
        </div>
      </div>

      <div className="panel safety-status-card">
        <div className="safety-status-card__heading">
          <div>
            <h3>Quick response</h3>
            <p className="muted">Choose one action to update responders about your current safety.</p>
          </div>
          <div className={`safety-status-badge ${activeSos ? 'safety-status-badge--sos' : ''}`}>
            {activeSos ? 'SOS ACTIVE' : safetyStatus?.status || 'NO STATUS'}
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}
        {confirmation ? <div className="success-box">{confirmation}</div> : null}

        <div className="safety-status-actions">
          <button
            className="safety-action-button safety-action-button--sos"
            type="button"
            onClick={handleSos}
            disabled={Boolean(action)}
          >
            {action === 'sos' ? 'Sending SOS...' : activeSos ? 'SOS ACTIVE' : 'SOS / NEED HELP'}
          </button>
          <button
            className="safety-action-button safety-action-button--safe"
            type="button"
            onClick={handleSafe}
            disabled={Boolean(action)}
          >
            {action === 'safe' ? 'Updating...' : 'I AM SAFE'}
          </button>
        </div>

        <div className="safety-status-meta">
          <span>Latest saved status</span>
          <strong>{loadingStatus ? 'Loading...' : safetyStatus?.status || 'No status recorded'}</strong>
          <span>{formatStatusTime(safetyStatus?.updated_at || safetyStatus?.created_at)}</span>
        </div>

        {activeSosRequest ? (
          <div className="safety-status-active-detail">
            <strong>Your emergency request is active.</strong>
            <span>Status: {activeSosRequest.status}</span>
            <span>Reported {formatStatusTime(activeSosRequest.created_at)}</span>
            <button
              className="filter-button"
              type="button"
              onClick={async () => {
                if (!window.confirm('Cancel your active SOS request?')) return;
                setAction('cancel');
                setError(null);
                try {
                  const result = await cancelOwnSos(activeSosRequest.id);
                  if (result.error || !result.data) {
                    setError(result.error?.message || 'SOS request could not be resolved.');
                  } else {
                    setSosSubmitted(false);
                    setSubmittedSosRequest(null);
                    setConfirmation('Your SOS request has been resolved.');
                    await refresh();
                  }
                } catch (actionError) {
                  setError(actionError.message || 'SOS request could not be resolved.');
                } finally {
                  setAction(null);
                }
              }}
              disabled={Boolean(action)}
            >
              {action === 'cancel' ? 'Resolving...' : 'Cancel SOS'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
