const router = require('express').Router();
const { authMiddleware, adminMiddleware, staffMiddleware } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// GET /api/admin/notifications — Role-aware alerts (any logged-in user)
router.get('/notifications', authMiddleware, adminController.getNotifications);

// GET /api/admin/export — Export complaints CSV/JSON (admin or dept_head)
router.get('/export', authMiddleware, staffMiddleware, adminController.exportComplaints);

// GET /api/admin/priorities — Budget-aware prioritized list (Knapsack DP)
router.get('/priorities', authMiddleware, adminMiddleware, adminController.getPriorities);

// POST /api/admin/priorities/configure — Set budget constraints
router.post('/priorities/configure', authMiddleware, adminMiddleware, adminController.configurePriorities);

// GET /api/admin/users — List all users
router.get('/users', authMiddleware, adminMiddleware, adminController.getUsers);

// PATCH /api/admin/users/:id/role — Change user role
router.patch('/users/:id/role', authMiddleware, adminMiddleware, adminController.updateUserRole);

// POST /api/admin/message — Send message to dept head
router.post('/message', authMiddleware, adminMiddleware, adminController.sendMessage);

// GET /api/admin/disaster-alerts — Get disaster/escalated alerts
router.get('/disaster-alerts', authMiddleware, adminMiddleware, adminController.getDisasterAlerts);

// POST /api/admin/escalate/:id — Manually escalate a complaint
router.post('/escalate/:id', authMiddleware, adminMiddleware, adminController.escalateComplaint);

module.exports = router;
