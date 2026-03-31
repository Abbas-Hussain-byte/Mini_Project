import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiPhone, FiShield, FiUser } from 'react-icons/fi';
import { supabase } from '../services/supabase';

export default function LoginPage() {
  const { user, profile } = useAuth();
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
      else navigate('/my-dashboard');
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let email = identifier;

      if (loginType === 'citizen') {
        // Citizen login: convert phone to proxy email
        const cleanPhone = identifier.replace(/[^0-9]/g, '');
        if (cleanPhone.length >= 10) {
          email = `citizen_${cleanPhone}@civicpulse.local`;
        } else {
          throw new Error('Please enter a valid phone number (at least 10 digits)');
        }
      }
      // Admin and dept_head login: email is used directly
      // Admin login: email is used directly

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        if (loginType === 'citizen') {
          throw new Error('Invalid phone number or password. Please check and try again.');
        }
        throw authError;
      }

      // Store token
      if (data.session) {
        localStorage.setItem('access_token', data.session.access_token);
      }

      // Check role matches login type
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (loginType === 'admin' && userProfile?.role !== 'admin') {
        setError('This account does not have admin privileges. Use citizen login instead.');
        await supabase.auth.signOut();
        localStorage.removeItem('access_token');
        setLoading(false);
        return;
      }

      if (loginType === 'dept_head' && userProfile?.role !== 'department_head') {
        setError('This account is not registered as a department head.');
        await supabase.auth.signOut();
        localStorage.removeItem('access_token');
        setLoading(false);
        return;
      }

      // Navigate based on role
      if (userProfile?.role === 'admin') {
        navigate('/dashboard');
      } else if (userProfile?.role === 'department_head') {
        navigate('/departments');
      } else {
        navigate('/my-dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = loginType === 'admin';
  const isDeptHead = loginType === 'dept_head';
  const accentColor = isAdmin ? '#f59e0b' : isDeptHead ? '#a855f7' : '#06b6d4';
  const accentDark = isAdmin ? '#d97706' : isDeptHead ? '#7c3aed' : '#0891b2';

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
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '440px',
        border: `1px solid ${accentColor}33`,
        boxShadow: `0 0 40px ${accentColor}26`,
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
            { id: 'citizen', label: 'Citizen', icon: <FiUser />, color: '#06b6d4' },
            { id: 'dept_head', label: 'Dept Head', icon: <FiShield />, color: '#a855f7' },
            { id: 'admin', label: 'Admin', icon: <FiShield />, color: '#f59e0b' },
          ].map(tab => (
            <button key={tab.id} type="button"
              onClick={() => { setLoginType(tab.id); setIdentifier(''); setError(''); }}
              style={{
                flex: 1, padding: '0.65rem 0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                fontWeight: 600, fontSize: '0.8rem',
                background: loginType === tab.id ? `${tab.color}33` : 'transparent',
                color: loginType === tab.id ? tab.color : '#8b949e',
                transition: 'all 0.3s ease'
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', fontSize: '1.5rem', transition: 'all 0.3s ease'
          }}>
            {isAdmin ? <FiShield color="#fff" /> : isDeptHead ? <FiShield color="#fff" /> : <FiUser color="#fff" />}
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
            {isAdmin ? 'Admin Login' : isDeptHead ? 'Department Head Login' : 'Citizen Login'}
          </h2>
          <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>
            {isAdmin ? 'Access the administrative dashboard' : isDeptHead ? 'Manage your department, workers & complaints' : 'Sign in with your registered phone number'}
            {isAdmin ? 'Access the administrative dashboard' : 'Sign in with your registered email address'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px',
            color: '#f85149', fontSize: '0.85rem', marginBottom: '1rem'
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              {loginType === 'citizen' ? 'Phone Number' : 'Email Address'}
              Email Address
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px', border: `1px solid ${identifier ? accentColor + '40' : 'rgba(48, 54, 61, 0.8)'}`,
              padding: '0 1rem', transition: 'border-color 0.3s'
            }}>
              {loginType === 'citizen' ? <FiPhone color="#8b949e" /> : <FiMail color="#8b949e" />}
              <input
                type={loginType === 'citizen' ? 'tel' : 'email'}
                placeholder={loginType === 'citizen' ? 'Enter your registered phone number' : loginType === 'dept_head' ? 'Enter your department email' : 'admin@example.com'}
              {isAdmin ? <FiMail color="#8b949e" /> : <FiMail color="#8b949e" />}
              <input
                type="email"
                placeholder={isAdmin ? 'admin@example.com' : 'Enter your registered email (e.g. someone@gmail.com)'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              Password
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px', border: `1px solid ${password ? accentColor + '40' : 'rgba(48, 54, 61, 0.8)'}`,
              padding: '0 1rem', transition: 'border-color 0.3s'
            }}>
              <FiLock color="#8b949e" />
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
              background: `linear-gradient(135deg, ${accentColor}, ${accentDark})`,
              color: '#fff', fontSize: '1rem', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.3s, transform 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {loginType === 'citizen' && (
          <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '1.5rem', fontSize: '0.85rem' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#06b6d4', textDecoration: 'none', fontWeight: 500 }}>Register Account</Link>
          </p>
        )}

        {loginType === 'dept_head' && (
          <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '1.5rem', fontSize: '0.85rem' }}>
            Not registered yet?{' '}
            <Link to="/register-dept-head" style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 500 }}>Register as Dept Head</Link>
          </p>
        )}

        {loginType === 'admin' && (
          <p style={{ textAlign: 'center', color: '#6e7681', marginTop: '1.5rem', fontSize: '0.8rem' }}>
            Admin accounts are created by system administrators
          </p>
        )}
      </div>
    </div>
  );
}
