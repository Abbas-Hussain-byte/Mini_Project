const { supabase } = require('../models/supabaseClient');
const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * Verify JWT token and ALWAYS attach role to req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // ALWAYS fetch profile to get role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name, phone')
      .eq('id', user.id)
      .single();

    req.user = {
      ...user,
      role: profile?.role || 'citizen',
      full_name: profile?.full_name || '',
      phone: profile?.phone || ''
    };
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Check if user has admin role (admin only, NOT dept_head)
 */
const adminMiddleware = async (req, res, next) => {
  // Role already attached by authMiddleware
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Check if user is admin OR department_head
 */
const staffMiddleware = async (req, res, next) => {
  if (!['admin', 'department_head'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Staff access required (admin or department head)' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, staffMiddleware };
