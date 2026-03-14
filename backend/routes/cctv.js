const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const cctvController = require('../controllers/cctvController');

// POST /api/cctv/streams — Add a CCTV stream (admin)
router.post('/streams', authMiddleware, adminMiddleware, cctvController.addStream);

// GET /api/cctv/streams — List streams
router.get('/streams', cctvController.getStreams);

// POST /api/cctv/analyze — Trigger frame analysis
router.post('/analyze', authMiddleware, adminMiddleware, cctvController.analyzeFrame);

// GET /api/cctv/alerts — Recent hazard alerts from CCTV
router.get('/alerts', cctvController.getAlerts);

module.exports = router;
