import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserDashboard from './pages/UserDashboard';
import SubmitComplaint from './pages/SubmitComplaint';
import TrackComplaint from './pages/TrackComplaint';
import AdminDashboard from './pages/AdminDashboard';
import HeatmapPage from './pages/HeatmapPage';
import DepartmentDashboard from './pages/DepartmentDashboard';
import CCTVMonitor from './pages/CCTVMonitor';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-civic-accent"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/my-dashboard" />;
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

              {/* Citizen Routes */}
              <Route path="/my-dashboard" element={
                <ProtectedRoute><UserDashboard /></ProtectedRoute>
              } />
              <Route path="/submit" element={
                <ProtectedRoute><SubmitComplaint /></ProtectedRoute>
              } />
              <Route path="/track" element={
                <ProtectedRoute><TrackComplaint /></ProtectedRoute>
              } />

              {/* Public */}
              <Route path="/heatmap" element={<HeatmapPage />} />

              {/* Admin Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>
              } />
              <Route path="/departments" element={
                <ProtectedRoute adminOnly><DepartmentDashboard /></ProtectedRoute>
              } />
              <Route path="/cctv" element={
                <ProtectedRoute adminOnly><CCTVMonitor /></ProtectedRoute>
              } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
