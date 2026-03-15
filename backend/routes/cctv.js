const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const cctvController = require('../controllers/cctvController');

// POST /api/cctv/streams — Add a CCTV stream (admin)
router.post('/streams', authMiddleware, adminMiddleware, cctvController.addStream);

// GET /api/cctv/streams — List streams
router.get('/streams', cctvController.getStreams);

// POST /api/cctv/analyze — Trigger frame analysis
router.post('/analyze', authMiddleware, adminMiddleware, cctvController.analyzeFrame);

// POST /api/cctv/upload-video — Upload video for analysis
router.post('/upload-video', authMiddleware, upload.array('video', 1), cctvController.uploadVideo);

// GET /api/cctv/alerts — Recent hazard alerts from CCTV
router.get('/alerts', cctvController.getAlerts);

module.exports = router;
