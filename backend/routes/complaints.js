const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const complaintController = require('../controllers/complaintController');

// POST /api/complaints — Submit new complaint (with optional images)
router.post('/', authMiddleware, upload.array('images', 3), complaintController.createComplaint);

// GET /api/complaints — List complaints (paginated, filterable)
router.get('/', complaintController.getComplaints);

// GET /api/complaints/nearby — Get nearby complaints
router.get('/nearby', complaintController.getNearbyComplaints);

// GET /api/complaints/:id — Get single complaint detail
router.get('/:id', complaintController.getComplaintById);

// PATCH /api/complaints/:id — Update complaint status (admin)
router.patch('/:id', authMiddleware, adminMiddleware, complaintController.updateComplaint);

// GET /api/complaints/:id/duplicates — Get duplicate suggestions
router.get('/:id/duplicates', complaintController.getDuplicates);

module.exports = router;
