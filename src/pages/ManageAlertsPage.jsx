import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../services/DataContext';
import { supabase } from '../services/supabaseClient';
import StatusBadge from '../components/StatusBadge';

const initialForm = { title: '', severity: 'WATCH', location: '', message: '' };

function getAlertStatus(alert) {
  return String(alert.status || (alert.is_active ? 'ACTIVE' : 'RESOLVED')).toUpperCase();
}

export default function ManageAlertsPage() {
  const { user } = useAuth();
  const { alerts, refresh, demoMode } = useData();
  const [form, setForm] = useState(initialForm);
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const createAlert = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const { error: insertError } = await supabase.from('alerts').insert({
      ...form,
      status: 'ACTIVE',
      is_active: true,
      created_by: user.id,
    });
    if (insertError) {
      setError(insertError.message || 'Alert could not be created. Confirm the alert lifecycle migration has been applied.');
    } else {
      setForm(initialForm);
      setMessage('Official alert published.');
      await refresh();
    }
    setSaving(false);
  };

  const updateStatus = async (alert, nextStatus) => {
    if (nextStatus === 'RESOLVED' && !window.confirm('Resolve this alert? Residents will see it as resolved in alert history.')) return;
    setBusyId(alert.id);
    setError(null);
    setMessage(null);
    const isActive = nextStatus !== 'RESOLVED';
    const now = new Date().toISOString();
    const changes = {
      status: nextStatus,
      is_active: isActive,
      ...(nextStatus === 'ACKNOWLEDGED' ? { acknowledged_at: now, acknowledged_by: user.id } : {}),
      ...(nextStatus === 'RESOLVED' ? { resolved_at: now, resolved_by: user.id } : {}),
    };
    const { error: updateError } = await supabase.from('alerts').update(changes).eq('id', alert.id);
    if (updateError) setError(updateError.message || 'Alert status could not be updated.');
    else {
      setMessage('Alert status updated.');
      await refresh();
    }
    setBusyId(null);
  };

  const deleteAlert = async (alert) => {
    if (!window.confirm(`Delete “${alert.title}”? This cannot be undone.`)) return;
    setBusyId(alert.id);
    setError(null);
    setMessage(null);
    const { error: deleteError } = await supabase.from('alerts').delete().eq('id', alert.id);
    if (deleteError) setError(deleteError.message || 'Alert could not be deleted.');
    else {
      setMessage('Alert deleted.');
      await refresh();
    }
    setBusyId(null);
  };

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div>
          <p className="eyebrow">Responder tools</p>
          <h2>Manage official alerts</h2>
        </div>
      </div>
      {demoMode ? <div className="demo-banner">DEMO EXAMPLES ARE READ-ONLY · New alerts are published to Supabase</div> : null}
      {error ? <div className="error-box" role="alert">{error}</div> : null}
      {message ? <div className="success-box" role="status">{message}</div> : null}

      <form className="panel management-form" onSubmit={createAlert}>
        <h3>Publish an alert</h3>
        <label>Title<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Severity<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>{['INFORMATION', 'WATCH', 'WARNING', 'CRITICAL'].map((severity) => <option key={severity}>{severity}</option>)}</select></label>
        <label>Affected location<input maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Verified barangay or station" /></label>
        <label>Message<textarea required rows="4" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Publishing...' : 'Publish official alert'}</button>
      </form>

      <section className="panel">
        <h3>Review and update alerts</h3>
        {alerts.length ? <div className="alert-history-list">
          {alerts.map((alert) => {
            const status = getAlertStatus(alert);
            const isDemo = String(alert.id).startsWith('demo-');
            return (
              <article key={alert.id} className="alert-history-item">
                <div className="alert-history-item__header">
                  <div><h4>{alert.title}</h4><p className="muted">{new Date(alert.created_at).toLocaleString()} · {alert.location || 'Location not set'}</p></div>
                  <div className="filter-group"><StatusBadge status={alert.severity} /><StatusBadge status={status} /></div>
                </div>
                <p>{alert.message}</p>
                {isDemo ? <span className="muted">Example only. This record is not stored in Supabase.</span> : (
                  <div className="filter-group">
                    {status === 'ACTIVE' ? <button className="filter-button" type="button" disabled={busyId === alert.id} onClick={() => updateStatus(alert, 'ACKNOWLEDGED')}>Acknowledge</button> : null}
                    {status !== 'RESOLVED' ? <button className="filter-button" type="button" disabled={busyId === alert.id} onClick={() => updateStatus(alert, 'RESOLVED')}>Resolve</button> : null}
                    <button className="filter-button" type="button" disabled={busyId === alert.id} onClick={() => deleteAlert(alert)}>Delete</button>
                  </div>
                )}
              </article>
            );
          })}
        </div> : <div className="empty-state">No alerts are recorded.</div>}
      </section>
    </section>
  );
}
