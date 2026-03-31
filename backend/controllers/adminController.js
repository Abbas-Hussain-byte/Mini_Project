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
      .select('*')
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
    const { role } = req.body;
    const validRoles = ['citizen', 'admin', 'department_head'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
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
