import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RegisterDeptHeadPage from './pages/RegisterDeptHeadPage';
import RegisterAdminPage from './pages/RegisterAdminPage';
import UserDashboard from './pages/UserDashboard';
import SubmitComplaint from './pages/SubmitComplaint';
import TrackComplaint from './pages/TrackComplaint';
import AdminDashboard from './pages/AdminDashboard';
import HeatmapPage from './pages/HeatmapPage';
import DepartmentDashboard from './pages/DepartmentDashboard';
import CCTVMonitor from './pages/CCTVMonitor';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ width: '48px', height: '48px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/my-dashboard" />;
  return children;
}

/** Route for admin OR department_head */
function StaffRoute({ children }) {
  const { user, isAdmin, isDeptHead, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ width: '48px', height: '48px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin && !isDeptHead) return <Navigate to="/my-dashboard" />;
  return children;
}

/** Redirect admins away from citizen pages */
function CitizenRoute({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div style={{ width: '48px', height: '48px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role === 'admin') return <Navigate to="/dashboard" />;
  if (profile?.role === 'department_head') return <Navigate to="/departments" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-civic-dark">
          <Navbar />
          <main className="pt-16">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/register-dept-head" element={<RegisterDeptHeadPage />} />
              <Route path="/register-admin" element={<RegisterAdminPage />} />

              {/* Citizen Routes — admins/dept heads get redirected */}
              <Route path="/my-dashboard" element={
                <CitizenRoute><UserDashboard /></CitizenRoute>
              } />
              <Route path="/submit" element={
                <ProtectedRoute><SubmitComplaint /></ProtectedRoute>
              } />
              <Route path="/track" element={
                <CitizenRoute><TrackComplaint /></CitizenRoute>
              } />

              {/* Public */}
              <Route path="/heatmap" element={<HeatmapPage />} />

              {/* Admin Only Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
              } />
              <Route path="/cctv" element={
                <ProtectedRoute adminOnly><CCTVMonitor /></ProtectedRoute>
              } />

              {/* Staff Routes (admin OR department_head) */}
              <Route path="/departments" element={
                <StaffRoute><DepartmentDashboard /></StaffRoute>
              } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
