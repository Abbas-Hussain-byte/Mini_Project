const router = require('express').Router();
const { supabase, supabaseAdmin } = require('../models/supabaseClient');
const { authMiddleware } = require('../middleware/authMiddleware');

/**
 * Helper to ensure a profile exists and is confirmed
 * @param {string} userId 
 * @param {object} profileData 
 */
async function syncUserProfile(userId, profileData) {
  try {
    // 1. Ensure user is confirmed (bypass email link if dashboard setting missed)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true
    }).catch(e => console.warn('Auto-confirm warning:', e.message));

    // 2. Upsert profile (Insert if missing, Update if exists)
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        ...profileData,
        updated_at: new Date()
      }, { onConflict: 'id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Profile sync error:', err.message);
    return false;
  }
}

// POST /api/auth/register — Citizen registration (email-based)
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name, phone } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full_name are required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone: phone || '', role: 'citizen' }
      }
    });

    if (error) return res.status(400).json({ error: error.message });

    // Ensure profile exists
    if (data.user) {
      await syncUserProfile(data.user.id, {
        full_name,
        phone: phone || '',
        role: 'citizen'
      });
    }

    res.status(201).json({
      message: 'Registration successful',
      user: data.user,
      session: data.session
    });
  } catch (err) { next(err); }
});

// POST /api/auth/register-dept-head — Dept head registration (pending approval)
router.post('/register-dept-head', async (req, res, next) => {
  try {
    const { email, password, full_name, phone, department_id } = req.body;

    if (!email || !password || !full_name || !department_id) {
      return res.status(400).json({ error: 'Email, password, full_name, and department_id are required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone: phone || '', role: 'pending_dept_head', department_id }
      }
    });

    if (error) return res.status(400).json({ error: error.message });

    if (data.user) {
      await syncUserProfile(data.user.id, {
        full_name,
        phone: phone || '',
        role: 'pending_dept_head'
      });

      // Store department_id in app_metadata/user_metadata
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { full_name, phone: phone || '', role: 'pending_dept_head', department_id }
      }).catch(e => console.warn('dept_head metadata warning:', e.message));
    }

    res.status(201).json({
      message: 'Registration submitted! An administrator will review and approve your department head access.',
      user: data.user,
      pendingApproval: true
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Specifically handle email confirmation error if auto-confirm failed
      if (error.message.includes('Email not confirmed')) {
        return res.status(401).json({ 
          error: 'Your email is not confirmed. Please check your inbox or contact an admin.',
          needsConfirmation: true 
        });
      }
      return res.status(401).json({ error: error.message });
    }

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile is missing (legacy user?), create it now
    if (!profile) {
      await syncUserProfile(data.user.id, {
        full_name: data.user.user_metadata?.full_name || 'User',
        role: data.user.user_metadata?.role || 'citizen'
      });
    }

    // Block pending dept heads — Prioritize Database role over user_metadata
    const effectiveRole = profile?.role || data.user.user_metadata?.role;
    if (effectiveRole === 'pending_dept_head') {
      return res.status(403).json({
        error: 'Your department head registration is pending admin approval.',
        pendingApproval: true
      });
    }

    // Auto-sync metadata if it's out of date (helps frontend role checks)
    if (profile?.role && profile.role !== data.user.user_metadata?.role) {
      supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...data.user.user_metadata, role: profile.role }
      }).catch(e => console.warn('Silently failed to sync role metadata:', e.message));
    }

    res.json({
      user: data.user,
      profile: profile || { role: data.user.user_metadata?.role || 'citizen' },
      session: data.session
    });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found' });

    res.json({ user: req.user, profile });
  } catch (err) { next(err); }
});

// POST /api/auth/sync-role
router.post('/sync-role', authMiddleware, async (req, res, next) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', req.user.id)
      .single();

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      user_metadata: { ...req.user.user_metadata, role: profile.role }
    });

    res.json({
      message: 'Role synced successfully',
      role: profile.role
    });
  } catch (err) { next(err); }
});

module.exports = router;

