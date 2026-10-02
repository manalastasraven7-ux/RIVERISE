import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCommunitySos } from '../services/CommunitySosContext';

export default function CommunitySosAlert() {
  const { user } = useAuth();
  const {
    viewerLocation,
    locationPermissionState,
    locationError,
    nearbySos,
    rpcError,
    subscriptionStatus,
    subscriptionError,
    requestViewerLocation,
  } = useCommunitySos();

  return (
    <section className="panel community-sos-panel" aria-live="polite">
      <div className="section-header">
        <div>
          <p className="eyebrow">Community response</p>
          <h2>SOS alerts nearby</h2>
        </div>
        {!viewerLocation ? (
          <button
            className="filter-button is-active"
            type="button"
            onClick={requestViewerLocation}
            disabled={locationPermissionState === 'Requesting'}
          >
            {locationPermissionState === 'Requesting' ? 'Checking location...' : 'Use My Current Location'}
          </button>
        ) : null}
      </div>

      {!user ? <div className="empty-state">Please sign in to receive nearby SOS alerts.</div> : null}
      {locationError ? <div className="error-box">{locationError}</div> : null}
      {rpcError ? <div className="error-box">Unable to load nearby SOS alerts.</div> : null}
      {subscriptionError ? <div className="error-box">Community SOS realtime unavailable. Please try again later.</div> : null}

      {viewerLocation && nearbySos.length ? (
        <div className="community-sos-alert">
          <strong>SOS ALERT NEARBY</strong>
          <p>A RIVERISE user nearby has requested emergency assistance.</p>
          <div className="list-item"><span>Status</span><strong>NEEDS HELP</strong></div>
          <div className="list-item"><span>Distance</span><strong>{Math.round(nearbySos[0].distance_meters)} m</strong></div>
          <div className="list-item"><span>Time</span><strong>{new Date(nearbySos[0].created_at).toLocaleString()}</strong></div>
          <Link className="filter-button is-active" to="/community-safety-map">View on map</Link>
        </div>
      ) : (
        <div className="empty-state">
          {!viewerLocation
            ? 'Location permission is required to receive nearby SOS alerts.'
            : 'No active SOS alerts within the configured emergency radius.'}
        </div>
      )}

      {import.meta.env.DEV && viewerLocation ? (
        <div className="muted community-sos-debug">
          Realtime: {subscriptionStatus} | Radius: configured | Nearby records: {nearbySos.length}
        </div>
      ) : null}
    </section>
  );
}
