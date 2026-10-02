import { useData } from '../services/DataContext';

export default function SosRequestsPage() {
  const { sosRequests } = useData();

  return (
    <section>
      <div className="section-header">
        <h2>SOS Requests</h2>
      </div>
      {sosRequests.length ? (
        <div className="grid">
          {sosRequests.map((request) => (
            <div key={request.id} className="panel">
              <div className="section-header">
                <h3>{request.id}</h3>
                <span className="tag warning">{request.status || 'PENDING'}</span>
              </div>
              <p className="muted">Time: {new Date(request.created_at).toLocaleString()}</p>
              <p>Location: {request.location || 'Not provided'}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No SOS requests have been submitted.</div>
      )}
    </section>
  );
}
