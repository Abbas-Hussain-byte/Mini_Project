const router = require('express').Router();
const { authMiddleware, adminMiddleware, staffMiddleware } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const complaintController = require('../controllers/complaintController');

// POST /api/complaints — Submit new complaint (images + videos)
router.post('/', authMiddleware, upload.array('files', 5), complaintController.createComplaint);

// GET /api/complaints — List complaints (paginated, filterable)
router.get('/', complaintController.getComplaints);

// GET /api/complaints/nearby — Get nearby complaints
router.get('/nearby', complaintController.getNearbyComplaints);

// GET /api/complaints/:id — Get single complaint detail
router.get('/:id', complaintController.getComplaintById);

// PATCH /api/complaints/:id — Update complaint status (admin OR dept_head)
router.patch('/:id', authMiddleware, staffMiddleware, complaintController.updateComplaint);

// POST /api/complaints/:id/verify — Admin verifies resolution
router.post('/:id/verify', authMiddleware, adminMiddleware, complaintController.verifyResolution);

// POST /api/complaints/:id/reject-resolution — Admin rejects resolution
router.post('/:id/reject-resolution', authMiddleware, adminMiddleware, complaintController.rejectResolution);

// GET /api/complaints/:id/duplicates — Get duplicate suggestions
router.get('/:id/duplicates', complaintController.getDuplicates);

module.exports = router;
