import { useMemo } from 'react';
import { appConfig, getRiskLevel, getSensorStatus } from '../config/appConfig';
import { getCurrentRateOfRise } from '../config/riverMetrics';
import StatusBadge from '../components/StatusBadge';
import { useData } from '../services/DataContext';

export default function SensorMonitoringPage() {
  const { sensors, readings, latestReading, now, demoMode, loading, error } = useData();
  const stationCards = useMemo(() => sensors.map((sensor) => {
    const stationReadings = readings.filter((reading) => reading.station_id === sensor.station_id);
    const latest = stationReadings[stationReadings.length - 1] || null;
    const status = String(sensor.status || getSensorStatus(latest, appConfig.staleMinutes, now)).toUpperCase() === 'ONLINE'
      ? getSensorStatus(latest, appConfig.staleMinutes, now)
      : String(sensor.status || 'UNKNOWN').toUpperCase();
    return {
      sensor,
      latest,
      status,
      risk: status === 'ONLINE' ? getRiskLevel(latest?.water_level) : status,
      rate: getCurrentRateOfRise(stationReadings, sensor.station_id),
    };
  }), [now, readings, sensors]);

  return (
    <section className="dashboard-shell">
      <div className="section-header">
        <div><p className="eyebrow">Authorized technical view</p><h2>Sensor Monitoring</h2></div>
      </div>
      {demoMode ? <div className="demo-banner">DEMO MODE · Example station and readings only</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {loading ? <div className="empty-state">Loading station data...</div> : null}
      {stationCards.length ? <div className="sensor-grid">{stationCards.map(({ sensor, latest, status, risk, rate }) => (
        <article className="panel sensor-card" key={sensor.station_id}>
          <div className="alert-history-item__header"><div><p className="eyebrow">{sensor.station_id}</p><h3>{sensor.name || sensor.station_id}</h3></div><StatusBadge status={status} /></div>
          <p className="sensor-location">{sensor.location || sensor.barangay || (sensor.latitude != null && sensor.longitude != null ? `${sensor.latitude}, ${sensor.longitude}` : 'Station location not configured')}</p>
          <div className="sensor-card__metrics"><span>Water level<strong>{status === 'ONLINE' && latest ? `${Number(latest.water_level).toFixed(2)} m` : 'Not current'}</strong></span><span>Risk category<strong><StatusBadge status={risk} /></strong></span><span>Rate of rise<strong>{rate.value}</strong></span><span>Last reading<strong>{latest ? new Date(latest.recorded_at).toLocaleString() : 'No reading received'}</strong></span></div>
          {String(sensor.status || '').toUpperCase() === 'OFFLINE' ? <p className="warning-box">Station reports that the sensor is offline.</p> : null}
        </article>
      ))}</div> : <div className="empty-state">No monitoring stations are configured.</div>}
      {!sensors.length && latestReading ? <div className="muted">Latest station reported: {latestReading.station_id || 'Station not identified'}</div> : null}
    </section>
  );
}
