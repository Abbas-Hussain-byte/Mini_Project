const { supabaseAdmin } = require('../models/supabaseClient');
const { getOptimalAllocation, recalculatePriorities } = require('../services/prioritizationService');

/**
 * GET /api/admin/priorities — Budget-aware prioritized complaints (Knapsack DP)
 */
exports.getPriorities = async (req, res, next) => {
  try {
    const { budget_limit, max_items = 50 } = req.query;

    if (budget_limit) {
      // Use 0/1 Knapsack optimization
      const result = await getOptimalAllocation(parseFloat(budget_limit));
      return res.json(result);
    }

    // No budget → just return by priority
    const { data: complaints } = await supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code)')
      .in('status', ['submitted', 'under_review', 'assigned', 'in_progress'])
      .order('priority_score', { ascending: false })
      .limit(parseInt(max_items));

    res.json({ prioritized: complaints || [], total: (complaints || []).length });
  } catch (err) { next(err); }
};

/**
 * POST /api/admin/priorities/configure — Set priority weights and recalculate
 */
exports.configurePriorities = async (req, res, next) => {
  try {
    const { weights } = req.body;

    await supabaseAdmin
      .from('analytics_cache')
      .upsert({
        metric_name: 'priority_weights',
        metric_value: weights || {
          hazard_severity: 0.30,
          text_severity: 0.25,
          complaint_density: 0.20,
          recency: 0.15,
          population_impact: 0.10
        },
        computed_for: new Date().toISOString().split('T')[0]
      }, { onConflict: 'metric_name' });

    // Recalculate all priorities with new weights
    const result = await recalculatePriorities(weights);

    res.json({ message: 'Priority weights updated and recalculated', weights, ...result });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/users — List all users with complaint counts
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, role, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ users: data || [] });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/admin/users/:id/role — Change user role
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role, department_id } = req.body;
    const validRoles = ['citizen', 'admin', 'department_head', 'pending_dept_head'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    // Fetch current profile to get user info
    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!currentProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update role in profiles table (only columns that exist: role, updated_at)
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Also sync role + department_id into user_metadata so authMiddleware sees it
    // (since profiles.department_id column doesn't exist in DB schema)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.params.id);
    await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
      user_metadata: {
        ...(authUser?.user?.user_metadata || {}),
        role,
        ...(department_id ? { department_id } : {})
      }
    }).catch(e => console.warn('user_metadata sync warning:', e.message));

    // If approving a dept head, also update the department table with head info
    if (role === 'department_head') {
      const deptId = department_id;
      if (deptId) {
        await supabaseAdmin
          .from('departments')
          .update({
            head_name: currentProfile.full_name,
            head_email: currentProfile.email || '',
            head_phone: currentProfile.phone || '',
            head_user_id: req.params.id
          })
          .eq('id', deptId);
      }
    }

    // If demoting from dept head, clear department head fields in departments table
    if (currentProfile.role === 'department_head' && role !== 'department_head') {
      // Find department where this user was head
      await supabaseAdmin
        .from('departments')
        .update({ head_name: null, head_email: null, head_phone: null, head_user_id: null })
        .eq('head_user_id', req.params.id);
    }

    res.json({ message: 'Role updated', user: data });
  } catch (err) { next(err); }
};


/**
 * POST /api/admin/message — Send message to dept head about a complaint
 */
exports.sendMessage = async (req, res, next) => {
  try {
    const { complaint_id, message } = req.body;

    if (!complaint_id || !message) {
      return res.status(400).json({ error: 'complaint_id and message are required' });
    }

    // Add as complaint update (message = audit trail entry)
    const { data, error } = await supabaseAdmin
      .from('complaint_updates')
      .insert({
        complaint_id,
        updated_by: req.user.id,
        old_status: null,
        new_status: null,
        comment: `[ADMIN MESSAGE] ${message}`
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: 'Message sent to department', update: data });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/disaster-alerts — Get all escalated/at-risk complaints
 */
exports.getDisasterAlerts = async (req, res, next) => {
  try {
    const { checkAndEscalate, getDisasterAlerts } = require('../services/disasterResponseService');

    // First run auto-escalation check
    const escalationResult = await checkAndEscalate();

    // Then get all alerts
    const alerts = await getDisasterAlerts();

    res.json({
      ...alerts,
      autoEscalated: escalationResult.count,
      autoEscalatedDetails: escalationResult.escalated
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/admin/escalate/:id — Manually escalate a complaint
 */
exports.escalateComplaint = async (req, res, next) => {
  try {
    const { escalateComplaint } = require('../services/disasterResponseService');
    const result = await escalateComplaint(req.params.id, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/notifications — Role-aware notification feed
 * Works for admin, dept_head, and citizen roles
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const deptId = req.user.department_id;
    const notifications = [];

    if (role === 'admin') {
      // 1. Critical / escalated open complaints
      const { data: criticalComplaints } = await supabaseAdmin
        .from('complaints')
        .select('id, title, severity, status, created_at')
        .eq('severity', 'critical')
        .neq('status', 'resolved')
        .neq('status', 'rejected')
        .neq('status', 'duplicate')
        .order('created_at', { ascending: false })
        .limit(10);

      (criticalComplaints || []).forEach(c => {
        notifications.push({
          id: `crit-${c.id}`,
          type: 'critical',
          icon: '🚨',
          title: `Critical Issue: ${c.title}`,
          body: `Severity: ${c.severity} • Status: ${c.status?.replace(/_/g, ' ')}`,
          link: '/dashboard',
          time: c.created_at,
          read: false
        });
      });

      // 2. Complaints pending admin verification
      const { data: pendingVerif } = await supabaseAdmin
        .from('complaints')
        .select('id, title, created_at, departments(name)')
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false })
        .limit(10);

      (pendingVerif || []).forEach(c => {
        notifications.push({
          id: `verif-${c.id}`,
          type: 'verification',
          icon: '✅',
          title: `Verification Needed: ${c.title}`,
          body: `Dept: ${c.departments?.name || 'Unknown'} — awaiting your sign-off`,
          link: '/dashboard',
          time: c.created_at,
          read: false
        });
      });

      // 3. Pending dept head approvals
      const { data: pendingUsers } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, created_at')
        .eq('role', 'pending_dept_head')
        .order('created_at', { ascending: false })
        .limit(5);

      (pendingUsers || []).forEach(u => {
        notifications.push({
          id: `pending-${u.id}`,
          type: 'approval',
          icon: '👤',
          title: `Approval Needed: ${u.full_name}`,
          body: `${u.email} applied to be a department head`,
          link: '/dashboard',
          time: u.created_at,
          read: false
        });
      });

    } else if (role === 'department_head' && deptId) {
      // 1. Admin messages for dept complaints — filter by dept complaints first
      const { data: deptComplaintIds } = await supabaseAdmin
        .from('complaints')
        .select('id')
        .eq('department_id', deptId)
        .limit(100);

      const ids = (deptComplaintIds || []).map(c => c.id);
      const adminMsgs = [];

      if (ids.length > 0) {
        const { data: msgs } = await supabaseAdmin
          .from('complaint_updates')
          .select('id, complaint_id, comment, created_at, complaints(title)')
          .like('comment', '[ADMIN MESSAGE]%')
          .in('complaint_id', ids)
          .order('created_at', { ascending: false })
          .limit(10);
        if (msgs) adminMsgs.push(...msgs);
      }

      (adminMsgs || []).forEach(upd => {
        if (!upd.complaints) return;
        notifications.push({
          id: `msg-${upd.id}`,
          type: 'message',
          icon: '📩',
          title: `Admin Message: ${upd.complaints?.title || 'Complaint'}`,
          body: upd.comment?.replace('[ADMIN MESSAGE] ', '') || '',
          link: '/departments',
          time: upd.created_at,
          read: false
        });
      });

      // 2. Critical complaints in their department
      const { data: deptCritical } = await supabaseAdmin
        .from('complaints')
        .select('id, title, severity, status, created_at')
        .eq('department_id', deptId)
        .eq('severity', 'critical')
        .neq('status', 'resolved')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(5);

      (deptCritical || []).forEach(c => {
        notifications.push({
          id: `deptcrit-${c.id}`,
          type: 'critical',
          icon: '🚨',
          title: `Critical: ${c.title}`,
          body: `Assigned to your department — action required`,
          link: '/departments',
          time: c.created_at,
          read: false
        });
      });

    } else {
      // Citizen: show their own complaint updates
      const { data: myComplaints } = await supabaseAdmin
        .from('complaints')
        .select('id, title')
        .eq('user_id', userId);

      const myIds = (myComplaints || []).map(c => c.id);

      if (myIds.length > 0) {
        const { data: updates } = await supabaseAdmin
          .from('complaint_updates')
          .select('id, complaint_id, old_status, new_status, comment, created_at, complaints(title)')
          .in('complaint_id', myIds)
          .not('new_status', 'is', null)
          .order('created_at', { ascending: false })
          .limit(15);

        (updates || []).forEach(upd => {
          const statusLabel = upd.new_status?.replace(/_/g, ' ') || '';
          notifications.push({
            id: `upd-${upd.id}`,
            type: 'status_update',
            icon: '📋',
            title: `Complaint Updated: ${upd.complaints?.title || 'Your complaint'}`,
            body: `Status changed to "${statusLabel}"${upd.comment ? ' — ' + upd.comment.slice(0, 60) : ''}`,
            link: '/track',
            time: upd.created_at,
            read: false
          });
        });
      }
    }

    // Sort by time descending
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({ notifications: notifications.slice(0, 20), total: notifications.length });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/export — Export complaints as CSV or JSON
 * Accepts: ?format=csv|json, ?department_id=, ?severity=, ?status=, ?days=
 */
exports.exportComplaints = async (req, res, next) => {
  try {
    const { format = 'csv', department_id, severity, status, days } = req.query;
    const role = req.user.role;
    const deptId = req.user.department_id;

    let query = supabaseAdmin
      .from('complaints')
      .select('id, title, description, category, severity, status, address, latitude, longitude, priority_score, created_at, resolved_at, duplicate_of, departments(name, code), profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(1000);

    // Dept heads can only export their department
    if (role === 'department_head' && deptId) {
      query = query.eq('department_id', deptId);
    } else if (department_id) {
      query = query.eq('department_id', department_id);
    }

    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (days) {
      const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }

    const { data: complaints, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename="civicpulse-complaints.json"');
      res.setHeader('Content-Type', 'application/json');
      return res.json(complaints);
    }

    // Build CSV
    const headers = ['ID', 'Title', 'Category', 'Severity', 'Status', 'Department', 'Address', 'Latitude', 'Longitude', 'Priority Score', 'Submitted By', 'Created At', 'Resolved At'];
    const rows = (complaints || []).map(c => [
      c.id,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      c.category || '',
      c.severity || '',
      c.status || '',
      c.departments?.name || '',
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.latitude || '',
      c.longitude || '',
      c.priority_score?.toFixed(4) || '0',
      c.profiles?.full_name || '',
      c.created_at ? new Date(c.created_at).toLocaleString() : '',
      c.resolved_at ? new Date(c.resolved_at).toLocaleString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename="civicpulse-complaints.csv"');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) { next(err); }
};
