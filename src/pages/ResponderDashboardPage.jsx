import { Link } from 'react-router-dom';
import { getRiskLevel, getSensorStatus } from '../config/appConfig';
import { getCurrentRateOfRise } from '../config/riverMetrics';
import useResponderResponses from '../services/useResponderResponses';
import { useData } from '../services/DataContext';
import StatusBadge from '../components/StatusBadge';

export default function ResponderDashboardPage() {
  const { latestReading, readings, sensors, alerts, evacuationCenters, announcements, demoMode, now } = useData();
  const { responses, loading, error } = useResponderResponses();
  const sensor = sensors.find((item) => item.station_id === latestReading?.station_id);
  const readingWithSensorStatus = latestReading && sensor?.status
    ? { ...latestReading, sensor_status: sensor.status }
    : latestReading;
  const sensorStatus = getSensorStatus(readingWithSensorStatus, undefined, now);
  const currentRisk = sensorStatus === 'ONLINE' ? getRiskLevel(latestReading?.water_level) : 'UNAVAILABLE';
  const rate = getCurrentRateOfRise(readings, latestReading?.station_id);
  const safeResponses = responses.filter((response) => response.response_type === 'SAFE');
  const sosResponses = responses.filter((response) => response.response_type === 'SOS');
  const pendingSos = sosResponses.filter((response) => ['PENDING', 'ACKNOWLEDGED', 'RESPONDING'].includes(response.status));
  const resolvedSos = sosResponses.filter((response) => response.status === 'RESOLVED');
  const latestSafe = safeResponses.slice(0, 4);
  const latestSos = [...sosResponses].sort((a, b) => {
    const priority = (status) => status === 'PENDING' ? 0 : status === 'ACKNOWLEDGED' || status === 'RESPONDING' ? 1 : 2;
    return priority(a.status) - priority(b.status) || new Date(b.created_at) - new Date(a.created_at);
  }).slice(0, 5);

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div><p className="eyebrow">Authorized response team</p><h2>Responder Dashboard</h2></div>
      </div>
      {demoMode ? <div className="demo-banner">DEMO MODE · Example sensor readings only</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading resident responses...</div> : null}
      <div className="dashboard-grid dashboard-grid--summary">
        <div className="summary-card">
          <h3>Current river condition</h3>
          <div>{latestReading && sensorStatus === 'ONLINE' ? `${Number(latestReading.water_level).toFixed(2)} m` : 'No current river data'}</div>
          <StatusBadge status={currentRisk} />
          <p className="muted">Latest sensor reading: {latestReading ? new Date(latestReading.recorded_at).toLocaleString() : 'No data available'}</p>
          <p className="muted">{sensor?.name || latestReading?.station_id || 'Station unavailable'} · {sensorStatus} · Rate: {rate.value}</p>
        </div>
        <div className="summary-card">
          <h3>SAFE responses</h3>
          <div>{safeResponses.length}</div>
        </div>
        <div className="summary-card">
          <h3>SOS responses</h3>
          <div>{sosResponses.length}</div>
        </div>
        <div className="summary-card">
          <h3>Pending SOS</h3>
          <div>{pendingSos.length}</div>
        </div>
        <div className="summary-card"><h3>Resolved SOS</h3><div>{resolvedSos.length}</div></div>
        <div className="summary-card"><h3>Active alerts</h3><div>{alerts.filter((alert) => alert.is_active).length}</div></div>
      </div>

      <div className="dashboard-grid dashboard-grid--bottom">
        <div className="panel">
          <div className="section-header"><h3>Pending and recent SOS</h3><Link to="/sos-requests" className="filter-button">Manage responses</Link></div>
          {latestSos.length ? (
            <div className="stacked-list">{latestSos.map((response) => (
              <article className="list-item response-item" key={response.response_id}>
                <div><strong>{response.resident_name}</strong><span>{new Date(response.created_at).toLocaleString()}</span><span>{response.location || 'Location not provided'}</span></div>
                <div className="response-item__actions"><StatusBadge status={response.status} />{response.latitude !== null && response.longitude !== null ? <a className="filter-button" href={`https://www.openstreetmap.org/?mlat=${response.latitude}&mlon=${response.longitude}#map=16/${response.latitude}/${response.longitude}`} target="_blank" rel="noreferrer">Open map</a> : null}</div>
              </article>
            ))}</div>
          ) : (
            <div className="empty-state">No SOS responses have been submitted.</div>
          )}
        </div>
        <div className="panel">
          <h3>Recent SAFE responses</h3>
          {latestSafe.length ? (
            <div className="stacked-list">{latestSafe.map((response) => (
              <article className="list-item response-item" key={response.response_id}>
                <div><strong>{response.resident_name}</strong><span>{new Date(response.created_at).toLocaleString()}</span><span>{response.location || 'Location not provided'}</span></div>
                <StatusBadge status="SAFE" />
              </article>
            ))}</div>
          ) : (
            <div className="empty-state">No SAFE responses have been submitted.</div>
          )}
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--bottom">
        <section className="panel"><h3>Active alerts</h3>{alerts.filter((alert) => alert.is_active).map((alert) => <article key={alert.id} className="list-item"><div><strong>{alert.title}</strong><p>{alert.message}</p></div><StatusBadge status={alert.severity} /></article>)}{!alerts.some((alert) => alert.is_active) ? <div className="empty-state">No active alerts.</div> : null}</section>
        <section className="panel"><h3>Published announcements</h3>{announcements.map((announcement) => <article key={announcement.id} className="list-item"><div><strong>{announcement.title}</strong><p>{announcement.message}</p></div></article>)}{!announcements.length ? <div className="empty-state">No announcements published.</div> : null}<p className="muted">Evacuation centers configured: {evacuationCenters.length}</p></section>
      </div>
    </section>
  );
}
