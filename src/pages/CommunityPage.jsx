import { useData } from '../services/DataContext';

export default function CommunityPage() {
  const { announcements, evacuationCenters, demoMode } = useData();

  return (
    <>
      <section>
        <div className="section-header">
          <div><p className="eyebrow">Local updates and resources</p><h2>Community</h2></div>
        </div>
        {demoMode ? <div className="demo-banner">DEMO EXAMPLES · Verify official advisories locally</div> : null}
        <div className="grid">
          <div className="panel">
            <h3>Announcements</h3>
            {announcements.length ? (
              <ul className="list">
                {announcements.map((announcement) => (
                  <li key={announcement.id}>
                    <strong>{announcement.title}</strong>
                    <div className="tag normal">{announcement.category || 'General Announcement'}</div>
                    <div>{announcement.message}</div>
                    <div className="muted">Issued by: {announcement.issuing_office || 'Office not specified'} · {announcement.affected_location || 'All communities'}</div>
                    <div className="muted">{new Date(announcement.created_at).toLocaleString()}</div>
                    {String(announcement.id).startsWith('demo-') ? <div className="muted">Example only</div> : null}
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
                    <div>{[center.address, center.barangay].filter(Boolean).join(', ') || 'Address not configured'}</div>
                    <div className="muted">Capacity: {center.capacity || 'Not specified'}</div>
                    <div className="muted">Operational status: {center.status_verified ? center.status : 'Not confirmed'}</div>
                    <div className="muted">Contact: {center.contact_information || 'Not available'}</div>
                    {Number.isFinite(Number(center.latitude)) && Number.isFinite(Number(center.longitude)) ? <a href={`https://www.openstreetmap.org/?mlat=${center.latitude}&mlon=${center.longitude}#map=16/${center.latitude}/${center.longitude}`} target="_blank" rel="noreferrer">Open map</a> : null}
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
