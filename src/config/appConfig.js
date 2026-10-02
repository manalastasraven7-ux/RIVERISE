export const appConfig = {
  staleMinutes: Number(import.meta.env.VITE_RIVER_STALE_MINUTES || 15),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  sosAlertRadiusMeters: Number(import.meta.env.VITE_SOS_ALERT_RADIUS_METERS || 10000),
  sosExpiryMinutes: Number(import.meta.env.VITE_SOS_EXPIRY_MINUTES || 120),
  statusThresholds: {
    NORMAL: { min: 0, max: 1.5 },
    WATCH: { min: 1.5, max: 2.5 },
    WARNING: { min: 2.5, max: 4 },
    CRITICAL: { min: 4, max: Infinity },
  },
};

export function getSensorStatus(latestReading, staleMinutes = appConfig.staleMinutes) {
  if (!latestReading || !latestReading.recorded_at) {
    return 'UNKNOWN';
  }

  const ageMinutes = (Date.now() - new Date(latestReading.recorded_at).getTime()) / 60000;

  if (ageMinutes > staleMinutes) {
    return 'STALE';
  }

  return latestReading.sensor_status || 'ONLINE';
}

export function getRiskLevel(waterLevel) {
  if (waterLevel === null || waterLevel === undefined || waterLevel === '') {
    return 'UNAVAILABLE';
  }

  const numericValue = Number(waterLevel);
  if (Number.isNaN(numericValue)) {
    return 'UNAVAILABLE';
  }

  if (numericValue < appConfig.statusThresholds.NORMAL.max) {
    return 'NORMAL';
  }

  if (numericValue < appConfig.statusThresholds.WARNING.min) {
    return 'WATCH';
  }

  if (numericValue < appConfig.statusThresholds.CRITICAL.min) {
    return 'WARNING';
  }

  return 'CRITICAL';
}

export function getRateOfChange(readings, windowMinutes = 30) {
  if (!Array.isArray(readings) || readings.length < 2) {
    return {
      value: null,
      direction: 'Insufficient data',
      periodLabel: `Change over the last ${windowMinutes} minutes`,
      status: 'unknown',
    };
  }

  const sortedReadings = [...readings].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const latest = sortedReadings[sortedReadings.length - 1];
  const latestTime = new Date(latest.recorded_at).getTime();
  const windowMs = windowMinutes * 60 * 1000;

  let previous = null;
  for (let index = sortedReadings.length - 2; index >= 0; index -= 1) {
    const candidate = sortedReadings[index];
    const candidateTime = new Date(candidate.recorded_at).getTime();
    if (latestTime - candidateTime <= windowMs) {
      previous = candidate;
      break;
    }
  }

  if (!previous || previous.water_level === null || previous.water_level === undefined || latest.water_level === null || latest.water_level === undefined) {
    return {
      value: null,
      direction: 'Insufficient data',
      periodLabel: `Change over the last ${windowMinutes} minutes`,
      status: 'unknown',
    };
  }

  const delta = Number(latest.water_level) - Number(previous.water_level);
  const magnitude = Math.abs(delta);

  if (Math.abs(delta) < 0.02) {
    return {
      value: '0.00 m',
      direction: 'Stable',
      periodLabel: `Change over the last ${windowMinutes} minutes`,
      status: 'stable',
    };
  }

  return {
    value: `${delta >= 0 ? '+' : '-'}${magnitude.toFixed(2)} m`,
    direction: delta > 0 ? 'Rising' : 'Falling',
    periodLabel: `Change over the last ${windowMinutes} minutes`,
    status: delta > 0 ? 'rising' : 'falling',
  };
}

export function getRiverCondition(readings) {
  const rateInfo = getRateOfChange(readings, 30);

  if (rateInfo.direction === 'Insufficient data') {
    return { label: 'Unknown', tone: 'unknown', text: 'Unknown' };
  }

  if (rateInfo.direction === 'Rising') {
    return { label: 'Rising', tone: 'rising', text: '↑ RISING' };
  }

  if (rateInfo.direction === 'Falling') {
    return { label: 'Falling', tone: 'falling', text: '↓ FALLING' };
  }

  return { label: 'Stable', tone: 'stable', text: '→ STABLE' };
}

export function getDataFreshness(reading) {
  if (!reading || !reading.recorded_at) {
    return 'No recent reading';
  }

  const secondsAgo = Math.max(0, Math.round((Date.now() - new Date(reading.recorded_at).getTime()) / 1000));
  if (secondsAgo < 60) return `Updated ${secondsAgo} seconds ago`;

  const minutesAgo = Math.round(secondsAgo / 60);
  if (minutesAgo < 60) return `Updated ${minutesAgo} minutes ago`;

  const hoursAgo = Math.round(minutesAgo / 60);
  return `Updated ${hoursAgo} hours ago`;
}

export function getWarningBannerText(riskLevel) {
  if (riskLevel === 'WATCH') return 'Water level is entering the watch threshold. Monitor river conditions closely.';
  if (riskLevel === 'WARNING') return 'Water level is above the configured warning threshold.';
  if (riskLevel === 'CRITICAL') return 'Critical water level detected. Escalate response actions.';
  return null;
}
