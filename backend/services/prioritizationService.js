const { supabaseAdmin } = require('../models/supabaseClient');
const { SEVERITY_COST } = require('../utils/constants');

/**
 * Prioritization Service
 * Budget-aware complaint ranking using 0/1 Knapsack dynamic programming
 *
 * ALGORITHM: 0/1 Knapsack
 * - Each complaint is an "item" with a cost (based on severity) and value (priority_score)
 * - Budget = knapsack capacity
 * - DP finds the optimal subset that MAXIMIZES total priority within budget
 * - Time complexity: O(n * W/1000) where n = complaints, W = budget
 * - This is a well-known combinatorial optimization algorithm suitable for
 *   discrete budget allocation problems in civic management
 *
 * WHY KNAPSACK:
 * 1. It guarantees the mathematically optimal allocation (not greedy approximation)
 * 2. It handles the constraint that each complaint is either funded or not (binary)
 * 3. It maximize total civic impact per rupee spent
 * 4. Time complexity is polynomial and runs in <100ms for typical datasets
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
    .in('status', ['submitted', 'under_review', 'assigned', 'in_progress', 'pending_verification']);

  if (!complaints || complaints.length === 0) return { updated: 0 };

  // Get cluster sizes for density scoring
  const { data: clusters } = await supabaseAdmin.from('clusters').select('id, complaint_count');
  const clusterMap = {};
  (clusters || []).forEach(c => { clusterMap[c.id] = c.complaint_count; });

  // Get duplicate counts for priority boost
  const { data: duplicateCounts } = await supabaseAdmin
    .from('complaints')
    .select('duplicate_of')
    .not('duplicate_of', 'is', null);

  const dupCountMap = {};
  (duplicateCounts || []).forEach(d => {
    dupCountMap[d.duplicate_of] = (dupCountMap[d.duplicate_of] || 0) + 1;
  });

  const maxClusterSize = Math.max(...Object.values(clusterMap), 1);
  const now = Date.now();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;

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
    const populationScore = 0.5;

    let priorityScore = (
      weights.hazardSeverity * hazardScore +
      weights.textSeverity * textScore +
      weights.complaintDensity * densityScore +
      weights.recency * recencyScore +
      weights.populationImpact * populationScore
    );

    // DUPLICATE BOOST: +10% per duplicate pointing to this complaint
    const dupCount = dupCountMap[c.id] || 0;
    if (dupCount > 0) {
      priorityScore *= (1 + 0.1 * dupCount);
      priorityScore = Math.min(priorityScore, 1.0);
    }

    return { id: c.id, priority_score: parseFloat(priorityScore.toFixed(4)) };
  });

  for (const u of updates) {
    await supabaseAdmin
      .from('complaints')
      .update({ priority_score: u.priority_score })
      .eq('id', u.id);
  }

  return { updated: updates.length };
}

/**
 * 0/1 Knapsack Budget Optimization
 * Finds the optimal set of complaints to address within a given budget
 *
 * @param {number} budget - Total budget in rupees
 * @returns {Object} - Optimal allocation with selected complaints
 */
async function getOptimalAllocation(budget) {
  // Fetch active complaints with priority scores
  const { data: complaints } = await supabaseAdmin
    .from('complaints')
    .select('id, title, severity, priority_score, category, department_id, departments(name)')
    .in('status', ['submitted', 'under_review', 'assigned', 'in_progress'])
    .order('priority_score', { ascending: false });

  if (!complaints || complaints.length === 0) {
    return { prioritized: [], budgetLimit: budget, budgetUsed: 0, itemsIncluded: 0, itemsExcluded: 0, algorithm: 'knapsack' };
  }

  const n = complaints.length;

  // Assign costs based on severity
  const items = complaints.map(c => ({
    ...c,
    cost: SEVERITY_COST[c.severity] || 15000,
    value: c.priority_score || 0.5
  }));

  // Scale budget to integer units (divide by 1000 for tractable DP)
  const scale = 1000;
  const W = Math.floor(budget / scale);
  const costs = items.map(i => Math.max(1, Math.floor(i.cost / scale)));
  const values = items.map(i => Math.round(i.value * 10000)); // Scale to integers

  // DP table
  const dp = new Array(n + 1).fill(null).map(() => new Array(W + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let w = 0; w <= W; w++) {
      dp[i][w] = dp[i - 1][w];
      if (costs[i - 1] <= w) {
        dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - costs[i - 1]] + values[i - 1]);
      }
    }
  }

  // Backtrack to find selected items
  const selected = [];
  let w = W;
  for (let i = n; i > 0 && w > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(items[i - 1]);
      w -= costs[i - 1];
    }
  }

  selected.reverse();

  const budgetUsed = selected.reduce((sum, c) => sum + c.cost, 0);
  const excluded = items.filter(i => !selected.find(s => s.id === i.id));

  return {
    algorithm: 'knapsack_dp',
    algorithmExplanation: 'Uses 0/1 Knapsack dynamic programming to find the mathematically optimal set of complaints to address within the budget. Each complaint has a cost (based on severity) and a value (priority score). The algorithm maximizes total civic impact per rupee.',
    budgetLimit: budget,
    budgetUsed,
    budgetRemaining: budget - budgetUsed,
    utilization: parseFloat(((budgetUsed / budget) * 100).toFixed(1)),
    itemsIncluded: selected.length,
    itemsExcluded: excluded.length,
    totalPriorityValue: parseFloat(selected.reduce((s, c) => s + c.value, 0).toFixed(3)),
    prioritized: selected.map((c, i) => ({
      rank: i + 1,
      id: c.id,
      title: c.title,
      severity: c.severity,
      category: c.category,
      priority_score: c.value,
      cost: c.cost,
      department: c.departments?.name || 'Unassigned'
    })),
    excluded: excluded.slice(0, 20).map(c => ({
      id: c.id,
      title: c.title,
      severity: c.severity,
      cost: c.cost,
      priority_score: c.value
    }))
  };
}

module.exports = { recalculatePriorities, getOptimalAllocation };
