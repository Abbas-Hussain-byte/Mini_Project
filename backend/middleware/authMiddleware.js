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

    // Fetch profile — only select columns that actually exist in the schema
    // NOTE: department_id is NOT a column in profiles — it comes from user_metadata
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name, phone')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = row not found — log anything else
      console.error(`⚠️ Profile fetch error for user ${user.id}:`, profileError.message);
    }

    // Role resolution order:
    // 1. profiles table (most reliable — updated directly by updateUserRole)
    // 2. user_metadata.role (set via our login sync + updateUserRole)
    // 3. app_metadata.role (set via Supabase dashboard)
    // 4. default 'citizen'
    const userRole =
      profile?.role ||
      user.user_metadata?.role ||
      user.app_metadata?.role ||
      'citizen';

    // department_id: comes from user_metadata (set during role assignment)
    const deptId =
      user.user_metadata?.department_id ||
      user.app_metadata?.department_id ||
      null;

    req.user = {
      ...user,
      role: userRole,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      phone: profile?.phone || user.user_metadata?.phone || '',
      department_id: deptId
    };
    req.token = token;
    next();
  } catch (err) {
    console.error('authMiddleware error:', err.message);
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
  const role = req.user.role;
  if (!['admin', 'department_head'].includes(role)) {
    console.warn(`⚠️ staffMiddleware DENIED: user ${req.user.id} has role "${role}" (needs admin or department_head)`);
    return res.status(403).json({ error: `Staff access required. Your current role is "${role}". Contact admin if this is wrong.` });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, staffMiddleware };
