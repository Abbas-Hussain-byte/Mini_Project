const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * GET /api/analytics/overview — Dashboard summary
 */
exports.getOverview = async (req, res, next) => {
  try {
    const { data: complaints } = await supabaseAdmin
      .from('complaints')
      .select('id, status, category, severity, department_id, created_at, resolved_at');

    const total = complaints.length;
    const byStatus = {};
    const byCategory = {};
    const bySeverity = {};
    let resolved = 0;

    complaints.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
      if (c.status === 'resolved') resolved++;
    });

    // Complaints in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentCount = complaints.filter(c => c.created_at >= weekAgo).length;

    res.json({
      total,
      resolved,
      resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : 0,
      recentCount,
      byStatus,
      byCategory,
      bySeverity
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/heatmap — Cluster data for map
 */
exports.getHeatmapData = async (req, res, next) => {
  try {
    const { data: clusters } = await supabaseAdmin
      .from('clusters')
      .select('*')
      .order('risk_score', { ascending: false });

    // Also return all complaint points for heatmap overlay
    const { data: points } = await supabaseAdmin
      .from('complaints')
      .select('id, latitude, longitude, category, severity, priority_score')
      .not('status', 'eq', 'resolved');

    res.json({ clusters: clusters || [], points: points || [] });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/trends — Time-series complaint data
 */
exports.getTrends = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const sinceDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString();

    const { data: complaints } = await supabaseAdmin
      .from('complaints')
      .select('created_at, category, severity')
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: true });

    // Group by date
    const byDate = {};
    (complaints || []).forEach(c => {
      const date = c.created_at.split('T')[0];
      if (!byDate[date]) byDate[date] = { date, count: 0, categories: {} };
      byDate[date].count++;
      byDate[date].categories[c.category] = (byDate[date].categories[c.category] || 0) + 1;
    });

    res.json({ trends: Object.values(byDate), totalDays: parseInt(days) });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/response-times — Resolution time metrics
 */
exports.getResponseTimes = async (req, res, next) => {
  try {
    const { data: resolved } = await supabaseAdmin
      .from('complaints')
      .select('created_at, resolved_at, category, severity')
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null);

    const times = (resolved || []).map(c => {
      const created = new Date(c.created_at);
      const resolvedAt = new Date(c.resolved_at);
      const hoursToResolve = (resolvedAt - created) / (1000 * 60 * 60);
      return { ...c, hoursToResolve };
    });

    const avgHours = times.length > 0
      ? times.reduce((sum, t) => sum + t.hoursToResolve, 0) / times.length
      : 0;

    // By severity
    const bySeverity = {};
    times.forEach(t => {
      if (!bySeverity[t.severity]) bySeverity[t.severity] = { total: 0, count: 0 };
      bySeverity[t.severity].total += t.hoursToResolve;
      bySeverity[t.severity].count++;
    });

    Object.keys(bySeverity).forEach(k => {
      bySeverity[k].avgHours = (bySeverity[k].total / bySeverity[k].count).toFixed(1);
    });

    res.json({ averageHours: avgHours.toFixed(1), totalResolved: times.length, bySeverity });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/risk-areas — High-risk areas
 */
exports.getRiskAreas = async (req, res, next) => {
  try {
    const { data: clusters } = await supabaseAdmin
      .from('clusters')
      .select('*')
      .order('risk_score', { ascending: false })
      .limit(20);

    res.json({ riskAreas: clusters || [] });
  } catch (err) { next(err); }
};

/**
 * GET /api/analytics/duplicates — Duplicate insights
 */
exports.getDuplicateInsights = async (req, res, next) => {
  try {
    const { data: duplicates } = await supabaseAdmin
      .from('complaints')
      .select('id, title, category, duplicate_of, created_at')
      .not('duplicate_of', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({
      duplicates: duplicates || [],
      totalDuplicates: (duplicates || []).length
    });
  } catch (err) { next(err); }
};
