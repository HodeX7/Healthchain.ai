const express = require('express');
const LabController = require('../controllers/labController');

const router = express.Router();

router.get('/orders', LabController.viewLabOrders);
router.post('/reports', LabController.uploadReport);

module.exports = router;
