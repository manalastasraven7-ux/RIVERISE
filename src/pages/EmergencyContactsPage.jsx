import { useMemo } from 'react';
import { useData } from '../services/DataContext';

const contactGroups = [
  { id: 'Local', title: 'Local', description: 'Barangay DRRM, local rescue, and barangay contacts' },
  { id: 'Municipal', title: 'Municipal', description: 'Sogod municipal disaster response, police, fire, and medical services' },
  { id: 'National', title: 'National', description: 'National emergency and disaster response contacts' },
];

export default function EmergencyContactsPage() {
  const { emergencyContacts, loading, error } = useData();
  const groupedContacts = useMemo(() => {
    const contacts = emergencyContacts.some((contact) => String(contact.category || '').toLowerCase() === 'national')
      ? emergencyContacts
      : [...emergencyContacts, {
          id: 'national-911-unverified',
          name: 'Emergency hotline',
          organization: 'National',
          category: 'National',
          phone: '911',
          is_verified: false,
          notes: 'The number is listed for awareness only; local availability has not been verified.',
        }];
    return contactGroups.map((group) => ({
      ...group,
      contacts: contacts.filter((contact) => String(contact.category || '').toLowerCase() === group.id.toLowerCase()),
    }));
  }, [emergencyContacts]);

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div><p className="eyebrow">Flood, typhoon, rescue, and medical help</p><h2>Emergency Contacts</h2></div>
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading verified contact information...</div> : null}
      <div className="contact-groups">{groupedContacts.map((group) => (
        <section className="panel" key={group.id}>
          <h3>{group.title}</h3>
          <p className="muted">{group.description}</p>
          {group.contacts.length ? <div className="stacked-list">{group.contacts.map((contact) => (
            <article className="list-item contact-item" key={contact.id}>
              <div><strong>{contact.name}</strong><span>{contact.organization || 'Organization not specified'}</span><span>{contact.notes || 'No additional details'}</span></div>
              <div className="contact-item__phone">
                {contact.is_verified && contact.phone ? <a className="filter-button is-active" href={`tel:${contact.phone}`}>{contact.phone}</a> : <span className="muted">Contact information not yet verified</span>}
                {contact.is_verified && contact.verified_at ? <small>Verified {new Date(contact.verified_at).toLocaleDateString()}</small> : null}
              </div>
            </article>
          ))}</div> : <div className="empty-state">No verified {group.title.toLowerCase()} contacts are configured.</div>}
        </section>
      ))}</div>
      <p className="muted">Contact numbers are displayed as callable links only after an authorized administrator verifies them. Confirm local coverage before relying on any listed service.</p>
    </section>
  );
}
