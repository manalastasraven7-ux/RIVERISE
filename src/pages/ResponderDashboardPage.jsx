import { useData } from '../services/DataContext';
import StatusBadge from '../components/StatusBadge';

export default function ResponderDashboardPage() {
  const { latestReading, alerts, sosRequests, evacuationCenters, announcements } = useData();

  return (
    <section>
      <div className="section-header">
        <h2>Responder Dashboard</h2>
      </div>
      <div className="grid">
        <div className="summary-card">
          <h3>Current river condition</h3>
          <div>{latestReading ? latestReading.flow_condition || 'Unknown' : 'No current river data'}</div>
          <p className="muted">Latest sensor reading: {latestReading ? new Date(latestReading.recorded_at).toLocaleString() : 'No data available'}</p>
        </div>
        <div className="summary-card">
          <h3>Active alerts</h3>
          <div>{alerts.length}</div>
        </div>
        <div className="summary-card">
          <h3>SOS requests</h3>
          <div>{sosRequests.length}</div>
        </div>
        <div className="summary-card">
          <h3>Evacuation centers</h3>
          <div>{evacuationCenters.length}</div>
        </div>
      </div>

      <div className="grid" style={{ marginTop: '1rem' }}>
        <div className="panel">
          <h3>Active alerts</h3>
          {alerts.length ? (
            <ul className="list">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <strong>{alert.title}</strong>
                  <div><StatusBadge status={alert.severity} /></div>
                  <div>{alert.message}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No active alerts.</div>
          )}
        </div>
        <div className="panel">
          <h3>Announcements</h3>
          {announcements.length ? (
            <ul className="list">
              {announcements.map((announcement) => (
                <li key={announcement.id}><strong>{announcement.title}</strong><div>{announcement.message}</div></li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No announcements published.</div>
          )}
        </div>
      </div>
    </section>
  );
}
