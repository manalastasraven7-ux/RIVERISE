import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../services/DataContext';
import { appConfig, getRiskLevel, getSensorStatus } from '../config/appConfig';
import { getAlertStatus, isAlertExpired } from '../config/alertStatus';
import { getCurrentRateOfRise, getEstimatedTimeToThreshold } from '../config/riverMetrics';
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

export { getCurrentRateOfRise, getEstimatedTimeToThreshold };

const timeWindowOptions = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
];

export default function HomePage() {
  const { latestReading, readings, sensors, alerts, loading, error, demoMode, now } = useData();
  const [selectedWindow, setSelectedWindow] = useState('24h');

  const matchedSensor = latestReading && latestReading.station_id
    ? sensors.find((sensor) => sensor.station_id === latestReading.station_id)
    : null;
  const readingWithSensorStatus = latestReading && matchedSensor?.status
    ? { ...latestReading, sensor_status: matchedSensor.status }
    : latestReading;
  const sensorStatus = latestReading ? getSensorStatus(readingWithSensorStatus, appConfig.staleMinutes, now) : 'UNKNOWN';
  const readingIsStale = isRiverReadingStaleOrUnavailable(latestReading, sensorStatus, now);
  const riskStatus = !readingIsStale && latestReading && latestReading.water_level !== null && latestReading.water_level !== undefined
    ? getRiskLevel(latestReading.water_level)
    : 'UNAVAILABLE';
  const latestLevelNumber = Number(latestReading?.water_level);
  const rateOfRise = useMemo(
    () => getCurrentRateOfRise(readings, latestReading?.station_id || null, readingIsStale),
    [readings, latestReading?.station_id, readingIsStale],
  );
  const estimatedTimeToThreshold = getEstimatedTimeToThreshold(
    latestReading?.water_level,
    rateOfRise.rateMPerMinute,
  );

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
      { label: 'Active Alerts', value: String(alerts.filter((alert) => alert.is_active !== false && getAlertStatus(alert, now) !== 'RESOLVED' && !isAlertExpired(alert, now)).length) },
    ];
  }, [sensors, readings, alerts, now]);

  const stationStatusCards = useMemo(() => {
    const latestByStation = new Map();
    readings.forEach((reading) => {
      const previous = latestByStation.get(reading.station_id);
      if (!previous || new Date(reading.recorded_at) > new Date(previous.recorded_at)) {
        latestByStation.set(reading.station_id, reading);
      }
    });
    const monitoredStations = sensors.length
      ? sensors
      : latestReading ? [{ station_id: latestReading.station_id, status: latestReading.sensor_status }] : [];
    const counts = { WATCH: 0, WARNING: 0, CRITICAL: 0, STALE: 0, OFFLINE: 0, UNKNOWN: 0 };

    monitoredStations.forEach((sensor) => {
      const reading = latestByStation.get(sensor.station_id)
        || (latestReading?.station_id === sensor.station_id ? latestReading : null);
      let status = getSensorStatus(reading, appConfig.staleMinutes, now);
      if (String(sensor.status || '').toUpperCase() === 'OFFLINE') status = 'OFFLINE';
      const category = status === 'ONLINE' ? getRiskLevel(reading?.water_level) : status;
      if (Object.hasOwn(counts, category)) counts[category] += 1;
    });

    return Object.entries(counts).map(([label, value]) => ({ label, value: String(value) }));
  }, [latestReading, now, readings, sensors]);

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

  const chartData = filteredReadings.filter((reading) => (
    reading.water_level !== null
    && reading.water_level !== undefined
    && reading.water_level !== ''
    && Number.isFinite(Number(reading.water_level))
  )).map((reading) => ({
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

    if (readingIsStale) return 0;
    const value = Number(latestReading.water_level);
    if (!Number.isFinite(value)) return 0;
    const maxThreshold = 4;
    return Math.min(100, (value / maxThreshold) * 100);
  })();

  return (
    <div className="dashboard-shell">
      <section className="hero-card dashboard-hero">
        {demoMode ? <div className="demo-banner">DEMO MODE · Example readings only · Not live sensor data</div> : null}
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
              {readingIsStale ? 'Not current' : latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}
            </div>
            {readingIsStale && latestReading ? <div className="muted">Last stored level: {formatWaterLevel(latestReading.water_level)}</div> : null}
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
            <div className="mini-detail">
              {riskStatus === 'NORMAL' ? 'River level is within the normal range. Stay aware of official updates.' : null}
              {riskStatus === 'WATCH' ? 'Monitor river updates and be ready to act if conditions change.' : null}
              {riskStatus === 'WARNING' ? 'Prepare essential items and follow responder instructions.' : null}
              {riskStatus === 'CRITICAL' ? 'Follow official emergency instructions and move to safety.' : null}
              {riskStatus === 'UNAVAILABLE' ? 'No current sensor reading is available. Do not rely on an older measurement.' : null}
            </div>
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
              <strong>{readingIsStale ? 'Not current' : latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
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
            level={readingIsStale ? null : latestLevelNumber}
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

      <div className="dashboard-grid dashboard-grid--summary" aria-label="Station risk status counts">
        {stationStatusCards.map((card) => (
          <div key={card.label} className={`metric-card metric-card--${card.label.toLowerCase()}`}>
            <label>{card.label} stations</label>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <section className="panel quick-safety-panel">
        <div>
          <p className="eyebrow">Your response</p>
          <h2>Are you safe?</h2>
          <p className="muted">Send a SAFE update or request help. An SOS does not automatically contact emergency services.</p>
        </div>
        <div className="filter-group">
          <Link className="safety-action-button safety-action-button--safe" to="/my-safety-status">I am safe</Link>
          <Link className="safety-action-button safety-action-button--sos" to="/my-safety-status">I need help</Link>
        </div>
      </section>

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
            <StatusBadge status={sensorStatus} />
          </div>
          <div className="list-item">
            <span>{readingIsStale ? 'Last stored reading' : 'Latest reading'}</span>
            <strong>{readingIsStale ? 'Not current' : latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
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
              <StatusBadge status={sensorStatus} />
            </div>
            <div className="list-item">
              <span>{readingIsStale ? 'Last stored water level' : 'Current water level'}</span>
              <strong>{readingIsStale ? 'Not current' : latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
