const { supabase } = require('../models/supabaseClient');

/**
 * Verify JWT token from Supabase Auth
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

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Check if user has admin role
 */
const adminMiddleware = async (req, res, next) => {
  try {
    const { supabaseAdmin } = require('../models/supabaseClient');
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (!profile || !['admin', 'department_head'].includes(profile.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.userRole = profile.role;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Authorization check failed' });
  }
};

module.exports = { authMiddleware, adminMiddleware };
