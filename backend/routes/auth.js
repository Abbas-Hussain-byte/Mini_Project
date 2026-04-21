const router = require('express').Router();
const { supabase } = require('../models/supabaseClient');
const { authMiddleware } = require('../middleware/authMiddleware');

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
        data: { full_name, phone: phone || '' }
      }
    });

    if (error) return res.status(400).json({ error: error.message });

    // Update profile with phone number
    if (data.user) {
      const { supabaseAdmin } = require('../models/supabaseClient');
      await supabaseAdmin
        .from('profiles')
        .update({ phone: phone || '', full_name, role: 'citizen' })
        .eq('id', data.user.id);
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

    // 1. Create Supabase auth user with real email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, phone: phone || '', role: 'pending_dept_head' }
      }
    });

    if (error) return res.status(400).json({ error: error.message });

    // 2. Set profile as "pending_dept_head" — NOT department_head yet
    //    Admin must approve before they become active dept heads
    if (data.user) {
      const { supabaseAdmin } = require('../models/supabaseClient');

      await supabaseAdmin
        .from('profiles')
        .update({ role: 'pending_dept_head', phone: phone || '', full_name })
        .eq('id', data.user.id);

      // Store department_id in user_metadata since profiles table doesn't have that column
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

    if (error) return res.status(401).json({ error: error.message });

    // Fetch profile with role
    const { supabaseAdmin } = require('../models/supabaseClient');
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Block pending dept heads from accessing the platform
    if (profile?.role === 'pending_dept_head') {
      return res.status(403).json({
        error: 'Your department head registration is pending admin approval. Please contact the administrator.',
        pendingApproval: true
      });
    }

    // Sync profile role → user_metadata so authMiddleware fallback always works
    const dbRole = profile?.role || 'citizen';
    const metaRole = data.user.user_metadata?.role;
    if (dbRole !== metaRole) {
      // Silently update user_metadata to match profile table
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...data.user.user_metadata, role: dbRole }
      }).catch(e => console.warn('Role sync warning:', e.message));
    }

    res.json({
      user: data.user,
      profile,
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
    const { supabaseAdmin } = require('../models/supabaseClient');
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found' });

    res.json({ user: req.user, profile });
  } catch (err) { next(err); }
});

// POST /api/auth/sync-role — Re-sync user_metadata role from profiles table
// Call this if role was updated in DB but the token still shows the old role
router.post('/sync-role', authMiddleware, async (req, res, next) => {
  try {
    const { supabaseAdmin } = require('../models/supabaseClient');
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', req.user.id)
      .single();

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Update user_metadata and app_metadata with current DB role
    await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      user_metadata: { ...req.user.user_metadata, role: profile.role }
    });

    res.json({
      message: 'Role synced successfully',
      role: profile.role,
      note: 'Please log out and log back in for the new role to take effect in your session.'
    });
  } catch (err) { next(err); }
});

module.exports = router;
