import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useData } from '../services/DataContext';
import { appConfig, getSensorStatus } from '../config/appConfig';
import riveriseLogo from '../assets/riverise-logo.png';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/live-river-status', label: 'Live Monitoring' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/my-safety-status', label: 'Safety Status' },
  { to: '/community', label: 'Community' },
  { to: '/community-safety-map', label: 'Safety Map' },
  { to: '/emergency-contacts', label: 'Contacts' },
  { to: '/responder', label: 'Responder', responderOnly: true },
  { to: '/sos-requests', label: 'SOS', responderOnly: true },
  { to: '/manage-alerts', label: 'Manage Alerts', responderOnly: true },
  { to: '/manage-announcements', label: 'Announcements', responderOnly: true },
  { to: '/manage-evacuation-centers', label: 'Centers', responderOnly: true },
  { to: '/sensor-monitoring', label: 'Sensors', responderOnly: true },
];

export default function Layout({ children }) {
  const { latestReading, sensors, loading, error, demoMode, now } = useData();
  const { user, signOut, isResponder } = useAuth();
  const navigate = useNavigate();
  const latestSensor = sensors.find((sensor) => sensor.station_id === latestReading?.station_id);
  const statusReading = latestReading && latestSensor?.status
    ? { ...latestReading, sensor_status: latestSensor.status }
    : latestReading;
  const sensorStatus = latestReading ? getSensorStatus(statusReading, appConfig.staleMinutes, now) : 'UNKNOWN';
  const isRealtimeConnected = !demoMode && !error && !loading && sensorStatus === 'ONLINE';
  const statusLabel = isRealtimeConnected ? 'LIVE' : demoMode ? 'DEMO' : sensorStatus === 'UNKNOWN' ? 'OFFLINE' : sensorStatus;
  const systemStatus = isRealtimeConnected
    ? 'Connected'
    : demoMode
      ? 'Example data only'
      : sensorStatus === 'STALE' ? 'Latest reading is stale'
        : sensorStatus === 'OFFLINE' ? 'Sensor offline' : 'Monitoring unavailable';

  const syncLabel = demoMode
    ? 'Demo data'
    : latestReading?.recorded_at
    ? new Date(latestReading.recorded_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : demoMode ? 'Demo data' : 'Awaiting data';

  return (
    <div className="app-shell">
      <div className="workspace-layout">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img className="brand-logo" src={riveriseLogo} alt="RIVERISE" />
          </div>

          <div className="sidebar-section-label">Navigation</div>
          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.filter((item) => !item.responderOnly || isResponder).map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="content-panel">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="topbar-brand">
                <img className="topbar-logo" src={riveriseLogo} alt="RIVERISE" />
                <div className="topbar-copy">
                  <div className="topbar-kicker">River Rise Prediction and Early Warning System</div>
                  <div className="topbar-title">RIVERISE</div>
                </div>
              </div>

              <div className="header-status-area">
                <div className={`status-pill ${isRealtimeConnected ? 'status-pill--live' : 'status-pill--idle'}`}>
                  {statusLabel}
                </div>
                <div className="header-metric">
                  <span>System status</span>
                  <strong>{systemStatus}</strong>
                </div>
                <div className="header-metric">
                  <span>Last sync</span>
                  <strong>{syncLabel}</strong>
                </div>
                {user ? (
                  <button
                    className="profile-badge profile-badge--button"
                    type="button"
                    onClick={async () => {
                      await signOut();
                      navigate('/login');
                    }}
                  >
                    Sign out
                  </button>
                ) : (
                  <button className="profile-badge profile-badge--button" type="button" onClick={() => navigate('/login')}>
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="page-shell">{children}</main>
          <footer className="app-footer">RIVERISE • Know the Rise. Act in Time.</footer>
        </div>
      </div>
    </div>
  );
}
