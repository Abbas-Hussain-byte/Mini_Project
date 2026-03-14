const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * Prioritization Service
 * Budget-aware complaint ranking using weighted scoring
 */

const DEFAULT_WEIGHTS = {
  hazardSeverity: 0.30,
  textSeverity: 0.25,
  complaintDensity: 0.20,
  recency: 0.15,
  populationImpact: 0.10
};

/**
 * Recalculate priority scores for all active complaints
 */
async function recalculatePriorities(customWeights) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  const { data: complaints } = await supabaseAdmin
    .from('complaints')
    .select('id, severity, ai_analysis, cluster_id, created_at')
    .in('status', ['submitted', 'under_review', 'assigned', 'in_progress']);

  if (!complaints || complaints.length === 0) return { updated: 0 };

  // Get cluster sizes for density scoring
  const { data: clusters } = await supabaseAdmin.from('clusters').select('id, complaint_count');
  const clusterMap = {};
  (clusters || []).forEach(c => { clusterMap[c.id] = c.complaint_count; });

  const maxClusterSize = Math.max(...Object.values(clusterMap), 1);
  const now = Date.now();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000; // 30 days

  const updates = complaints.map(c => {
    const severityMap = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
    const hazardScore = severityMap[c.severity] || 0.5;
    const textScore = c.ai_analysis?.textSeverity
      ? (severityMap[c.ai_analysis.textSeverity] || 0.5)
      : hazardScore;

    const densityScore = c.cluster_id && clusterMap[c.cluster_id]
      ? clusterMap[c.cluster_id] / maxClusterSize
      : 0.1;

    const ageMs = now - new Date(c.created_at).getTime();
    const recencyScore = Math.max(0, 1 - (ageMs / maxAgeMs));

    const populationScore = 0.5; // Placeholder

    const priorityScore = (
      weights.hazardSeverity * hazardScore +
      weights.textSeverity * textScore +
      weights.complaintDensity * densityScore +
      weights.recency * recencyScore +
      weights.populationImpact * populationScore
    );

    return { id: c.id, priority_score: parseFloat(priorityScore.toFixed(4)) };
  });

  // Batch update
  for (const u of updates) {
    await supabaseAdmin
      .from('complaints')
      .update({ priority_score: u.priority_score })
      .eq('id', u.id);
  }

  return { updated: updates.length };
}

module.exports = { recalculatePriorities };
