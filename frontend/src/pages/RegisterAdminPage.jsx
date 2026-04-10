import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { FiUser, FiMail, FiPhone, FiLock, FiShield, FiCheckCircle } from 'react-icons/fi';

const ADMIN_SECRET = 'civicpulse-admin-2024';

export default function RegisterAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPassword: '', adminSecret: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.adminSecret !== ADMIN_SECRET) {
      return setError('Invalid admin secret key');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
            role: 'admin'
          }
        }
      });

      if (authError) throw authError;

      if (data.user) {
        // Wait briefly for the trigger to create the profile row
        await new Promise(res => setTimeout(res, 1000));
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin', full_name: formData.fullName, phone: formData.phone })
          .eq('id', data.user.id);
        if (updateError) console.warn('Profile role update failed:', updateError);
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputContainerStyle = {
    display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)',
    borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 1rem'
  };
  const inputStyle = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem'
  };
  const labelStyle = {
    display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a1a0a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '16px', padding: '2.5rem', maxWidth: '440px', width: '100%', border: '1px solid rgba(46, 160, 67, 0.3)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(46, 160, 67, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.8rem' }}>
            <FiCheckCircle color="#2ea043" />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem' }}>Admin Account Created!</h2>
          <p style={{ color: '#8b949e', marginBottom: '1.5rem' }}>
            You can now sign in using your email address.
          </p>
          <Link to="/login" style={{
            display: 'inline-block', padding: '0.85rem 2rem', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', textDecoration: 'none', fontWeight: 600
          }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a1a0a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '480px', border: '1px solid rgba(34, 197, 94, 0.15)', boxShadow: '0 0 40px rgba(34, 197, 94, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #22c55e, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>
            <FiShield color="#fff" />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem' }}>Admin Registration</h2>
          <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>Register as an admin to manage the CivicPulse platform</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px', color: '#f85149', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Full Name <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiUser color="#8b949e" />
              <input type="text" placeholder="Enter your full name" value={formData.fullName} onChange={handleChange('fullName')} required style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email Address <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiMail color="#8b949e" />
              <input type="email" placeholder="Enter your official email" value={formData.email} onChange={handleChange('email')} required style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Phone Number</label>
            <div style={inputContainerStyle}>
              <FiPhone color="#8b949e" />
              <input type="tel" placeholder="Enter your phone number" value={formData.phone} onChange={handleChange('phone')} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Admin Secret Key <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiShield color="#8b949e" />
              <input type="password" placeholder="Enter the admin secret key" value={formData.adminSecret} onChange={handleChange('adminSecret')} required style={inputStyle} />
            </div>
            <p style={{ color: '#6e7681', fontSize: '0.75rem', margin: '0.25rem 0 0 0.5rem' }}>Required to prevent unauthorized admin registrations</p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Password <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiLock color="#8b949e" />
              <input type="password" placeholder="Create a password (min 6 characters)" value={formData.password} onChange={handleChange('password')} required style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Confirm Password <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiLock color="#8b949e" />
              <input type="password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange('confirmPassword')} required style={inputStyle} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Registering...' : 'Register as Admin'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '1.5rem', fontSize: '0.85rem' }}>
          Already registered? <Link to="/login" style={{ color: '#22c55e', textDecoration: 'none', fontWeight: 500 }}>Sign In</Link>
        </p>
        <p style={{ textAlign: 'center', color: '#6e7681', marginTop: '0.5rem', fontSize: '0.8rem' }}>
          Are you a citizen? <Link to="/register" style={{ color: '#06b6d4', textDecoration: 'none' }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}
