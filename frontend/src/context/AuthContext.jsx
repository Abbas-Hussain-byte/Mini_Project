import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('access_token', session.access_token);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          localStorage.setItem('access_token', session.access_token);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem('access_token');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
  };

  const signUp = async (email, password, fullName, phone) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');
      
      // If backend returns a session, log them in immediately
      if (data.session) {
        await supabase.auth.setSession(data.session);
        setUser(data.user);
        setProfile(data.profile);
        localStorage.setItem('access_token', data.session.access_token);
      }
      return { data, error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      // Crucial: Synchronize Supabase client with the backend's session
      if (data.session) {
        await supabase.auth.setSession(data.session);
        setUser(data.user);
        setProfile(data.profile);
        localStorage.setItem('access_token', data.session.access_token);
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Signin error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem('access_token');
  };

  const registerDeptHead = async (email, password, fullName, phone, departmentId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register-dept-head`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, phone, department_id: departmentId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');
      return { data, error: null };
    } catch (error) {
      console.error('Dept head registration error:', error);
      return { data: null, error };
    }
  };
  // Separate roles: admin is ONLY admin, isDeptHead is ONLY department_head
  const isAdmin = profile?.role === 'admin';
  const isDeptHead = profile?.role === 'department_head';
  // Staff = admin OR active department_head
  const isStaff = isAdmin || isDeptHead;

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      isAdmin, isDeptHead, isStaff,
      signUp, signIn, signOut, registerDeptHead, fetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}
