import { Link, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LiveRiverStatusPage from './pages/LiveRiverStatusPage';
import AlertsPage from './pages/AlertsPage';
import SafetyStatusPage from './pages/SafetyStatusPage';
import CommunityPage from './pages/CommunityPage';
import CommunitySafetyMapPage from './pages/CommunitySafetyMapPage';
import EmergencyContactsPage from './pages/EmergencyContactsPage';
import AboutPage from './pages/AboutPage';
import ResponderDashboardPage from './pages/ResponderDashboardPage';
import SosRequestsPage from './pages/SosRequestsPage';
import ManageAlertsPage from './pages/ManageAlertsPage';
import ManageAnnouncementsPage from './pages/ManageAnnouncementsPage';
import ManageEvacuationCentersPage from './pages/ManageEvacuationCentersPage';
import SensorMonitoringPage from './pages/SensorMonitoringPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { DataProvider } from './services/DataContext';
import { CommunitySosProvider } from './services/CommunitySosContext';

function ResponderOnly({ children }) {
  const { user, loading, isResponder } = useAuth();

  if (loading) return <section className="empty-state">Checking account permissions...</section>;
  if (!user) {
    return (
      <section className="panel">
        <h2>Sign in required</h2>
        <p className="muted">Sign in with an authorized responder or administrator account to continue.</p>
        <Link className="filter-button is-active" to="/login">Sign in</Link>
      </section>
    );
  }
  if (!isResponder) {
    return (
      <section className="panel">
        <h2>Access restricted</h2>
        <p className="muted">This page is available to authorized responders and administrators.</p>
      </section>
    );
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <CommunitySosProvider>
          <Layout>
            <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/live-river-status" element={<LiveRiverStatusPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/my-safety-status" element={<SafetyStatusPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/community-safety-map" element={<CommunitySafetyMapPage />} />
            <Route path="/emergency-contacts" element={<EmergencyContactsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/responder" element={<ResponderOnly><ResponderDashboardPage /></ResponderOnly>} />
            <Route path="/sos-requests" element={<ResponderOnly><SosRequestsPage /></ResponderOnly>} />
            <Route path="/manage-alerts" element={<ResponderOnly><ManageAlertsPage /></ResponderOnly>} />
            <Route path="/manage-announcements" element={<ResponderOnly><ManageAnnouncementsPage /></ResponderOnly>} />
            <Route path="/manage-evacuation-centers" element={<ResponderOnly><ManageEvacuationCentersPage /></ResponderOnly>} />
            <Route path="/sensor-monitoring" element={<ResponderOnly><SensorMonitoringPage /></ResponderOnly>} />
            <Route path="/login" element={<LoginPage />} />
            </Routes>
          </Layout>
        </CommunitySosProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
