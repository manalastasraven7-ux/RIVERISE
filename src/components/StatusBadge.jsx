export default function StatusBadge({ status, className = '' }) {
  const normalized = String(status || '').toLowerCase();
  return <span className={`tag ${normalized} ${className}`.trim()}>{status || 'UNKNOWN'}</span>;
}
