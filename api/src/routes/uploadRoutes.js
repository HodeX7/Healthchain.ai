const express = require('express');
const router = express.Router();
const UploadController = require('../controllers/uploadController');

// Generate a temporary Signed URL for the frontend to upload a document to GCS
router.post('/upload-url', UploadController.getSignedUploadUrl);

module.exports = router;
