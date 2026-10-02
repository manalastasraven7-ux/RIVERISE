import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../services/DataContext';
import StatusBadge from '../components/StatusBadge';

function getAlertStatus(alert) {
  return String(alert.status || (alert.is_active ? 'ACTIVE' : 'RESOLVED')).toUpperCase();
}

export default function AlertsPage() {
  const { alerts, loading, error, demoMode } = useData();
  const { isResponder } = useAuth();
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const visibleAlerts = useMemo(() => alerts
    .filter((alert) => severityFilter === 'ALL' || alert.severity === severityFilter)
    .filter((alert) => statusFilter === 'ALL' || getAlertStatus(alert) === statusFilter)
    .sort((first, second) => new Date(second.created_at) - new Date(first.created_at)), [alerts, severityFilter, statusFilter]);

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Community safety updates</p>
          <h2>Alert history</h2>
        </div>
        {isResponder ? <Link className="filter-button" to="/manage-alerts">Manage alerts</Link> : null}
      </div>
      {demoMode ? <div className="demo-banner">DEMO EXAMPLES · These are not active or official alerts</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading alerts…</div> : null}
      <div className="filter-group" aria-label="Alert filters">
        <label>Severity
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            {['ALL', 'INFORMATION', 'WATCH', 'WARNING', 'CRITICAL'].map((severity) => <option key={severity} value={severity}>{severity === 'ALL' ? 'All severities' : severity}</option>)}
          </select>
        </label>
        <label>Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].map((status) => <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : status}</option>)}
          </select>
        </label>
      </div>
      {visibleAlerts.length ? (
        <div className="alert-history-list">
          {visibleAlerts.map((alert) => (
            <article key={alert.id} className="panel alert-history-item">
              <div className="alert-history-item__header">
                <div>
                  <p className="muted">{new Date(alert.created_at).toLocaleString()}</p>
                  <h3>{alert.title}</h3>
                </div>
                <div className="filter-group">
                  <StatusBadge status={alert.severity} />
                  <StatusBadge status={getAlertStatus(alert)} />
                </div>
              </div>
              <p>{alert.message}</p>
              <div className="alert-history-item__details">
                <span>Location: {alert.location || 'Not specified'}</span>
                <span>Expires: {alert.expires_at ? new Date(alert.expires_at).toLocaleString() : 'Not specified'}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">No alerts match these filters.</div>
      )}
    </section>
  );
}
