import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiMenu, FiX, FiHome, FiPlusCircle, FiSearch, FiBarChart2, FiMap, FiMonitor, FiUsers, FiLogOut, FiLayout } from 'react-icons/fi';

export default function Navbar() {
  const { user, profile, isAdmin, isDeptHead, signOut } = useAuth();
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
      { to: '/my-dashboard', label: 'Dashboard', icon: <FiLayout /> },
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
    { to: '/submit', label: 'Report Issue', icon: <FiPlusCircle /> },
    { to: '/heatmap', label: 'Heatmap', icon: <FiMap /> },
  ];

  const navLinks = isAdmin ? adminLinks : isDeptHead ? deptHeadLinks : citizenLinks;

  const roleColor = isAdmin ? '#f59e0b' : isDeptHead ? '#a855f7' : '#06b6d4';
  const roleLabel = profile?.role === 'pending_dept_head' ? 'Pending Approval' : profile?.role?.replace(/_/g, ' ');

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(51, 65, 85, 0.4)'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.85rem' }}>CP</span>
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 700, background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CivicPulse
            </span>
          </Link>

          {/* Desktop Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="desktop-nav">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none',
                  transition: 'all 0.2s',
                  color: location.pathname === link.to ? '#38bdf8' : '#cbd5e1',
                  background: location.pathname === link.to ? 'rgba(56, 189, 248, 0.1)' : 'transparent'
                }}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Auth Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="desktop-nav">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f0f6fc', margin: 0, lineHeight: 1.3 }}>
                    {profile?.full_name}
                  </p>
                  <p style={{
                    fontSize: '0.75rem', fontWeight: 500, margin: 0,
                    color: profile?.role === 'pending_dept_head' ? '#f59e0b' : roleColor,
                    textTransform: 'capitalize'
                  }}>
                    {roleLabel}
                  </p>
                </div>
                <button onClick={handleLogout} style={{
                  padding: '8px', borderRadius: '8px', border: 'none',
                  background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                }}>
                  <FiLogOut size={18} />
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#cbd5e1', textDecoration: 'none', fontWeight: 500 }}>Sign In</Link>
                <Link to="/register" style={{
                  padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  color: '#fff', textDecoration: 'none', fontWeight: 600
                }}>Register</Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="mobile-toggle"
            style={{ padding: '8px', border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', display: 'none' }}>
            {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div style={{
          borderTop: '1px solid rgba(51, 65, 85, 0.4)',
          background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)',
          padding: '0.75rem 1rem'
        }} className="mobile-menu">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 0.75rem', borderRadius: '8px',
                textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
                color: location.pathname === link.to ? '#38bdf8' : '#cbd5e1',
                background: location.pathname === link.to ? 'rgba(56, 189, 248, 0.1)' : 'transparent'
              }}>
              {link.icon}<span>{link.label}</span>
            </Link>
          ))}
          {user ? (
            <button onClick={handleLogout} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 0.75rem', borderRadius: '8px',
              border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 500
            }}>
              <FiLogOut /><span>Log Out</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem' }}>
              <Link to="/login" onClick={() => setMobileOpen(false)} style={{
                display: 'block', textAlign: 'center', padding: '0.625rem',
                borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.5)',
                color: '#cbd5e1', textDecoration: 'none', fontSize: '0.875rem'
              }}>Sign In</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} style={{
                display: 'block', textAlign: 'center', padding: '0.625rem',
                borderRadius: '8px', background: '#38bdf8',
                color: '#fff', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600
              }}>Register</Link>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
