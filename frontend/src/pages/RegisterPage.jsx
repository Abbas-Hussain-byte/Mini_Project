import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { FiUser, FiMail, FiPhone, FiLock, FiUserPlus, FiCheckCircle } from 'react-icons/fi';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // We handle navigation differently for registration (show success message first)
  }, []);

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
      const { data, error: authError } = await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        formData.phone
      );

      if (authError) {
        throw authError;
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
    borderRadius: '12px', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '0 1rem',
    transition: 'border-color 0.3s'
  };
  const inputStyle = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#f0f6fc', padding: '0.875rem 0.75rem', fontSize: '0.9375rem', fontWeight: 400
  };
  const labelStyle = {
    display: 'block', color: '#e2e8f0', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '20px', padding: '2.5rem', maxWidth: '440px', width: '100%', border: '1px solid rgba(34, 197, 94, 0.25)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.8rem' }}>
            <FiCheckCircle color="#22c55e" size={32} />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>Account Created!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
            You can now sign in using your email address.
          </p>
          <Link to="/login" style={{
            display: 'inline-block', padding: '0.875rem 2rem', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff', textDecoration: 'none',
            fontWeight: 700, fontSize: '0.9375rem', boxShadow: '0 4px 16px rgba(56, 189, 248, 0.3)'
          }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '440px', border: '1px solid rgba(56, 189, 248, 0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(56, 189, 248, 0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem', boxShadow: '0 8px 24px rgba(56, 189, 248, 0.3)' }}>
            <FiUserPlus color="#fff" size={24} />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>Citizen Registration</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Sign up with your email to report civic issues</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.25)', borderRadius: '10px', color: '#f85149', fontSize: '0.875rem', marginBottom: '1.25rem', fontWeight: 500 }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>
              Full Name <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={inputContainerStyle}>
              <FiUser color="#64748b" size={16} />
              <input type="text" placeholder="Enter your full name" value={formData.fullName} onChange={handleChange('fullName')} required style={inputStyle} />
            </div>
          </div>

          {/* Email Address */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>
              Email Address <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={inputContainerStyle}>
              <FiMail color="#64748b" size={16} />
              <input type="email" placeholder="Enter your email (e.g. someone@gmail.com)" value={formData.email} onChange={handleChange('email')} required style={inputStyle} />
            </div>
          </div>

          {/* Phone Number */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>
              Phone Number
            </label>
            <div style={inputContainerStyle}>
              <FiPhone color="#64748b" size={16} />
              <input type="tel" placeholder="Enter your phone number (optional)" value={formData.phone} onChange={handleChange('phone')} style={inputStyle} />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>
              Password <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={inputContainerStyle}>
              <FiLock color="#64748b" size={16} />
              <input type="password" placeholder="Create a password (min 6 characters)" value={formData.password} onChange={handleChange('password')} required style={inputStyle} />
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={labelStyle}>
              Confirm Password <span style={{ color: '#f85149' }}>*</span>
            </label>
            <div style={inputContainerStyle}>
              <FiLock color="#64748b" size={16} />
              <input type="password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange('confirmPassword')} required style={inputStyle} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '0.9375rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', color: '#fff',
              fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(56, 189, 248, 0.3)',
              transition: 'all 0.3s'
            }}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#64748b', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          Already have an account? <Link to="/login" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}
