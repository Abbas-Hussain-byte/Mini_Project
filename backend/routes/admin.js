const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/priorities — Budget-aware prioritized list
router.get('/priorities', adminController.getPriorities);

// POST /api/admin/priorities/configure — Set budget constraints
router.post('/priorities/configure', adminController.configurePriorities);

// GET /api/admin/users — List all users
router.get('/users', adminController.getUsers);

// PATCH /api/admin/users/:id/role — Change user role
router.patch('/users/:id/role', adminController.updateUserRole);

module.exports = router;
