import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { FiUser, FiMail, FiPhone, FiLock, FiUserPlus, FiCheckCircle } from 'react-icons/fi';

export default function RegisterPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) navigate('/my-dashboard');
  }, [user, navigate]);

  const handleChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (!formData.email || !formData.email.includes('@')) {
      return setError('Valid email address is required');
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('An account with this phone number already exists. Please log in.');
        }
        throw authError;
      }

      // Update profile with phone number
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ phone: formData.phone, full_name: formData.fullName })
          .eq('id', data.user.id);
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '16px', padding: '2.5rem', maxWidth: '440px', width: '100%', border: '1px solid rgba(46, 160, 67, 0.3)', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(46, 160, 67, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.8rem' }}>
            <FiCheckCircle color="#2ea043" />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem' }}>Account Created!</h2>
          <p style={{ color: '#8b949e', marginBottom: '1.5rem' }}>
            You can now sign in using your email address.
          </p>
          <Link to="/login" style={{
            display: 'inline-block', padding: '0.85rem 2rem', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', textDecoration: 'none', fontWeight: 600
          }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '16px', padding: '2.5rem', width: '100%', maxWidth: '440px', border: '1px solid rgba(6, 182, 212, 0.15)', boxShadow: '0 0 40px rgba(6, 182, 212, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>
            <FiUserPlus color="#fff" />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem' }}>Citizen Registration</h2>
          <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>Sign up with your email to report civic issues</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px', color: '#f85149', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              Full Name <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 1rem' }}>
              <FiUser color="#8b949e" />
              <input type="text" placeholder="Enter your full name" value={formData.fullName} onChange={handleChange('fullName')} required
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem' }} />
            </div>
          </div>

          {/* Email Address */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              Email Address <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 1rem' }}>
              <FiMail color="#8b949e" />
              <input type="email" placeholder="Enter your email (e.g. someone@gmail.com)" value={formData.email} onChange={handleChange('email')} required
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem' }} />
            </div>
          </div>

          {/* Phone Number */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              Phone Number
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 1rem' }}>
              <FiPhone color="#8b949e" />
              <input type="tel" placeholder="Enter your phone number (optional)" value={formData.phone} onChange={handleChange('phone')}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem' }} />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              Password <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 1rem' }}>
              <FiLock color="#8b949e" />
              <input type="password" placeholder="Create a password (min 6 characters)" value={formData.password} onChange={handleChange('password')} required
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem' }} />
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.85rem', marginBottom: '0.4rem', fontWeight: 500 }}>
              Confirm Password <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(48, 54, 61, 0.8)', padding: '0 1rem' }}>
              <FiLock color="#8b949e" />
              <input type="password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange('confirmPassword')} required
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0f6fc', padding: '0.85rem 0.75rem', fontSize: '0.95rem' }} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#8b949e', marginTop: '1.5rem', fontSize: '0.85rem' }}>
          Already have an account? <Link to="/login" style={{ color: '#06b6d4', textDecoration: 'none', fontWeight: 500 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
