import { appConfig, getRiskLevel } from './appConfig';

export function getCurrentRateOfRise(readings, stationId, readingIsStale = false) {
  if (readingIsStale) {
    return { value: 'Not available', direction: 'unknown', rateMPerMinute: null };
  }

  if (!Array.isArray(readings) || !stationId) {
    return { value: 'Not enough data', direction: 'unknown', rateMPerMinute: null };
  }

  const validReadings = [...readings]
    .filter((reading) => {
      if (!reading || reading.station_id !== stationId) return false;
      if (reading.water_level === null || reading.water_level === undefined || reading.water_level === '') return false;

      const waterLevel = Number(reading.water_level);
      const timestamp = new Date(reading.recorded_at).getTime();
      return Number.isFinite(waterLevel) && Number.isFinite(timestamp);
    })
    .sort((a, b) => {
      const timeDifference = new Date(a.recorded_at) - new Date(b.recorded_at);
      if (timeDifference !== 0) return timeDifference;

      const aId = String(a.id ?? '');
      const bId = String(b.id ?? '');
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });

  if (validReadings.length < 2) {
    return { value: 'Not enough data', direction: 'unknown', rateMPerMinute: null };
  }

  const current = validReadings[validReadings.length - 1];
  const currentTime = new Date(current.recorded_at).getTime();
  let previous = null;

  for (let index = validReadings.length - 2; index >= 0; index -= 1) {
    const candidate = validReadings[index];
    if (new Date(candidate.recorded_at).getTime() < currentTime) {
      previous = candidate;
      break;
    }
  }

  if (!previous) {
    return { value: 'Not enough data', direction: 'unknown', rateMPerMinute: null };
  }

  const previousTime = new Date(previous.recorded_at).getTime();
  const elapsedMinutes = (currentTime - previousTime) / 60000;

  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime) || elapsedMinutes <= 0) {
    return { value: 'Not enough data', direction: 'unknown', rateMPerMinute: null };
  }

  const delta = Number(current.water_level) - Number(previous.water_level);
  const rate = delta / elapsedMinutes;

  if (!Number.isFinite(rate)) {
    return { value: 'Not enough data', direction: 'unknown', rateMPerMinute: null };
  }

  const direction = Math.abs(delta) < 0.02 ? 'stable' : rate > 0 ? 'rising' : 'falling';
  const prefix = rate >= 0 ? '+' : '-';

  return {
    value: `${prefix}${Math.abs(rate).toFixed(3)} m/min`,
    direction,
    rateMPerMinute: rate,
  };
}

export function getEstimatedTimeToThreshold(waterLevel, rateMPerMinute) {
  if (waterLevel === null || waterLevel === undefined || waterLevel === '') {
    return 'Estimate unavailable';
  }

  const level = Number(waterLevel);
  if (!Number.isFinite(level) || !Number.isFinite(rateMPerMinute) || rateMPerMinute <= 0) {
    return 'Estimate unavailable';
  }

  const nextThreshold = Object.entries(appConfig.statusThresholds)
    .filter(([status, threshold]) => status !== 'NORMAL' && Number.isFinite(threshold.min) && threshold.min > level)
    .sort(([, a], [, b]) => a.min - b.min)[0];

  if (!nextThreshold) return 'Estimate unavailable';

  const [status, threshold] = nextThreshold;
  const totalMinutes = Math.ceil((threshold.min - level) / rateMPerMinute);
  if (!Number.isFinite(totalMinutes)) return 'Estimate unavailable';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const duration = [
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    minutes ? `${minutes}m` : null,
  ].filter(Boolean).join(' ') || '1m';

  return `Estimated time to ${status}: ${duration}`;
}

export function getWaterLevelPredictions(waterLevel, rateMPerMinute, currentRisk) {
  const level = Number(waterLevel);
  if (!Number.isFinite(level) || !Number.isFinite(rateMPerMinute)) return null;

  const riskOrder = ['NORMAL', 'WATCH', 'WARNING', 'CRITICAL'];
  const trend = Math.abs(rateMPerMinute) < 0.0005
    ? 'stable'
    : rateMPerMinute > 0 ? 'rising' : 'falling';

  const estimates = [1, 2, 3].map((hours) => {
    const projectedLevel = Math.max(0, level + rateMPerMinute * 60 * hours);
    const projectedRisk = getRiskLevel(projectedLevel);
    return {
      hours,
      waterLevel: projectedLevel,
      risk: projectedRisk,
      crossesThreshold: riskOrder.indexOf(projectedRisk) > riskOrder.indexOf(currentRisk),
    };
  });

  return { trend, estimates };
}