const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/priorities — Budget-aware prioritized list (Knapsack DP)
router.get('/priorities', adminController.getPriorities);

// POST /api/admin/priorities/configure — Set budget constraints
router.post('/priorities/configure', adminController.configurePriorities);

// GET /api/admin/users — List all users
router.get('/users', adminController.getUsers);

// PATCH /api/admin/users/:id/role — Change user role
router.patch('/users/:id/role', adminController.updateUserRole);

// POST /api/admin/message — Send message to dept head
router.post('/message', adminController.sendMessage);

// GET /api/admin/disaster-alerts — Get disaster/escalated alerts
router.get('/disaster-alerts', adminController.getDisasterAlerts);

// POST /api/admin/escalate/:id — Manually escalate a complaint
router.post('/escalate/:id', adminController.escalateComplaint);

module.exports = router;
