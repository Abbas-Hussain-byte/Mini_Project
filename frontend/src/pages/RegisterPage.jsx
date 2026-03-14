import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiPhone, FiUserPlus } from 'react-icons/fi';

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp, user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      navigate('/my-dashboard', { replace: true });
    }
  }, [user, profile, navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');

    setLoading(true);
    const { error: err } = await signUp(form.email, form.password, form.full_name, form.phone);
    setLoading(false);
    if (err) return setError(err.message);
    setSuccess(true);
    // Navigation will be handled by the useEffect above once profile loads
  };

  const fields = [
    { name: 'full_name', label: 'Full Name', type: 'text', icon: <FiUser />, placeholder: 'Your full name', required: true },
    { name: 'email', label: 'Email', type: 'email', icon: <FiMail />, placeholder: 'you@example.com', required: true },
    { name: 'phone', label: 'Phone (optional)', type: 'tel', icon: <FiPhone />, placeholder: '+91 9876543210' },
    { name: 'password', label: 'Password', type: 'password', icon: <FiLock />, placeholder: '••••••••', required: true },
    { name: 'confirm', label: 'Confirm Password', type: 'password', icon: <FiLock />, placeholder: '••••••••', required: true },
  ];

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-animated">
        <div className="glass-card w-full max-w-md p-8 animate-fade-in text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-civic-accent to-primary-500 flex items-center justify-center mx-auto mb-4">
            <FiUserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Account Created!</h1>
          <p className="text-slate-400 text-sm mb-4">Check your email to verify your account, then log in.</p>
          <Link to="/login" className="inline-block px-6 py-2.5 rounded-lg bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold hover:opacity-90 transition-opacity">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-animated">
      <div className="glass-card w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-civic-accent to-primary-500 flex items-center justify-center mx-auto mb-4">
            <FiUserPlus className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 text-sm mt-1">Join CivicPulse to report civic issues</p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-sm text-slate-300 mb-1.5">{f.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-500">{f.icon}</span>
                <input type={f.type} name={f.name} value={form[f.name]} onChange={handleChange} required={f.required}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent focus:ring-1 focus:ring-civic-accent outline-none transition-all"
                  placeholder={f.placeholder} />
              </div>
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-civic-accent hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
