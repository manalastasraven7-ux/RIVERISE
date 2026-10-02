import { useData } from '../services/DataContext';

export default function SensorMonitoringPage() {
  const { latestReading } = useData();

  return (
    <section>
      <div className="section-header">
        <h2>Sensor Monitoring</h2>
      </div>
      <div className="panel">
        <p><strong>Sensor status:</strong> {latestReading?.sensor_status || 'UNKNOWN'}</p>
        <p><strong>Latest reading:</strong> {latestReading ? new Date(latestReading.recorded_at).toLocaleString() : 'Waiting for real sensor data.'}</p>
        <p className="muted">The system is structured for future Arduino, ESP32, and LoRa sensor integrations via a secure backend.</p>
      </div>
    </section>
  );
}
