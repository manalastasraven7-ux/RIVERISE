import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../services/DataContext';
import { supabase } from '../services/supabaseClient';

const categories = ['Weather Advisory', 'Flood Warning', 'Evacuation Notice', 'General Announcement'];

export default function ManageAnnouncementsPage() {
  const { user } = useAuth();
  const { announcements, refresh, demoMode } = useData();
  const [form, setForm] = useState({ title: '', message: '', category: categories[0], issuing_office: '', affected_location: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const publish = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error: saveError } = await supabase.from('announcements').insert({ ...form, created_by: user.id, is_active: true });
    if (saveError) setError(saveError.message || 'Announcement could not be published. Confirm the community metadata migration has been applied.');
    else {
      setForm({ title: '', message: '', category: categories[0], issuing_office: '', affected_location: '' });
      setSuccess('Announcement published to the community page.');
      await refresh();
    }
    setSaving(false);
  };

  const deactivate = async (announcement) => {
    if (!window.confirm(`Unpublish “${announcement.title}”?`)) return;
    const { error: saveError } = await supabase.from('announcements').update({ is_active: false }).eq('id', announcement.id);
    if (saveError) setError(saveError.message || 'Announcement could not be unpublished.');
    else await refresh();
  };

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div><p className="eyebrow">Responder tools</p><h2>Manage community announcements</h2></div>
      </div>
      {demoMode ? <div className="demo-banner">EXAMPLE ANNOUNCEMENTS ARE READ-ONLY</div> : null}
      {error ? <div className="error-box" role="alert">{error}</div> : null}
      {success ? <div className="success-box" role="status">{success}</div> : null}
      <form className="panel management-form" onSubmit={publish}>
        <h3>Publish official update</h3>
        <label>Title<input required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Issuing office<input required maxLength={120} value={form.issuing_office} onChange={(event) => setForm({ ...form, issuing_office: event.target.value })} /></label>
        <label>Affected barangay or community<input maxLength={160} value={form.affected_location} onChange={(event) => setForm({ ...form, affected_location: event.target.value })} /></label>
        <label>Message<textarea required rows="5" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
        <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Publishing...' : 'Publish announcement'}</button>
      </form>
      <section className="panel"><h3>Published and example announcements</h3>
        {announcements.length ? <div className="stacked-list">{announcements.map((announcement) => {
          const isDemo = String(announcement.id).startsWith('demo-');
          return <article className="alert-history-item" key={announcement.id}>
            <div className="alert-history-item__header"><div><h4>{announcement.title}</h4><p className="muted">{new Date(announcement.created_at).toLocaleString()}</p></div><span className="tag normal">{announcement.category || 'General Announcement'}</span></div>
            <p>{announcement.message}</p>
            <p className="muted">Issued by: {announcement.issuing_office || 'Office not specified'} · {announcement.affected_location || 'All communities'}</p>
            {isDemo ? <span className="muted">Example only</span> : announcement.is_active ? <button className="filter-button" type="button" onClick={() => deactivate(announcement)}>Unpublish</button> : <span className="muted">Unpublished</span>}
          </article>;
        })}</div> : <div className="empty-state">No announcements published.</div>}
      </section>
    </section>
  );
}
