const router = require('express').Router();
const { authMiddleware, adminMiddleware, staffMiddleware } = require('../middleware/authMiddleware');
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

// POST /api/departments/:id/workers — Add worker to department (admin)
router.post('/:id/workers', authMiddleware, adminMiddleware, departmentController.addWorker);

// PATCH /api/departments/workers/:id — Update worker (admin)
router.patch('/workers/:id', authMiddleware, adminMiddleware, departmentController.updateWorker);

// DELETE /api/departments/workers/:id — Remove worker (admin)
router.delete('/workers/:id', authMiddleware, adminMiddleware, departmentController.deleteWorker);

// POST /api/departments/:id/assignments — Manually assign a complaint (admin or dept_head)
router.post('/:id/assignments', authMiddleware, staffMiddleware, departmentController.createAssignment);

// PATCH /api/departments/assignments/:id — Update assignment (admin or dept_head)
router.patch('/assignments/:id', authMiddleware, staffMiddleware, departmentController.updateAssignment);

module.exports = router;
