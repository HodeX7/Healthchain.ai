const express = require('express');
const PharmacyController = require('../controllers/pharmacyController');

const router = express.Router();

router.get('/prescriptions/pending', PharmacyController.viewPrescriptions);
router.post('/prescriptions/fulfill', PharmacyController.fulfillPrescription);

module.exports = router;
