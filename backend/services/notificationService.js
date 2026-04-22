const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * Creates a persistent notification in the database.
 * @param {Object} params - Notification parameters
 * @param {string} [params.userId] - The specific user to notify (optional)
 * @param {string} [params.role] - The role to notify (e.g., 'admin') (optional)
 * @param {string} params.type - The type of notification (critical, verification, message, status_update)
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification description
 * @param {string} params.link - Deep link to the dashboard/item
 */
exports.createNotification = async ({ userId, role, type, title, body, link }) => {
  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId || null,
      role: role || null,
      type: type || 'status_update',
      title,
      body,
      link,
      is_read: false
    });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

/**
 * Helper to notify all admins
 */
exports.notifyAdmins = async (params) => {
  return exports.createNotification({ ...params, role: 'admin' });
};

/**
 * Helper to notify a department head by department ID
 */
exports.notifyDeptHead = async (deptId, params) => {
  try {
    // Find the user who is the head of this department
    const { data: head } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('department_id', deptId)
      .eq('role', 'department_head')
      .single();

    if (head) {
      return exports.createNotification({ ...params, userId: head.id });
    }
  } catch (err) {
    console.warn(`Could not find dept head for department ${deptId}:`, err.message);
  }
};
