const FabricService = require('../services/fabricService');

// Role context for gateway (Usually from JWT, hardcoded for HospitalA here for simplicity, but in a real app would be dynamic based on the logged-in hospital user)
const ORG_ROLE = 'hospitalA';

const HospitalController = {
    requestAccess: async (req, res) => {
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const { patientId } = req.body;
            const result = await FabricService.invoke(orgRole, 'User1', 'requestAccess', patientId);
            res.json({ success: true, message: 'Access request submitted', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getPatientRecords: async (req, res) => {
        const { id } = req.params;
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const result = await FabricService.query(orgRole, 'User1', 'queryPatientRecords', id);
            res.json({ success: true, data: result });
        } catch (error) {
            if (error.message && error.message.includes('No active consent')) {
                 try {
                     await FabricService.invoke(orgRole, 'User1', 'requestAccess', id);
                     return res.status(202).json({ success: false, status: 'access_pending', message: 'Access requested automatically. Waiting for patient approval.' });
                 } catch (reqErr) {
                     return res.status(500).json({ success: false, error: reqErr.message });
                 }
            }
            res.status(500).json({ success: false, error: error.message });
        }
    },

    createMedicalRecord: async (req, res) => {
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const { recordId, patientId, recordType, diagnosis, treatment, notes, documentUrl, docHash } = req.body;
            const result = await FabricService.invoke(orgRole, 'User1', 'createMedicalRecord', recordId || '', patientId || '', recordType || '', diagnosis || '', treatment || '', notes || '', documentUrl || '', docHash || '');
            res.status(201).json({ success: true, message: 'Medical record created', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    orderLabTest: async (req, res) => {
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const { orderId, patientId, testName, testType, priority, comments, instructions } = req.body;
            const resolvedTestName = testName || testType || '';
            const result = await FabricService.invoke(orgRole, 'User1', 'orderLabTest', orderId, patientId, resolvedTestName, priority || 'normal', comments || instructions || '');
            res.status(201).json({ success: true, message: 'Lab test ordered', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    issuePrescription: async (req, res) => {
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const { prescriptionId, patientId, medications, diagnosis, validUntil, documentUrl, docHash } = req.body;
            // medications expected as an array of objects
            const result = await FabricService.invoke(orgRole, 'User1', 'issuePrescription', prescriptionId, patientId, JSON.stringify(medications), diagnosis || '', validUntil || '', documentUrl || '', docHash || '');
            res.status(201).json({ success: true, message: 'Prescription issued', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    submitInsuranceClaim: async (req, res) => {
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const { claimId, patientId, serviceDate, procedures, totalAmount, documentUrl, docHash } = req.body;
            // procedures expected as an array of objects
            const result = await FabricService.invoke(orgRole, 'User1', 'submitInsuranceClaim', claimId, patientId, serviceDate, JSON.stringify(procedures), String(totalAmount), documentUrl || '', docHash || '');
            res.status(201).json({ success: true, message: 'Insurance claim submitted', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = HospitalController;
