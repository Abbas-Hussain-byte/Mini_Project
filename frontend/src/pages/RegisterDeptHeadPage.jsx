import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { FiUser, FiMail, FiPhone, FiLock, FiBriefcase, FiCheckCircle, FiClock } from 'react-icons/fi';

export default function RegisterDeptHeadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', password: '', confirmPassword: '', departmentId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) navigate('/departments');
  }, [user, navigate]);

  useEffect(() => {
    supabase.from('departments').select('id, name, code').eq('is_active', true)
      .then(({ data }) => setDepartments(data || []));
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
    if (!formData.departmentId) {
      return setError('Please select a department');
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
            role: 'department_head'
          }
        }
      });

      if (authError) throw authError;

      if (data.user) {
        // Wait briefly for the trigger to create the profile row
        await new Promise(res => setTimeout(res, 1000));
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'department_head', full_name: formData.fullName, phone: formData.phone })
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
    borderRadius: '12px', border: '1px solid rgba(51, 65, 85, 0.5)', padding: '0 1rem'
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #1a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '20px', padding: '2.5rem', maxWidth: '440px', width: '100%', border: '1px solid rgba(245, 158, 11, 0.25)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.8rem' }}>
            <FiClock color="#f59e0b" size={32} />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>Registration Submitted!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem', fontSize: '0.9375rem', lineHeight: 1.6 }}>
            Your department head registration is <strong style={{ color: '#f59e0b' }}>pending admin approval</strong>.
          </p>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
            An administrator will review your registration and assign you to your department. You'll be able to log in once approved.
          </p>
          <Link to="/login" style={{
            display: 'inline-block', padding: '0.875rem 2rem', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', textDecoration: 'none', fontWeight: 700,
            fontSize: '0.9375rem', boxShadow: '0 4px 16px rgba(168, 85, 247, 0.3)'
          }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'linear-gradient(135deg, #1a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ background: 'rgba(22, 27, 34, 0.9)', borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '480px', border: '1px solid rgba(168, 85, 247, 0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(168, 85, 247, 0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem', boxShadow: '0 8px 24px rgba(168, 85, 247, 0.3)' }}>
            <FiBriefcase color="#fff" size={24} />
          </div>
          <h2 style={{ color: '#f0f6fc', margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>Department Head Registration</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Register to manage complaints & workers for your department</p>
        </div>

        {/* Info Banner */}
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', marginBottom: '1.25rem' }}>
          <p style={{ color: '#f59e0b', fontSize: '0.8125rem', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
            ⚡ Your registration will be reviewed by an admin before activation. You'll have access to manage your department once approved.
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.25)', borderRadius: '10px', color: '#f85149', fontSize: '0.875rem', marginBottom: '1.25rem', fontWeight: 500 }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Full Name <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiUser color="#64748b" size={16} />
              <input type="text" placeholder="Enter your full name" value={formData.fullName} onChange={handleChange('fullName')} required style={inputStyle} />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email Address <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiMail color="#64748b" size={16} />
              <input type="email" placeholder="Enter your official email" value={formData.email} onChange={handleChange('email')} required style={inputStyle} />
            </div>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Phone Number</label>
            <div style={inputContainerStyle}>
              <FiPhone color="#64748b" size={16} />
              <input type="tel" placeholder="Enter your phone number" value={formData.phone} onChange={handleChange('phone')} style={inputStyle} />
            </div>
          </div>

          {/* Department */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Department <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiBriefcase color="#64748b" size={16} />
              <select value={formData.departmentId} onChange={handleChange('departmentId')} required
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}>
                <option value="" style={{ background: '#161b22', color: '#64748b' }}>Select your department</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id} style={{ background: '#161b22', color: '#f0f6fc' }}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Password <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiLock color="#64748b" size={16} />
              <input type="password" placeholder="Create a password (min 6 characters)" value={formData.password} onChange={handleChange('password')} required style={inputStyle} />
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={labelStyle}>Confirm Password <span style={{ color: '#f85149' }}>*</span></label>
            <div style={inputContainerStyle}>
              <FiLock color="#64748b" size={16} />
              <input type="password" placeholder="Re-enter your password" value={formData.confirmPassword} onChange={handleChange('confirmPassword')} required style={inputStyle} />
            </div>
          </div>

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '0.9375rem', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff',
              fontSize: '1rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(168, 85, 247, 0.3)',
              transition: 'all 0.3s'
            }}>
            {loading ? 'Submitting Registration...' : 'Submit Registration'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#64748b', marginTop: '1.5rem', fontSize: '0.875rem' }}>
          Already registered? <Link to="/login" style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
        </p>
        <p style={{ textAlign: 'center', color: '#475569', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
          Are you a citizen? <Link to="/register" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}
