import { useData } from '../services/DataContext';

export default function CommunityPage() {
  const { announcements, evacuationCenters } = useData();

  return (
    <>
      <section>
        <div className="section-header">
          <h2>Community</h2>
        </div>
        <div className="grid">
          <div className="panel">
            <h3>Announcements</h3>
            {announcements.length ? (
              <ul className="list">
                {announcements.map((announcement) => (
                  <li key={announcement.id}>
                    <strong>{announcement.title}</strong>
                    <div>{announcement.message}</div>
                    <div className="muted">{new Date(announcement.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No active announcements.</div>
            )}
          </div>
          <div className="panel">
            <h3>Evacuation centers</h3>
            {evacuationCenters.length ? (
              <ul className="list">
                {evacuationCenters.map((center) => (
                  <li key={center.id}>
                    <strong>{center.name}</strong>
                    <div>{center.address}</div>
                    <div className="muted">Capacity: {center.capacity || 'Not specified'}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No evacuation centers configured yet.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
