import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiPhone, FiShield, FiUser } from 'react-icons/fi';
import { supabase } from '../services/supabase';

export default function LoginPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('citizen'); // 'citizen' or 'admin'
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
  const accentColor = isAdmin ? '#f59e0b' : '#06b6d4';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: isAdmin
        ? 'linear-gradient(135deg, #1a0a00 0%, #0d1117 50%, #1a0a00 100%)'
        : 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)',
      transition: 'background 0.5s ease'
    }}>
      <div style={{
        background: 'rgba(22, 27, 34, 0.9)',
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '440px',
        border: `1px solid ${isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(6, 182, 212, 0.2)'}`,
        boxShadow: `0 0 40px ${isAdmin ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)'}`,
        transition: 'all 0.5s ease'
      }}>
        {/* Role Toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '2rem'
        }}>
          <button
            type="button"
            onClick={() => { setLoginType('citizen'); setIdentifier(''); setError(''); }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontWeight: 600, fontSize: '0.9rem',
              background: loginType === 'citizen' ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: loginType === 'citizen' ? '#06b6d4' : '#8b949e',
              transition: 'all 0.3s ease'
            }}
          >
            <FiUser /> Citizen
          </button>
          <button
            type="button"
            onClick={() => { setLoginType('admin'); setIdentifier(''); setError(''); }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontWeight: 600, fontSize: '0.9rem',
              background: loginType === 'admin' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: loginType === 'admin' ? '#f59e0b' : '#8b949e',
              transition: 'all 0.3s ease'
            }}
          >
            <FiShield /> Admin
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}, ${isAdmin ? '#d97706' : '#0891b2'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', fontSize: '1.5rem', transition: 'all 0.3s ease'
          }}>
            {isAdmin ? <FiShield color="#fff" /> : <FiUser color="#fff" />}
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
            {isAdmin ? 'Admin Login' : 'Citizen Login'}
          </h2>
          <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>
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
              Email Address
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
              borderRadius: '10px', border: `1px solid ${identifier ? accentColor + '40' : 'rgba(48, 54, 61, 0.8)'}`,
              padding: '0 1rem', transition: 'border-color 0.3s'
            }}>
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
              background: `linear-gradient(135deg, ${accentColor}, ${isAdmin ? '#d97706' : '#0891b2'})`,
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

        {loginType === 'admin' && (
          <p style={{ textAlign: 'center', color: '#6e7681', marginTop: '1.5rem', fontSize: '0.8rem' }}>
            Admin accounts are created by system administrators
          </p>
        )}
      </div>
    </div>
  );
}
