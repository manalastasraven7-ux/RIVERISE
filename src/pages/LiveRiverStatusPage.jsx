import { useMemo, useState } from 'react';
import { useData } from '../services/DataContext';
import RiverChart from '../components/RiverChart';
import StatusBadge from '../components/StatusBadge';
import {
  getDataFreshness,
  getRateOfChange,
  getRiskLevel,
  getRiverCondition,
  getSensorStatus,
  getWarningBannerText,
} from '../config/appConfig';

const timeWindowOptions = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
];

function formatWaterLevel(value) {
  if (value === null || value === undefined || value === '') return 'Sensor data unavailable';
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)} m` : 'Sensor data unavailable';
}

export default function LiveRiverStatusPage() {
  const { latestReading, readings, sensors, alerts, loading, error } = useData();
  const [selectedWindow, setSelectedWindow] = useState('24h');
  const [selectedAlertFilter, setSelectedAlertFilter] = useState('all');

  const sensorStatus = latestReading ? getSensorStatus(latestReading) : 'UNKNOWN';
  const currentRisk = latestReading && latestReading.water_level !== null && latestReading.water_level !== undefined
    ? getRiskLevel(latestReading.water_level)
    : 'UNAVAILABLE';

  const rateInfo = useMemo(() => getRateOfChange(readings, 30), [readings]);
  const riverCondition = useMemo(() => getRiverCondition(readings), [readings]);
  const warningBanner = getWarningBannerText(currentRisk);

  const latestSensor = latestReading && latestReading.station_id
    ? sensors.find((sensor) => sensor.station_id === latestReading.station_id)
    : null;

  const filteredReadings = useMemo(() => {
    if (!readings.length) return [];
    const now = Date.now();
    const cutoff = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }[selectedWindow] ?? (24 * 60 * 60 * 1000);

    return readings.filter((reading) => {
      const ts = new Date(reading.recorded_at).getTime();
      return Number.isFinite(ts) && now - ts <= cutoff;
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

  const filteredAlerts = alerts.filter((alert) => {
    if (selectedAlertFilter === 'all') return true;
    return String(alert.severity).toLowerCase() === selectedAlertFilter;
  });

  const activityList = [
    latestReading ? {
      title: 'New water-level reading received',
      time: latestReading.recorded_at,
      tone: 'info',
    } : null,
    latestSensor && latestSensor.status === 'ONLINE' ? {
      title: 'Sensor connected',
      time: latestSensor.updated_at || latestReading?.recorded_at,
      tone: 'success',
    } : null,
    latestSensor && latestSensor.status === 'OFFLINE' ? {
      title: 'Sensor disconnected',
      time: latestSensor.updated_at || latestReading?.recorded_at,
      tone: 'warning',
    } : null,
    currentRisk === 'WARNING' || currentRisk === 'CRITICAL' ? {
      title: 'Warning threshold reached',
      time: latestReading?.recorded_at,
      tone: 'danger',
    } : null,
  ].filter(Boolean);

  const gaugePercentage = (() => {
    if (!latestReading || latestReading.water_level === null || latestReading.water_level === undefined || latestReading.water_level === '') {
      return 0;
    }
    const value = Number(latestReading.water_level);
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, (value / 4) * 100);
  })();

  return (
    <div className="dashboard-shell">
      {warningBanner ? <div className="warning-banner">⚠ {warningBanner}</div> : null}

      <section className="hero-card dashboard-hero">
        <div className="dashboard-hero__header">
          <div>
            <p className="eyebrow">Live monitoring</p>
            <h1>Current water level</h1>
          </div>
          <div className="inline-live-pill">
            <span className="live-dot" />
            LIVE
          </div>
        </div>

        <div className="dashboard-hero__content">
          <div>
            <div className="water-level-value">
              {latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}
            </div>
            <div className="water-level-meta">
              <span>{latestReading?.station_id || 'Monitoring station unavailable'}</span>
              <span>•</span>
              <span>{latestReading ? `Last updated: ${new Date(latestReading.recorded_at).toLocaleString()}` : 'Last updated: No data available'}</span>
            </div>
          </div>

          <div className="hero-status-panel">
            <div className="mini-label">Risk status</div>
            <div className={`risk-status risk-status--${currentRisk.toLowerCase()}`}>
              {currentRisk === 'UNAVAILABLE' ? 'Status unavailable' : currentRisk}
            </div>
            <div className="mini-detail">{getDataFreshness(latestReading)}</div>
          </div>
        </div>

        <div className="gauge-block">
          <div className="gauge-header">
            <span>Water level gauge</span>
            <strong>{latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
          </div>
          <div className="gauge-track">
            <div className={`gauge-fill gauge-fill--${currentRisk.toLowerCase()}`} style={{ width: `${gaugePercentage}%` }} />
          </div>
          <div className="gauge-scale">
            <span>Normal</span>
            <span>Watch</span>
            <span>Warning</span>
            <span>Critical</span>
          </div>
        </div>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading sensor data…</div> : null}

      <div className="dashboard-grid dashboard-grid--summary">
        <div className="metric-card">
          <label>Rate of change</label>
          <strong>{rateInfo.value || 'Insufficient data'}</strong>
          <span className="meta-line">{rateInfo.direction || 'Insufficient data'}</span>
        </div>
        <div className="metric-card">
          <label>River condition</label>
          <strong>{riverCondition.text}</strong>
          <span className="meta-line">{rateInfo.periodLabel}</span>
        </div>
        <div className="metric-card">
          <label>Sensor status</label>
          <strong>{latestReading ? sensorStatus : 'Sensor offline'}</strong>
          <span className="meta-line">{latestReading ? getDataFreshness(latestReading) : 'No recent reading available'}</span>
        </div>
        <div className="metric-card">
          <label>Monitoring station</label>
          <strong>{latestReading?.station_id || 'Unavailable'}</strong>
          <span className="meta-line">{latestSensor?.name || 'Monitoring station'}</span>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--main">
        <section className="panel panel--wide">
          <div className="section-header">
            <div>
              <h2>Water level trend</h2>
            </div>
            <div className="filter-group" aria-label="Trend filters">
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

          {chartData.length ? <RiverChart data={chartData} /> : <div className="empty-state">Not enough sensor data to display the trend.</div>}
        </section>

        <aside className="panel panel--stacked">
          <div className="section-header">
            <h2>Sensor health</h2>
          </div>
          <div className="list-item list-item--accent">
            <span>Sensor ID</span>
            <strong>{latestReading?.station_id || 'N/A'}</strong>
          </div>
          <div className="list-item">
            <span>Online / Offline</span>
            <StatusBadge status={sensorStatus} />
          </div>
          <div className="list-item">
            <span>Last reading</span>
            <strong>{latestReading ? formatWaterLevel(latestReading.water_level) : 'Sensor data unavailable'}</strong>
          </div>
          <div className="list-item">
            <span>Last communication</span>
            <strong>{latestReading ? new Date(latestReading.recorded_at).toLocaleString() : 'No data available'}</strong>
          </div>
          <div className="list-item">
            <span>Monitoring station</span>
            <strong>{latestSensor?.name || 'Station unavailable'}</strong>
          </div>
        </aside>
      </div>

      <div className="dashboard-grid dashboard-grid--bottom">
        <section className="panel">
          <div className="section-header">
            <div>
              <h2>Alert history</h2>
            </div>
            <div className="filter-group" aria-label="Alert filters">
              {['all', 'normal', 'watch', 'warning', 'critical'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`filter-button ${selectedAlertFilter === filter ? 'is-active' : ''}`}
                  onClick={() => setSelectedAlertFilter(filter)}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {filteredAlerts.length ? (
            <div className="stacked-list">
              {filteredAlerts.map((alert) => (
                <div key={alert.id} className="list-item alert-row">
                  <div>
                    <div className="alert-row__meta">{new Date(alert.created_at).toLocaleString()}</div>
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
            <div className="empty-state">No alerts recorded.</div>
          )}
        </section>

        <section className="panel">
          <div className="section-header">
            <h2>System activity</h2>
          </div>
          {activityList.length ? (
            <div className="stacked-list">
              {activityList.map((item, index) => (
                <div key={`${item.title}-${index}`} className="list-item activity-row">
                  <div>
                    <strong>{item.title}</strong>
                  </div>
                  <div className="alert-row__right">
                    <span>{item.time ? new Date(item.time).toLocaleString() : 'No timestamp available'}</span>
                    <StatusBadge status={item.tone === 'danger' ? 'critical' : item.tone === 'success' ? 'online' : item.tone === 'warning' ? 'warning' : 'unknown'} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No system activity available.</div>
          )}
        </section>
      </div>
    </div>
  );
}
