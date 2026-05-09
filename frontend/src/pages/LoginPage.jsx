import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiPhone, FiShield, FiUser } from 'react-icons/fi';
import { supabase } from '../services/supabase';

export default function LoginPage() {
  const { user, profile, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('citizen'); // 'citizen', 'admin', or 'dept_head'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') navigate('/dashboard');
      else if (profile.role === 'department_head') navigate('/departments');
      else if (profile.role === 'pending_dept_head') {
        // Don't navigate — show pending message
      } else navigate('/my-dashboard');
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await signIn(identifier, password);

      if (authError) {
        throw authError;
      }

      // Check role matches login type
      const userProfile = data.profile;

      if (loginType === 'admin' && userProfile?.role !== 'admin') {
        setError('This account does not have admin privileges. Use citizen login instead.');
        await signOut();
        setLoading(false);
        return;
      }

      if (loginType === 'dept_head' && !['department_head', 'pending_dept_head'].includes(userProfile?.role)) {
        setError('This account is not registered as a department head.');
        await signOut();
        setLoading(false);
        return;
      }

      if (userProfile?.role === 'pending_dept_head') {
        setError('Your department head registration is pending admin approval. Please contact the administrator.');
        await signOut();
        setLoading(false);
        return;
      }

      // Navigation is handled by the useEffect watching [user, profile]
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = loginType === 'admin';
  const isDeptHead = loginType === 'dept_head';
  const accentColor = isAdmin ? '#f59e0b' : isDeptHead ? '#a855f7' : '#38bdf8';
  const accentDark = isAdmin ? '#d97706' : isDeptHead ? '#7c3aed' : '#0ea5e9';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: isAdmin
        ? 'linear-gradient(135deg, #1a0a00 0%, #0d1117 50%, #1a0a00 100%)'
        : isDeptHead
        ? 'linear-gradient(135deg, #1a0a1a 0%, #0d1117 50%, #1a0a2a 100%)'
        : 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)',
      transition: 'background 0.5s ease'
    }}>
      <div style={{
        background: 'rgba(22, 27, 34, 0.9)',
        borderRadius: '20px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '440px',
        border: `1px solid ${accentColor}22`,
        boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 40px ${accentColor}15`,
        transition: 'all 0.5s ease'
      }}>
        {/* Role Toggle — 3 tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '2rem'
        }}>
          {[
            { id: 'citizen', label: 'Citizen', icon: <FiUser />, color: '#38bdf8' },
            { id: 'dept_head', label: 'Dept Head', icon: <FiShield />, color: '#a855f7' },
            { id: 'admin', label: 'Admin', icon: <FiShield />, color: '#f59e0b' },
          ].map(tab => (
            <button key={tab.id} type="button"
              onClick={() => { setLoginType(tab.id); setIdentifier(''); setError(''); }}
              style={{
                flex: 1, padding: '0.7rem 0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                fontWeight: 600, fontSize: '0.85rem',
                background: loginType === tab.id ? `${tab.color}22` : 'transparent',
                color: loginType === tab.id ? tab.color : '#64748b',
                transition: 'all 0.3s ease'
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', fontSize: '1.5rem', transition: 'all 0.3s ease',
            boxShadow: `0 8px 24px ${accentColor}30`
          }}>
            {isAdmin ? <FiShield color="#fff" /> : isDeptHead ? <FiShield color="#fff" /> : <FiUser color="#fff" />}
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
            {isAdmin ? 'Admin Login' : isDeptHead ? 'Department Head Login' : 'Citizen Login'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 400, margin: 0 }}>
            {isAdmin ? 'Access the administrative dashboard' : isDeptHead ? 'Manage your department, workers & complaints' : 'Sign in with your registered email address'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.25)', borderRadius: '10px',
            color: '#f85149', fontSize: '0.875rem', marginBottom: '1.25rem',
            fontWeight: 500, lineHeight: 1.5
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#e2e8f0', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              Email Address
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px', border: `1px solid ${identifier ? accentColor + '40' : 'rgba(51, 65, 85, 0.5)'}`,
              padding: '0 1rem', transition: 'border-color 0.3s'
            }}>
              <FiMail color="#64748b" size={16} />
              <input
                type="email"
                placeholder={loginType === 'citizen' ? 'Enter your registered email' : loginType === 'dept_head' ? 'Enter your department email' : 'admin@example.com'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#f0f6fc', padding: '0.875rem 0.75rem', fontSize: '0.9375rem',
                  fontWeight: 400
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', color: '#e2e8f0', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              Password
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px', border: `1px solid ${password ? accentColor + '40' : 'rgba(51, 65, 85, 0.5)'}`,
              padding: '0 1rem', transition: 'border-color 0.3s'
            }}>
              <FiLock color="#64748b" size={16} />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#f0f6fc', padding: '0.875rem 0.75rem', fontSize: '0.9375rem',
                  fontWeight: 400
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.9375rem', borderRadius: '12px', border: 'none',
              background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
              color: '#fff', fontSize: '1rem', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.3s',
              boxShadow: `0 4px 16px ${accentColor}30`
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {loginType === 'citizen' && (
          <p style={{ textAlign: 'center', color: '#64748b', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Register Account</Link>
          </p>
        )}

        {loginType === 'dept_head' && (
          <p style={{ textAlign: 'center', color: '#64748b', marginTop: '1.5rem', fontSize: '0.875rem' }}>
            Not registered yet?{' '}
            <Link to="/register-dept-head" style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 600 }}>Register as Dept Head</Link>
          </p>
        )}

        {loginType === 'admin' && (
          <p style={{ textAlign: 'center', color: '#475569', marginTop: '1.5rem', fontSize: '0.8125rem' }}>
            Admin accounts are created by system administrators
          </p>
        )}
      </div>
    </div>
  );
}
