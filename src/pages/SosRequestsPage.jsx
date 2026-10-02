import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import useResponderResponses from '../services/useResponderResponses';
import { supabase } from '../services/supabaseClient';
import StatusBadge from '../components/StatusBadge';

export default function SosRequestsPage() {
  const { user } = useAuth();
  const { responses, loading, error } = useResponderResponses();
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const requests = responses.filter((response) => response.response_type === 'SOS').sort((first, second) => {
    const priority = (status) => status === 'PENDING' ? 0 : status === 'ACKNOWLEDGED' || status === 'RESPONDING' ? 1 : 2;
    return priority(first.status) - priority(second.status) || new Date(second.created_at) - new Date(first.created_at);
  });

  const updateStatus = async (request, status) => {
    setBusyId(request.response_id);
    setActionError(null);
    const changes = {
      status,
      updated_at: new Date().toISOString(),
      handled_by: user.id,
      ...(status === 'RESOLVED' ? { resolved_at: new Date().toISOString(), resolved_by: user.id } : {}),
    };
    const { error: updateError } = await supabase.from('sos_requests').update(changes).eq('id', request.response_id);
    if (updateError) setActionError(updateError.message || 'Response status could not be updated.');
    setBusyId(null);
  };

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div><p className="eyebrow">Responder tools</p><h2>SOS Requests</h2></div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {actionError ? <div className="error-box">{actionError}</div> : null}
      {loading ? <div className="empty-state">Loading responses...</div> : null}
      {requests.length ? (
        <div className="response-list">
          {requests.map((request) => (
            <article key={request.response_id} className={`panel response-card ${request.status === 'PENDING' ? 'response-card--pending' : ''}`}>
              <div className="response-card__heading">
                <div><p className="eyebrow">{request.status === 'PENDING' ? 'Needs attention' : 'Resident SOS'}</p><h3>{request.resident_name || 'Resident'}</h3></div>
                <StatusBadge status={request.status} />
              </div>
              <p>Submitted: {new Date(request.created_at).toLocaleString()}</p>
              <p>Location: {request.location || 'Not provided'}</p>
              {request.latitude !== null && request.longitude !== null ? <a className="filter-button" href={`https://www.openstreetmap.org/?mlat=${request.latitude}&mlon=${request.longitude}#map=16/${request.latitude}/${request.longitude}`} target="_blank" rel="noreferrer">Open response location</a> : null}
              {request.status !== 'RESOLVED' ? (
                <div className="filter-group">
                  {request.status === 'PENDING' ? <button className="filter-button" type="button" disabled={busyId === request.response_id} onClick={() => updateStatus(request, 'ACKNOWLEDGED')}>Acknowledge</button> : null}
                  {request.status !== 'RESPONDING' ? <button className="filter-button" type="button" disabled={busyId === request.response_id} onClick={() => updateStatus(request, 'RESPONDING')}>In progress</button> : null}
                  <button className="filter-button" type="button" disabled={busyId === request.response_id} onClick={() => updateStatus(request, 'RESOLVED')}>Resolve</button>
                </div>
              ) : <p className="muted">Resolved {request.updated_at ? new Date(request.updated_at).toLocaleString() : ''}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">No SOS requests have been submitted.</div>
      )}
      <Link className="filter-button" to="/community-safety-map">Open response map</Link>
    </section>
  );
}
