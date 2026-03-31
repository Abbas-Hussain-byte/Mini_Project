const router = require('express').Router();
const { supabase } = require('../models/supabaseClient');
const { authMiddleware } = require('../middleware/authMiddleware');

// POST /api/auth/register
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

    res.status(201).json({
      message: 'Registration successful',
      user: data.user,
      session: data.session
    });
  } catch (err) { next(err); }
});

// POST /api/auth/register-dept-head
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
        data: { full_name, phone: phone || '', role: 'department_head' }
      }
    });

    if (error) return res.status(400).json({ error: error.message });

    // 2. Update profile to set role as department_head and link department
    if (data.user) {
      const { supabaseAdmin } = require('../models/supabaseClient');

      await supabaseAdmin
        .from('profiles')
        .update({
          role: 'department_head',
          phone: phone || '',
          full_name,
          department_id
        })
        .eq('id', data.user.id);

      // 3. Update department with head info
      await supabaseAdmin
        .from('departments')
        .update({
          head_name: full_name,
          head_email: email,
          head_phone: phone || '',
          head_user_id: data.user.id
        })
        .eq('id', department_id);
    }

    res.status(201).json({
      message: 'Department head registered successfully',
      user: data.user,
      session: data.session
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

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
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(404).json({ error: 'Profile not found' });

    res.json({ user: req.user, profile });
  } catch (err) { next(err); }
});

module.exports = router;
