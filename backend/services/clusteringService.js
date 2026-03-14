const { supabaseAdmin } = require('../models/supabaseClient');

/**
 * DBSCAN Clustering Service
 * Simple implementation for complaint geospatial clustering
 */

const DEFAULT_EPS = 0.005;     // ~500m in degrees
const DEFAULT_MIN_SAMPLES = 3;

/**
 * Run DBSCAN clustering on complaint locations
 */
async function runClustering(eps = DEFAULT_EPS, minSamples = DEFAULT_MIN_SAMPLES) {
  // 1. Fetch all active complaint locations
  const { data: complaints } = await supabaseAdmin
    .from('complaints')
    .select('id, latitude, longitude, category, severity, priority_score')
    .not('status', 'eq', 'resolved');

  if (!complaints || complaints.length < minSamples) {
    return { clusters: [], message: 'Not enough complaints for clustering' };
  }

  // 2. Run DBSCAN
  const points = complaints.map(c => ({
    id: c.id,
    lat: c.latitude,
    lng: c.longitude,
    category: c.category,
    severity: c.severity,
    priority: c.priority_score
  }));

  const clusterAssignments = dbscan(points, eps, minSamples);

  // 3. Group by cluster
  const clusterGroups = {};
  clusterAssignments.forEach(({ point, clusterId }) => {
    if (clusterId === -1) return; // Noise
    if (!clusterGroups[clusterId]) clusterGroups[clusterId] = [];
    clusterGroups[clusterId].push(point);
  });

  // 4. Compute cluster centroids and risk scores
  const newClusters = Object.entries(clusterGroups).map(([clusterId, points]) => {
    const centroidLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const centroidLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

    // Dominant category
    const categoryCounts = {};
    points.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });
    const dominantCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

    // Risk score: based on count, severity, and priority
    const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    const avgSeverity = points.reduce((s, p) => s + (severityWeights[p.severity] || 2), 0) / points.length;
    const riskScore = Math.min(
      (points.length / 10) * 0.5 + (avgSeverity / 4) * 0.5,
      1.0
    );

    return {
      centroid_lat: centroidLat,
      centroid_lng: centroidLng,
      complaint_count: points.length,
      risk_score: parseFloat(riskScore.toFixed(3)),
      dominant_category: dominantCategory,
      bounding_box: {
        min_lat: Math.min(...points.map(p => p.lat)),
        max_lat: Math.max(...points.map(p => p.lat)),
        min_lng: Math.min(...points.map(p => p.lng)),
        max_lng: Math.max(...points.map(p => p.lng))
      }
    };
  });

  // 5. Clear old clusters and insert new
  await supabaseAdmin.from('clusters').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  if (newClusters.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from('clusters')
      .insert(newClusters)
      .select();

    return { clusters: inserted || [], totalComplaints: complaints.length };
  }

  return { clusters: [], totalComplaints: complaints.length };
}

/**
 * Simple DBSCAN implementation
 */
function dbscan(points, eps, minSamples) {
  const n = points.length;
  const visited = new Array(n).fill(false);
  const clusterIds = new Array(n).fill(-1);
  let currentCluster = 0;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;

    const neighbors = regionQuery(points, i, eps);

    if (neighbors.length < minSamples) {
      clusterIds[i] = -1; // Noise
    } else {
      expandCluster(points, i, neighbors, currentCluster, eps, minSamples, visited, clusterIds);
      currentCluster++;
    }
  }

  return points.map((point, i) => ({ point, clusterId: clusterIds[i] }));
}

function regionQuery(points, idx, eps) {
  const neighbors = [];
  for (let i = 0; i < points.length; i++) {
    if (haversineApprox(points[idx].lat, points[idx].lng, points[i].lat, points[i].lng) <= eps) {
      neighbors.push(i);
    }
  }
  return neighbors;
}

function expandCluster(points, idx, neighbors, clusterId, eps, minSamples, visited, clusterIds) {
  clusterIds[idx] = clusterId;
  const queue = [...neighbors];

  while (queue.length > 0) {
    const j = queue.shift();
    if (!visited[j]) {
      visited[j] = true;
      const jNeighbors = regionQuery(points, j, eps);
      if (jNeighbors.length >= minSamples) {
        queue.push(...jNeighbors);
      }
    }
    if (clusterIds[j] === -1) {
      clusterIds[j] = clusterId;
    }
  }
}

/**
 * Approximate distance between two lat/lng points (in degrees)
 */
function haversineApprox(lat1, lng1, lat2, lng2) {
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
}

module.exports = { runClustering };
