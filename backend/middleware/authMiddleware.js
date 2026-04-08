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

    // ALWAYS fetch profile to get role and department
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name, phone, department_id')
      .eq('id', user.id)
      .single();

    // Determine role: profile > user_metadata > 'citizen'
    let userRole = profile?.role || user.user_metadata?.role || 'citizen';
    
    // If profile exists but role is null/empty, check user_metadata
    if (!userRole || userRole === '') {
      userRole = user.user_metadata?.role || 'citizen';
    }

    req.user = {
      ...user,
      role: userRole,
      full_name: profile?.full_name || user.user_metadata?.full_name || '',
      phone: profile?.phone || '',
      department_id: profile?.department_id || null
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
  const role = req.user.role;
  if (!['admin', 'department_head'].includes(role)) {
    console.warn(`⚠️ staffMiddleware DENIED: user ${req.user.id} has role "${role}" (needs admin or department_head)`);
    return res.status(403).json({ error: `Staff access required. Your current role is "${role}". Contact admin if this is wrong.` });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, staffMiddleware };
