export function isAlertExpired(alert, now = Date.now()) {
  if (!alert?.expires_at) return false;

  const expiresAt = new Date(alert.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt < now;
}

export function getAlertStatus(alert, now = Date.now()) {
  if (isAlertExpired(alert, now)) return 'EXPIRED';
  return String(alert?.status || (alert?.is_active ? 'ACTIVE' : 'RESOLVED')).toUpperCase();
}