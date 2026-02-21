const express = require('express');
const InsuranceController = require('../controllers/insuranceController');

const router = express.Router();

router.get('/claims/pending', InsuranceController.viewClaims);
router.post('/claims/approve', InsuranceController.approveClaim);

module.exports = router;
