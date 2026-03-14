import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      navigate(isAdmin ? '/dashboard' : '/my-dashboard', { replace: true });
    }
  }, [user, profile, isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: err } = await signIn(email, password);
    setLoading(false);
    if (err) return setError(err.message);
    // Navigation will be handled by the useEffect above once profile loads
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-animated">
      <div className="glass-card w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-civic-accent to-primary-500 flex items-center justify-center mx-auto mb-4">
            <FiLogIn className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to CivicPulse</p>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-3 text-slate-500" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent focus:ring-1 focus:ring-civic-accent outline-none transition-all"
                placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-slate-500" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent focus:ring-1 focus:ring-civic-accent outline-none transition-all"
                placeholder="••••••••" />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-civic-accent hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
