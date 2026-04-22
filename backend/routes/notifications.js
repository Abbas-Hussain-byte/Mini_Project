const router = require('express').Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

// All notification routes require a logged-in user
router.use(authMiddleware);

// GET /api/notifications — Fetch current alerts
router.get('/', notificationController.getNotifications);

// PATCH /api/notifications/:id/read — Dismiss individual alert
router.patch('/:id/read', notificationController.markAsRead);

// POST /api/notifications/mark-all-read — Clear all alerts
router.post('/mark-all-read', notificationController.markAllRead);

module.exports = router;
