import { Routes, Route } from 'react-router-dom';
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
import { AuthProvider } from './auth/AuthContext';
import { DataProvider } from './services/DataContext';
import { CommunitySosProvider } from './services/CommunitySosContext';

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
            <Route path="/responder" element={<ResponderDashboardPage />} />
            <Route path="/sos-requests" element={<SosRequestsPage />} />
            <Route path="/manage-alerts" element={<ManageAlertsPage />} />
            <Route path="/manage-announcements" element={<ManageAnnouncementsPage />} />
            <Route path="/manage-evacuation-centers" element={<ManageEvacuationCentersPage />} />
            <Route path="/sensor-monitoring" element={<SensorMonitoringPage />} />
            <Route path="/login" element={<LoginPage />} />
            </Routes>
          </Layout>
        </CommunitySosProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
