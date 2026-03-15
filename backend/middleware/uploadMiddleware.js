const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (for videos)
    files: 5 // max 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heif', 'image/heic',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Allowed: JPEG, PNG, WebP, HEIF images and MP4, WebM, MOV videos'), false);
    }
  }
});

module.exports = { upload };
