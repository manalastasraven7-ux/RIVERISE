import { useMemo, useState } from 'react';
import { useData } from '../services/DataContext';
import RiverChart from '../components/RiverChart';
import StatusBadge from '../components/StatusBadge';
import { appConfig } from '../config/appConfig';
import {
  getDataFreshness,
  getRateOfChange,
  getRiskLevel,
  getRiverCondition,
  getSensorStatus,
  getWarningBannerText,
} from '../config/appConfig';
import { getCurrentRateOfRise, getWaterLevelPredictions } from '../config/riverMetrics';

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
  const { latestReading, readings, sensors, loading, error, demoMode, now } = useData();
  const [selectedWindow, setSelectedWindow] = useState('24h');

  const latestSensor = latestReading && latestReading.station_id
    ? sensors.find((sensor) => sensor.station_id === latestReading.station_id)
    : null;
  const readingWithSensorStatus = latestReading && latestSensor?.status
    ? { ...latestReading, sensor_status: latestSensor.status }
    : latestReading;
  const sensorStatus = latestReading ? getSensorStatus(readingWithSensorStatus, appConfig.staleMinutes, now) : 'UNKNOWN';
  const hasCurrentLevel = sensorStatus === 'ONLINE'
    && latestReading?.water_level !== null
    && latestReading?.water_level !== undefined
    && latestReading?.water_level !== ''
    && Number.isFinite(Number(latestReading?.water_level));
  const currentRisk = hasCurrentLevel
    ? getRiskLevel(latestReading.water_level)
    : 'UNAVAILABLE';

  const stationReadings = latestReading?.station_id
    ? readings.filter((reading) => reading.station_id === latestReading.station_id)
    : [];
  const rateInfo = useMemo(() => getRateOfChange(stationReadings, 30), [stationReadings]);
  const riverCondition = useMemo(() => getRiverCondition(stationReadings), [stationReadings]);
  const rateOfRise = useMemo(
    () => getCurrentRateOfRise(stationReadings, latestReading?.station_id),
    [stationReadings, latestReading?.station_id],
  );
  const predictions = hasCurrentLevel
    ? getWaterLevelPredictions(latestReading.water_level, rateOfRise.rateMPerMinute, currentRisk)
    : null;
  const warningBanner = getWarningBannerText(currentRisk);

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

  const activityList = [
    latestReading ? {
      title: hasCurrentLevel ? 'New water-level reading received' : 'Last stored reading is not current',
      time: latestReading.recorded_at,
      tone: hasCurrentLevel ? 'info' : 'warning',
    } : null,
    latestSensor && sensorStatus === 'ONLINE' ? {
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
    if (!hasCurrentLevel) return 0;
    const value = Number(latestReading.water_level);
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, (value / 4) * 100);
  })();

  return (
    <div className="dashboard-shell">
      {warningBanner ? <div className="warning-banner">⚠ {warningBanner}</div> : null}

      <section className="hero-card dashboard-hero">
        {demoMode ? <div className="demo-banner">DEMO MODE · Example readings only · Not live sensor data</div> : null}
        <div className="dashboard-hero__header">
          <div>
            <p className="eyebrow">Live monitoring</p>
            <h1>Current water level</h1>
          </div>
          <div className={`inline-live-pill ${demoMode || sensorStatus !== 'ONLINE' ? 'inline-live-pill--idle' : ''}`}>
            {!demoMode && sensorStatus === 'ONLINE' ? <span className="live-dot" /> : null}
            {demoMode ? 'DEMO' : sensorStatus === 'ONLINE' ? 'LIVE' : sensorStatus}
          </div>
        </div>

        <div className="dashboard-hero__content">
          <div>
            <div className="water-level-value">
              {hasCurrentLevel ? formatWaterLevel(latestReading.water_level) : 'No current reading'}
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
            <div className="mini-detail">{latestReading ? getDataFreshness(latestReading) : 'No recent reading available'}</div>
          </div>
        </div>

        <div className="gauge-block">
          <div className="gauge-header">
            <span>Water level gauge</span>
            <strong>{hasCurrentLevel ? formatWaterLevel(latestReading.water_level) : 'No current reading'}</strong>
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
            <strong>{hasCurrentLevel ? rateInfo.value || 'Insufficient data' : 'Not current'}</strong>
            <span className="meta-line">{hasCurrentLevel ? rateInfo.direction || 'Insufficient data' : 'Waiting for a fresh reading'}</span>
        </div>
        <div className="metric-card">
          <label>River condition</label>
            <strong>{hasCurrentLevel ? riverCondition.text : 'Unavailable'}</strong>
            <span className="meta-line">{hasCurrentLevel ? rateInfo.periodLabel : 'No current sensor reading'}</span>
        </div>
        <div className="metric-card">
          <label>Sensor status</label>
          <strong>{sensorStatus}</strong>
          <span className="meta-line">{latestReading ? getDataFreshness(latestReading) : 'No recent reading available'}</span>
        </div>
        <div className="metric-card">
          <label>Monitoring station</label>
          <strong>{latestSensor?.name || latestReading?.station_id || 'Unavailable'}</strong>
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
            <span>{hasCurrentLevel ? 'Latest reading' : 'Last stored reading'}</span>
            <strong>{latestReading ? `${formatWaterLevel(latestReading.water_level)}${hasCurrentLevel ? '' : ' · Not current'}` : 'Sensor data unavailable'}</strong>
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

      <section className="panel prediction-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Estimate, not a validated forecast</p>
            <h2>Water level prediction</h2>
          </div>
          <StatusBadge status={hasCurrentLevel ? currentRisk : sensorStatus} />
        </div>
        <div className="prediction-summary">
          <div>
            <span>Current water level</span>
            <strong>{hasCurrentLevel ? formatWaterLevel(latestReading.water_level) : 'Unavailable'}</strong>
          </div>
          <div>
            <span>Rate of rise</span>
            <strong>{hasCurrentLevel ? rateOfRise.value : 'Unavailable'}</strong>
          </div>
          <div>
            <span>Expected trend</span>
            <strong>{predictions ? predictions.trend : 'Unknown'}</strong>
          </div>
          <div>
            <span>Latest reading</span>
            <strong>{latestReading ? new Date(latestReading.recorded_at).toLocaleString() : 'No data'}</strong>
          </div>
        </div>
        {predictions ? (
          <div className="prediction-estimates">
            {predictions.estimates.map((estimate) => (
              <div key={estimate.hours} className="prediction-estimate">
                <span>In {estimate.hours} hour{estimate.hours > 1 ? 's' : ''}</span>
                <strong>{formatWaterLevel(estimate.waterLevel)}</strong>
                <StatusBadge status={estimate.risk} />
                {estimate.crossesThreshold ? <span className="prediction-crossing">Higher risk threshold crossed</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">{hasCurrentLevel ? 'Insufficient same-station readings for an estimate.' : 'A current online reading is required before estimating future levels.'}</div>
        )}
        {demoMode ? <p className="muted">Illustrative demo estimate from sample data. It is not a flood forecast.</p> : null}
        <p className="muted">This simple estimate extends the recent same-station rate forward. Conditions may change; follow official advisories.</p>
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
  );
}
