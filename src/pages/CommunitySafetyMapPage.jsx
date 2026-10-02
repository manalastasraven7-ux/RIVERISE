import { useEffect, useState } from 'react';
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

function hasCoordinates(location) {
  return location?.latitude !== null
    && location?.latitude !== undefined
    && location?.longitude !== null
    && location?.longitude !== undefined
    && Number.isFinite(Number(location.latitude))
    && Number.isFinite(Number(location.longitude));
}

function distanceKm(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const term = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term));
}

export default function CommunitySafetyMapPage() {
  const { evacuationCenters = [], loading, error } = useData();
  const {
    viewerLocation,
    locationPermissionState,
    locationError,
    nearbySos,
    rpcError,
    requestViewerLocation,
    isResponder,
  } = useCommunitySos();
  const [placeName, setPlaceName] = useState('');
  const nearbyCenters = evacuationCenters
    .filter((center) => hasCoordinates(center))
    .map((center) => ({ ...center, distance: viewerLocation ? distanceKm(viewerLocation, center) : null }))
    .sort((first, second) => (first.distance ?? Infinity) - (second.distance ?? Infinity));
  const locationStatus = locationError
    || (locationPermissionState === 'Requesting'
      ? 'Requesting your current location...'
      : viewerLocation
        ? placeName.trim() || 'Place name unavailable. Add a barangay or landmark for a readable label.'
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
        {viewerLocation ? <div className="coordinate-detail">Coordinates: {viewerLocation.latitude.toFixed(4)}, {viewerLocation.longitude.toFixed(4)}</div> : null}
        {viewerLocation ? <label className="field-label" htmlFor="map-place-name">Place name or landmark<input id="map-place-name" className="form-control" value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="Enter your barangay, purok, or landmark" /></label> : null}
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

          {nearbyCenters.map((center) => (
            <CircleMarker key={center.id} center={[Number(center.latitude), Number(center.longitude)]} radius={8} pathOptions={{ color: '#16845b', fillColor: '#55c98b', fillOpacity: 0.88 }}>
              <Popup><strong>{center.name}</strong><div>{[center.address, center.barangay].filter(Boolean).join(', ') || 'Address not configured'}</div><div>Status: {center.status_verified ? center.status : 'Not confirmed'}</div>{center.contact_information ? <div>Contact: {center.contact_information}</div> : null}<a href={`https://www.openstreetmap.org/?mlat=${center.latitude}&mlon=${center.longitude}#map=16/${center.latitude}/${center.longitude}`} target="_blank" rel="noreferrer">Open map</a></Popup>
            </CircleMarker>
          ))}

          {isResponder ? nearbySos.map((request) => (
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
          )) : null}
        </MapContainer>
      </div>

      {rpcError ? <div className="error-box" style={{ marginTop: '1rem' }}>Unable to load nearby SOS alerts.</div> : null}
      {viewerLocation && nearbySos.length ? (
        <div className="warning-box community-sos-banner" style={{ marginTop: '1rem' }}>
          <strong>SOS ALERT NEARBY</strong>
          <span>A RIVERISE user nearby has requested emergency assistance.</span>
        </div>
      ) : null}
      {viewerLocation && !isResponder ? (
        <div className="empty-state" style={{ marginTop: '1rem' }}>
          Exact SOS locations are only available to authorized responders.
        </div>
      ) : null}
      <section className="panel evacuation-nearby-list">
        <div className="section-header"><h3>Evacuation Centers Near Me</h3></div>
        {nearbyCenters.length ? <div className="stacked-list">{nearbyCenters.map((center) => (
          <article className="list-item" key={center.id}>
            <div><strong>{center.name}</strong><span>{[center.address, center.barangay].filter(Boolean).join(', ') || 'Address not configured'}</span><span>Status: {center.status_verified ? center.status : 'Not confirmed'}</span>{center.contact_information ? <span>{center.contact_information}</span> : null}</div>
            <div className="response-item__actions">{center.distance !== null ? <span>{center.distance.toFixed(1)} km away</span> : null}<a className="filter-button" href={`https://www.openstreetmap.org/?mlat=${center.latitude}&mlon=${center.longitude}#map=16/${center.latitude}/${center.longitude}`} target="_blank" rel="noreferrer">Directions</a></div>
          </article>
        ))}</div> : <div className="empty-state">No evacuation center locations are configured.</div>}
      </section>
    </section>
  );
}
