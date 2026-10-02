import { useMemo, useState } from 'react';
import { useData } from '../services/DataContext';
import { appConfig, getRiskLevel, getSensorStatus } from '../config/appConfig';
import StatusBadge from '../components/StatusBadge';
import RiverChart from '../components/RiverChart';
import CommunitySosAlert from '../components/CommunitySosAlert';
import RiverWaterTank from '../components/RiverWaterTank';

function formatWaterLevel(value) {
  if (value === null || value === undefined || value === '') {
    return 'Sensor data unavailable';
  }

  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} m` : 'Sensor data unavailable';
}

function formatTimestamp(value, fallback = 'No data available') {
  if (!value) return fallback;
  return new Date(value).toLocaleString();
}

function formatStatusLabel(value, fallback = 'UNKNOWN') {
  if (!value) return fallback;
  return String(value).toUpperCase();
}

export function isRiverReadingStaleOrUnavailable(reading, sensorStatus, now = Date.now()) {
  const level = reading?.water_level;
  const levelNumber = Number(level);
  const recordedAt = new Date(reading?.recorded_at).getTime();

  if (
    level === null
    || level === undefined
    || level === ''
    || !Number.isFinite(levelNumber)
    || !Number.isFinite(recordedAt)
    || sensorStatus !== 'ONLINE'
  ) {
    return true;
  }

  return (now - recordedAt) / 60000 > appConfig.staleMinutes;
}

export function getCurrentRateOfRise(readings, stationId) {
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

  const direction = rate > 0 ? 'rising' : rate < 0 ? 'falling' : 'stable';
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

const timeWindowOptions = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
];

export default function HomePage() {
  const { latestReading, readings, sensors, alerts, loading, error } = useData();
  const [selectedWindow, setSelectedWindow] = useState('24h');

  const sensorStatus = latestReading ? getSensorStatus(latestReading) : 'UNKNOWN';
  const riskStatus = latestReading && latestReading.water_level !== null && latestReading.water_level !== undefined
    ? getRiskLevel(latestReading.water_level)
    : 'UNAVAILABLE';
  const latestLevelNumber = Number(latestReading?.water_level);
  const readingIsStale = isRiverReadingStaleOrUnavailable(latestReading, sensorStatus);
  const rateOfRise = useMemo(
    () => getCurrentRateOfRise(readings, latestReading?.station_id || null),
    [readings, latestReading?.station_id],
  );
  const estimatedTimeToThreshold = getEstimatedTimeToThreshold(
    latestReading?.water_level,
    rateOfRise.rateMPerMinute,
  );

  const matchedSensor = latestReading && latestReading.station_id
    ? sensors.find((sensor) => sensor.station_id === latestReading.station_id)
    : null;

  const monitoringStation = matchedSensor || {
    station_id: latestReading?.station_id || 'N/A',
    name: 'Monitoring station',
    status: latestReading?.sensor_status || 'UNKNOWN',
    latitude: null,
    longitude: null,
  };

  const overviewCards = useMemo(() => {
    const uniqueStations = [...new Set((sensors || []).map((sensor) => sensor.station_id).filter(Boolean))];
    const activeSensors = (sensors || []).filter((sensor) => String(sensor.status || '').toUpperCase() === 'ONLINE').length;
    const readingsToday = (readings || []).filter((reading) => {
      const date = new Date(reading.recorded_at);
      const now = new Date();
      return date.toDateString() === now.toDateString();
    }).length;

    return [
      { label: 'Monitoring Stations', value: String(uniqueStations.length || 0) },
      { label: 'Active Sensors', value: String(activeSensors || 0) },
      { label: 'Readings Today', value: String(readingsToday || 0) },
      { label: 'Active Alerts', value: String(alerts.length || 0) },
    ];
  }, [sensors, readings, alerts]);

  const filteredReadings = useMemo(() => {
    if (!readings.length) return [];

    const now = Date.now();
    const cutoff = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[selectedWindow] ?? 24 * 60 * 60 * 1000;

    return readings.filter((reading) => {
      const valueTime = new Date(reading.recorded_at).getTime();
      return Number.isFinite(valueTime) && now - valueTime <= cutoff;
    });
  }, [readings, selectedWindow]);

  const chartData = filteredReadings.map((reading) => ({
    label: new Date(reading.recorded_at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    water_level: Number(reading.water_level ?? 0),
  }));

  const gaugePercentage = (() => {
    if (!latestReading || latestReading.water_level === null || latestReading.water_level === undefined || latestReading.water_level === '') {
      return 0;
    }

    const value = Number(latestReading.water_level);
    if (!Number.isFinite(value)) return 0;
    const maxThreshold = 4;
    return Math.min(100, (value / maxThreshold) * 100);
  })();

  return (
    <div className="dashboard-shell">
      <section className="hero-card dashboard-hero">
        <div className="dashboard-hero__header">
          <div>
            <p className="eyebrow">Monitoring overview</p>
            <h1>Current water level</h1>
          </div>
          <StatusBadge status={sensorStatus} />
        </div>

        <div className="dashboard-hero__content">
          <div>
            <div className="water-level-value">
              {latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}
            </div>
            <div className="water-level-meta">
              <span>{latestReading?.station_id || 'Monitoring station unavailable'}</span>
              <span>•</span>
              <span>{latestReading ? `Last updated: ${formatTimestamp(latestReading.recorded_at)}` : 'Last updated: No data available'}</span>
            </div>
          </div>

          <div className="hero-status-panel">
            <div className="mini-label">Flood risk</div>
            <div className={`risk-status risk-status--${riskStatus.toLowerCase()}`}>
              {riskStatus === 'UNAVAILABLE' ? 'Status unavailable' : formatStatusLabel(riskStatus)}
            </div>
            <div className="mini-detail">Thresholds configured via app settings</div>
            <div className={`rate-of-rise rate-of-rise--${rateOfRise.direction}`}>
              {rateOfRise.value}
            </div>
            <div className="mini-detail">Rate of rise</div>
            <div className="mini-detail">{estimatedTimeToThreshold}</div>
          </div>
        </div>

        <div className="gauge-block">
          <div className="gauge-readout">
            <div className="gauge-header">
              <span>Water level gauge</span>
              <strong>{latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
            </div>
            <div className="gauge-track">
              <div className={`gauge-fill gauge-fill--${riskStatus.toLowerCase()}`} style={{ width: `${gaugePercentage}%` }} />
            </div>
            <div className="gauge-scale">
              <span>Normal</span>
              <span>Alert</span>
              <span>Warning</span>
              <span>Critical</span>
            </div>
          </div>
          <RiverWaterTank
            level={latestLevelNumber}
            severity={riskStatus}
            isStale={readingIsStale}
          />
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--summary">
        {overviewCards.map((card) => (
          <div key={card.label} className="metric-card">
            <label>{card.label}</label>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading sensor data...</div> : null}

      <CommunitySosAlert />

      <div className="dashboard-grid dashboard-grid--main">
        <section className="panel panel--wide">
          <div className="section-header">
            <div>
              <h2>Water level history</h2>
            </div>
            <div className="filter-group" aria-label="Time filters">
              {timeWindowOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`filter-button ${selectedWindow === option.value ? 'is-active' : ''}`}
                  onClick={() => setSelectedWindow(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length ? <RiverChart data={chartData} /> : <div className="empty-state">Sensor data unavailable</div>}
        </section>

        <aside className="panel panel--stacked">
          <div className="section-header">
            <h2>Sensor status</h2>
          </div>
          <div className="list-item list-item--accent">
            <span>Sensor ID</span>
            <strong>{monitoringStation.station_id || 'N/A'}</strong>
          </div>
          <div className="list-item">
            <span>Connection</span>
            <StatusBadge status={monitoringStation.status || sensorStatus} />
          </div>
          <div className="list-item">
            <span>Latest reading</span>
            <strong>{latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
          </div>
          <div className="list-item">
            <span>Last communication</span>
            <strong>{latestReading ? formatTimestamp(latestReading.recorded_at) : 'No data available'}</strong>
          </div>
          <div className="list-item">
            <span>Monitoring station</span>
            <strong>{monitoringStation.name || 'Monitoring station'}</strong>
          </div>
        </aside>
      </div>

      <div className="dashboard-grid dashboard-grid--bottom">
        <section className="panel">
          <div className="section-header">
            <h2>Alert history</h2>
          </div>
          {alerts.length ? (
            <div className="stacked-list">
              {alerts.map((alert) => (
                <div key={alert.id} className="list-item alert-row">
                  <div>
                    <div className="alert-row__meta">{formatTimestamp(alert.created_at)}</div>
                    <strong>{alert.title}</strong>
                  </div>
                  <div className="alert-row__right">
                    <span>{alert.message}</span>
                    <StatusBadge status={alert.severity} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No alerts recorded</div>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>Monitoring station</h2>
          </div>
          <div className="station-block">
            <div className="list-item">
              <span>Station ID</span>
              <strong>{monitoringStation.station_id || 'N/A'}</strong>
            </div>
            <div className="list-item">
              <span>Station name</span>
              <strong>{monitoringStation.name || 'Monitoring station'}</strong>
            </div>
            <div className="list-item">
              <span>Location</span>
              <strong>{monitoringStation.latitude && monitoringStation.longitude ? `${monitoringStation.latitude}, ${monitoringStation.longitude}` : 'Location unavailable'}</strong>
            </div>
            <div className="list-item">
              <span>Sensor status</span>
              <StatusBadge status={monitoringStation.status || sensorStatus} />
            </div>
            <div className="list-item">
              <span>Current water level</span>
              <strong>{latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
