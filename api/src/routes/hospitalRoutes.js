const express = require('express');
const HospitalController = require('../controllers/hospitalController');

const router = express.Router();

router.post('/access/request', HospitalController.requestAccess);
router.get('/patients/:id/records', HospitalController.getPatientRecords);
router.post('/records', HospitalController.createMedicalRecord);
router.post('/lab-orders', HospitalController.orderLabTest);
router.post('/prescriptions', HospitalController.issuePrescription);
router.post('/insurance-claims', HospitalController.submitInsuranceClaim);

module.exports = router;
