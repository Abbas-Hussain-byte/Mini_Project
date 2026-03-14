const router = require('express').Router();
const analyticsController = require('../controllers/analyticsController');

// GET /api/analytics/overview — Dashboard summary stats
router.get('/overview', analyticsController.getOverview);

// GET /api/analytics/heatmap — Cluster data for map overlay
router.get('/heatmap', analyticsController.getHeatmapData);

// GET /api/analytics/trends — Time-series complaint trends
router.get('/trends', analyticsController.getTrends);

// GET /api/analytics/response-times — Resolution time metrics
router.get('/response-times', analyticsController.getResponseTimes);

// GET /api/analytics/risk-areas — High-risk areas with risk scores
router.get('/risk-areas', analyticsController.getRiskAreas);

// GET /api/analytics/duplicates — Duplicate complaint insights
router.get('/duplicates', analyticsController.getDuplicateInsights);

module.exports = router;
