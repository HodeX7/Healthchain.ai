const express = require('express');
const PatientController = require('../controllers/patientController');

const router = express.Router();

router.post('/register', PatientController.register);
router.get('/:id', PatientController.get);
router.post('/:id/consents/grant', PatientController.grantConsent);
router.post('/:id/consents/revoke', PatientController.revokeConsent);
router.get('/:id/records', PatientController.getRecords);
router.get('/:id/audit-logs', PatientController.getAuditLogs);

module.exports = router;
