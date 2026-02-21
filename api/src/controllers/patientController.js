const FabricService = require('../services/fabricService');

// Role context for gateway
const ORG_ROLE = 'patient';

const PatientController = {
    register: async (req, res) => {
        try {
            const { id, firstName, lastName, dob, bloodGroup, email, phone } = req.body;
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'registerPatient', id, firstName, lastName, dob || '', bloodGroup || '', email || '', phone || '');
            res.status(201).json({ success: true, message: 'Patient registered successfully', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    get: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await FabricService.query(ORG_ROLE, 'User1', 'getPatient', id);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    grantConsent: async (req, res) => {
        try {
            const { id } = req.params;
            const { hospitalMsp, collections } = req.body;
            // Collections expected as array: ["collectionMedicalRecords_HospitalA", ...]
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'grantAccess', id, hospitalMsp, JSON.stringify(collections));
            res.json({ success: true, message: `Access granted to ${hospitalMsp}`, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    revokeConsent: async (req, res) => {
        try {
            const { id } = req.params;
            const { hospitalMsp } = req.body;
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'revokeAccess', id, hospitalMsp);
            res.json({ success: true, message: `Access revoked from ${hospitalMsp}`, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getRecords: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await FabricService.query(ORG_ROLE, 'User1', 'getMyMedicalRecords', id);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getAuditLogs: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await FabricService.query(ORG_ROLE, 'User1', 'getAuditLog', id);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = PatientController;
