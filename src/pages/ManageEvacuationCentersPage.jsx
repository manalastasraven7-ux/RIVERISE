import { useState } from 'react';
import { useData } from '../services/DataContext';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../services/supabaseClient';
import StatusBadge from '../components/StatusBadge';

const emptyCenter = { name: '', address: '', barangay: '', latitude: '', longitude: '', capacity: '', contact_information: '', status: 'CLOSED', status_verified: false };

export default function ManageEvacuationCentersPage() {
  const { user } = useAuth();
  const { evacuationCenters, refresh } = useData();
  const [form, setForm] = useState(emptyCenter);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const saveCenter = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const centerData = {
      ...form,
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
      capacity: form.capacity === '' ? null : Number(form.capacity),
      status_verified_at: form.status_verified ? new Date().toISOString() : null,
      status_verified_by: form.status_verified ? user.id : null,
    };
    const query = editingId
      ? supabase.from('evacuation_centers').update(centerData).eq('id', editingId)
      : supabase.from('evacuation_centers').insert(centerData);
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message || 'Center could not be saved. Confirm the community metadata migration has been applied.');
    else {
      setForm(emptyCenter);
      setEditingId(null);
      setSuccess(editingId ? 'Evacuation center updated.' : 'Evacuation center information saved.');
      await refresh();
    }
    setSaving(false);
  };

  const removeCenter = async (center) => {
    if (!window.confirm(`Delete “${center.name}” from the community directory?`)) return;
    const { error: removeError } = await supabase.from('evacuation_centers').delete().eq('id', center.id);
    if (removeError) setError(removeError.message || 'Center could not be deleted.');
    else await refresh();
  };

  const editCenter = (center) => {
    setEditingId(center.id);
    setForm({
      name: center.name || '',
      address: center.address || '',
      barangay: center.barangay || '',
      latitude: center.latitude ?? '',
      longitude: center.longitude ?? '',
      capacity: center.capacity ?? '',
      contact_information: center.contact_information || '',
      status: center.status || 'CLOSED',
      status_verified: Boolean(center.status_verified),
    });
    setError(null);
    setSuccess(null);
  };

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div><p className="eyebrow">Responder tools</p><h2>Manage evacuation centers</h2></div>
      </div>
      {error ? <div className="error-box" role="alert">{error}</div> : null}
      {success ? <div className="success-box" role="status">{success}</div> : null}
      <form className="panel management-form" onSubmit={saveCenter}>
        <h3>{editingId ? 'Update center information' : 'Add verified center information'}</h3>
        <label>Center name<input required maxLength={140} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Address<input maxLength={220} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label>Barangay<input maxLength={120} value={form.barangay} onChange={(event) => setForm({ ...form, barangay: event.target.value })} /></label>
        <div className="form-row"><label>Latitude<input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label></div>
        <div className="form-row"><label>Capacity<input type="number" min="0" step="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></label><label>Contact information<input maxLength={160} value={form.contact_information} onChange={(event) => setForm({ ...form, contact_information: event.target.value })} /></label></div>
        <label>Operational status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{['OPEN', 'FULL', 'CLOSED'].map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="checkbox-label"><input type="checkbox" checked={form.status_verified} onChange={(event) => setForm({ ...form, status_verified: event.target.checked })} /> I verified the current operational status</label>
        <div className="filter-group"><button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Save center'}</button>{editingId ? <button className="filter-button" type="button" onClick={() => { setEditingId(null); setForm(emptyCenter); }}>Cancel edit</button> : null}</div>
      </form>
      <section className="panel"><h3>Configured centers</h3>{evacuationCenters.length ? <div className="stacked-list">{evacuationCenters.map((center) => <article className="list-item" key={center.id}><div><strong>{center.name}</strong><span>{[center.address, center.barangay].filter(Boolean).join(', ') || 'Address not configured'}</span><span>{center.status_verified ? `Verified status: ${center.status}` : 'Operational status not confirmed'}</span></div><div className="response-item__actions"><StatusBadge status={center.status_verified ? center.status : 'UNKNOWN'} /><button type="button" className="filter-button" onClick={() => editCenter(center)}>Edit</button><button type="button" className="filter-button" onClick={() => removeCenter(center)}>Delete</button></div></article>)}</div> : <div className="empty-state">No evacuation centers configured. Do not enter a center unless its details are verified.</div>}</section>
    </section>
  );
}
