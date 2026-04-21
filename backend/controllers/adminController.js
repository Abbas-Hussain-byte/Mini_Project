const { supabaseAdmin } = require('../models/supabaseClient');
const { getOptimalAllocation, recalculatePriorities } = require('../services/prioritizationService');

/**
 * GET /api/admin/notifications — Role-aware alerts
 */
exports.getNotifications = async (req, res, next) => {
  try {
    // 1. Fetch new complaints (submitted)
    // 2. Fetch critical severity complaints
    // 3. Fetch complaints pending verification
    const { data: complaints, error } = await supabaseAdmin
      .from('complaints')
      .select('id, title, severity, status, created_at, category')
      .or('status.eq.submitted,severity.eq.critical,status.eq.pending_verification')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const notifications = (complaints || []).map(c => {
      let type = 'status_update';
      let title = 'Notification';
      if (c.status === 'submitted') {
        type = 'critical';
        title = 'New Complaint Submitted';
      } else if (c.status === 'pending_verification') {
        type = 'verification';
        title = 'Resolution Needs Verification';
      } else if (c.severity === 'critical') {
        type = 'critical';
        title = 'Critical Issue Alert';
      }

      return {
        id: c.id,
        type,
        title,
        body: `${c.title} (${c.category?.replace(/_/g, ' ') || 'General'})`,
        time: c.created_at,
        link: `/dashboard?id=${c.id}`
      };
    });

    res.json({ notifications });
  } catch (err) { 
    console.error('getNotifications error:', err);
    res.json({ notifications: [] }); 
  }
};

/**
 * GET /api/admin/export — Export complaints as CSV or JSON
 */
exports.exportComplaints = async (req, res, next) => {
  try {
    const { format = 'csv', status, category, severity, department_id } = req.query;

    let query = supabaseAdmin
      .from('complaints')
      .select('id, title, description, category, severity, status, priority_score, latitude, longitude, address, created_at, updated_at, resolved_at, departments(name, code)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (severity) query = query.eq('severity', severity);
    if (department_id) query = query.eq('department_id', department_id);

    const { data: complaints, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="civicpulse_complaints_${new Date().toISOString().split('T')[0]}.json"`);
      return res.json({ complaints, exported_at: new Date().toISOString(), count: complaints.length });
    }

    // CSV format
    const headers = ['ID', 'Title', 'Category', 'Severity', 'Status', 'Priority Score', 'Department', 'Address', 'Latitude', 'Longitude', 'Created At', 'Updated At', 'Resolved At', 'Description'];
    const csvRows = [headers.join(',')];

    for (const c of (complaints || [])) {
      const row = [
        c.id,
        `"${(c.title || '').replace(/"/g, '""')}"`,
        c.category || '',
        c.severity || '',
        c.status || '',
        c.priority_score || 0,
        `"${c.departments?.name || ''}"`,
        `"${(c.address || '').replace(/"/g, '""')}"`,
        c.latitude || '',
        c.longitude || '',
        c.created_at || '',
        c.updated_at || '',
        c.resolved_at || '',
        `"${(c.description || '').replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 200)}"`,
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="civicpulse_complaints_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
};

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
      .select('*, departments(id, name, code)')
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

    const updateData = { role };
    if (department_id !== undefined) updateData.department_id = department_id || null;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

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
