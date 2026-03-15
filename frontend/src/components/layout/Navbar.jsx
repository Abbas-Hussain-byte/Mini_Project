import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiMenu, FiX, FiHome, FiPlusCircle, FiSearch, FiBarChart2, FiMap, FiMonitor, FiUsers, FiLogOut, FiLayout } from 'react-icons/fi';

export default function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const citizenLinks = [
    { to: '/', label: 'Home', icon: <FiHome /> },
    ...(user ? [
      { to: '/my-dashboard', label: 'My Dashboard', icon: <FiLayout /> },
      { to: '/submit', label: 'Report Issue', icon: <FiPlusCircle /> },
      { to: '/track', label: 'My Complaints', icon: <FiSearch /> },
    ] : []),
    { to: '/heatmap', label: 'Heatmap', icon: <FiMap /> },
  ];

  const adminLinks = [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/dashboard', label: 'Admin Panel', icon: <FiBarChart2 /> },
    { to: '/departments', label: 'Departments', icon: <FiUsers /> },
    { to: '/cctv', label: 'CCTV', icon: <FiMonitor /> },
    { to: '/heatmap', label: 'Heatmap', icon: <FiMap /> },
    { to: '/submit', label: 'Report Issue', icon: <FiPlusCircle /> },
  ];

  const deptHeadLinks = [
    { to: '/', label: 'Home', icon: <FiHome /> },
    { to: '/departments', label: 'My Department', icon: <FiUsers /> },
    { to: '/heatmap', label: 'Heatmap', icon: <FiMap /> },
  ];

  const navLinks = profile?.role === 'admin' ? adminLinks : profile?.role === 'department_head' ? deptHeadLinks : citizenLinks;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-civic-border/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-civic-accent to-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CP</span>
            </div>
            <span className="text-lg font-bold gradient-text">CivicPulse</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  location.pathname === link.to
                    ? 'text-civic-accent bg-civic-accent/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{profile?.full_name}</p>
                  <p className="text-xs capitalize" style={{ color: profile?.role === 'admin' ? '#f59e0b' : profile?.role === 'department_head' ? '#a855f7' : '#06b6d4' }}>{profile?.role?.replace('_', ' ')}</p>
                </div>
                <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <FiLogOut size={18} />
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Sign In</Link>
                <Link to="/register" className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-civic-accent to-primary-500 text-white font-medium hover:opacity-90 transition-opacity">Register</Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-slate-300">
            {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-civic-border/50 bg-civic-dark/95 backdrop-blur-xl animate-slide-up">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg ${
                  location.pathname === link.to
                    ? 'text-civic-accent bg-civic-accent/10'
                    : 'text-slate-300 hover:bg-white/5'
                }`}>
                {link.icon}<span>{link.label}</span>
              </Link>
            ))}
            {user ? (
              <button onClick={handleLogout} className="w-full flex items-center space-x-2 px-3 py-2.5 text-red-400 hover:bg-red-500/10 rounded-lg">
                <FiLogOut /><span>Log Out</span>
              </button>
            ) : (
              <div className="pt-2 space-y-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-center py-2.5 rounded-lg border border-civic-border text-slate-300">Sign In</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block text-center py-2.5 rounded-lg bg-civic-accent text-white font-medium">Register</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
