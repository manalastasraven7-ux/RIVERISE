import { useData } from '../services/DataContext';
import StatusBadge from '../components/StatusBadge';

export default function AlertsPage() {
  const { alerts, loading, error } = useData();

  return (
    <section>
      <div className="section-header">
        <h2>Alerts</h2>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading alerts…</div> : null}
      {alerts.length ? (
        <div className="grid">
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-card">
              <div className="section-header">
                <h3>{alert.title}</h3>
                <StatusBadge status={alert.severity} />
              </div>
              <p>{alert.message}</p>
              <div className="muted">Created: {new Date(alert.created_at).toLocaleString()}</div>
              <div className="muted">Expires: {alert.expires_at ? new Date(alert.expires_at).toLocaleString() : 'Not specified'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No active alerts.</div>
      )}
    </section>
  );
}
