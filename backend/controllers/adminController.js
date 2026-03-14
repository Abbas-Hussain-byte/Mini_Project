const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * GET /api/admin/priorities — Budget-aware prioritized complaints
 */
exports.getPriorities = async (req, res, next) => {
  try {
    const { budget_limit, max_items = 50 } = req.query;

    const { data: complaints } = await supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code)')
      .in('status', ['submitted', 'under_review', 'assigned', 'in_progress'])
      .order('priority_score', { ascending: false })
      .limit(parseInt(max_items));

    // If budget_limit is set, apply budget-aware filtering
    let prioritized = complaints || [];
    if (budget_limit) {
      const budget = parseFloat(budget_limit);
      // Estimated cost per severity level (in currency units)
      const costEstimate = { critical: 50000, high: 30000, medium: 15000, low: 5000 };
      let runningCost = 0;

      prioritized = prioritized.filter(c => {
        const cost = costEstimate[c.severity] || 10000;
        if (runningCost + cost <= budget) {
          runningCost += cost;
          return true;
        }
        return false;
      });

      return res.json({
        prioritized,
        budgetUsed: runningCost,
        budgetLimit: budget,
        itemsIncluded: prioritized.length,
        itemsExcluded: (complaints || []).length - prioritized.length
      });
    }

    res.json({ prioritized, total: prioritized.length });
  } catch (err) { next(err); }
};

/**
 * POST /api/admin/priorities/configure — Set priority weights
 */
exports.configurePriorities = async (req, res, next) => {
  try {
    const { weights } = req.body;

    // Store in analytics_cache for use by scoring engine
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

    res.json({ message: 'Priority weights updated', weights });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/users — List all users
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
