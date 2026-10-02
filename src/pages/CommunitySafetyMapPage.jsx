import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { useData } from '../services/DataContext';
import { useCommunitySos } from '../services/CommunitySosContext';

const defaultMapCenter = [12.8797, 121.774];

function MapView({ userLocation }) {
  const map = useMap();

  useEffect(() => {
    if (userLocation) map.setView([userLocation.latitude, userLocation.longitude], 15);
  }, [map, userLocation]);

  return null;
}

export default function CommunitySafetyMapPage() {
  const { loading, error } = useData();
  const {
    viewerLocation,
    locationPermissionState,
    locationError,
    nearbySos,
    rpcError,
    requestViewerLocation,
  } = useCommunitySos();
  const locationStatus = locationError
    || (locationPermissionState === 'Requesting'
      ? 'Requesting your current location...'
      : viewerLocation
        ? `Current location: ${viewerLocation.latitude.toFixed(4)}, ${viewerLocation.longitude.toFixed(4)}`
        : 'Location permission is required to receive nearby SOS alerts.');

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Community safety</p>
          <h2>Current Location Safety Map</h2>
        </div>
        <div>
          <button type="button" className="filter-button is-active" onClick={requestViewerLocation} disabled={locationPermissionState === 'Requesting'}>
            {locationPermissionState === 'Requesting' ? 'Checking location...' : 'Use My Current Location'}
          </button>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading safety map...</div> : null}
      {locationError ? <div className="warning-box" style={{ marginBottom: '1rem' }}>{locationError}</div> : null}

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="muted">{locationStatus}</div>
      </div>

      <div className="panel panel--wide" style={{ padding: 0, overflow: 'hidden' }}>
        <MapContainer
          center={viewerLocation ? [viewerLocation.latitude, viewerLocation.longitude] : defaultMapCenter}
          zoom={viewerLocation ? 15 : 6}
          style={{ height: '560px', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapView userLocation={viewerLocation} />

          {viewerLocation ? (
            <CircleMarker center={[viewerLocation.latitude, viewerLocation.longitude]} radius={10} pathOptions={{ color: '#2563eb', fillColor: '#60a5fa', fillOpacity: 0.85 }}>
              <Popup><strong>You are here</strong></Popup>
            </CircleMarker>
          ) : null}

          {nearbySos.map((request) => (
            <CircleMarker
              key={request.id}
              center={[request.latitude, request.longitude]}
              radius={12}
              pathOptions={{ color: '#ef4444', fillColor: '#f87171', fillOpacity: 0.85 }}
            >
              <Popup>
                <strong>Community SOS</strong>
                <div>Needs Help</div>
                <div>Reported {new Date(request.created_at).toLocaleString()}</div>
                <div>Distance: {Math.round(request.distance_meters)} m</div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {rpcError ? <div className="error-box" style={{ marginTop: '1rem' }}>Unable to load nearby SOS alerts.</div> : null}
      {viewerLocation && nearbySos.length ? (
        <div className="warning-box community-sos-banner" style={{ marginTop: '1rem' }}>
          <strong>SOS ALERT NEARBY</strong>
          <span>A RIVERISE user nearby has requested emergency assistance.</span>
        </div>
      ) : null}
    </section>
  );
}
