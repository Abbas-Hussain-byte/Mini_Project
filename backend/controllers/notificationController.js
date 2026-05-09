const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * GET /api/notifications
 * Fetches notifications specific to the user's ID or their ROLE.
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch notifications targeting this specific user OR their entire role
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},role.eq.${userRole}`)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ notifications: data || [] });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read/dismissed.
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // We verify the user owns the notification or it targets their role
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .or(`user_id.eq.${userId},role.eq.${req.user.role}`);

    if (error) throw error;
    res.json({ message: 'Notification dismissed' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/mark-all-read
 * Clears all pending notifications for the current user.
 */
exports.markAllRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .or(`user_id.eq.${userId},role.eq.${userRole}`)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    next(err);
  }
};
