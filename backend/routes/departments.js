const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const departmentController = require('../controllers/departmentController');

// GET /api/departments — List all departments
router.get('/', departmentController.getAllDepartments);

// GET /api/departments/performance — Performance metrics for all departments
router.get('/performance', departmentController.getDepartmentPerformance);

// GET /api/departments/:id — Single department details
router.get('/:id', departmentController.getDepartmentById);

// GET /api/departments/:id/assignments — Assignments for a department
router.get('/:id/assignments', departmentController.getDepartmentAssignments);

// GET /api/departments/:id/workers — Workers in a department
router.get('/:id/workers', departmentController.getDepartmentWorkers);

// POST /api/departments/:id/assignments — Manually assign a complaint
router.post('/:id/assignments', authMiddleware, adminMiddleware, departmentController.createAssignment);

// PATCH /api/departments/assignments/:id — Update assignment
router.patch('/assignments/:id', authMiddleware, adminMiddleware, departmentController.updateAssignment);

module.exports = router;
