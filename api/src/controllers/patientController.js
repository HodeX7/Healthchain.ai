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
            
            // 1. Get PDC records (medical records + lab reports from private data)
            const pdcRecords = await FabricService.query(ORG_ROLE, 'User1', 'getMyMedicalRecords', id);
            const allRecords = Array.isArray(pdcRecords) ? pdcRecords : [];

            // 2. Get prescriptions from public state
            try {
                const prescriptions = await FabricService.query('pharmacy', 'User1', 'viewPrescriptions', '');
                if (Array.isArray(prescriptions)) {
                    const patientRx = prescriptions.filter(rx => rx.patientId === id);
                    allRecords.push(...patientRx);
                }
            } catch (e) {
                console.log('Could not fetch prescriptions for patient:', e.message);
            }

            // 3. Get insurance claims from public state
            try {
                const claims = await FabricService.query('insurance', 'User1', 'viewClaims', '');
                if (Array.isArray(claims)) {
                    const patientClaims = claims.filter(c => c.patientId === id);
                    allRecords.push(...patientClaims);
                }
            } catch (e) {
                console.log('Could not fetch claims for patient:', e.message);
            }

            // 4. Probe for lab reports directly (getLabReport has no MSP restriction)
            try {
                for (let i = 1; i <= 50; i++) {
                    const reportId = `REP${String(i).padStart(3, '0')}`;
                    try {
                        const report = await FabricService.query(ORG_ROLE, 'User1', 'getLabReport', reportId);
                        if (report && report.patientId === id) {
                            if (!allRecords.find(r => (r.reportId || r.Record?.reportId) === reportId)) {
                                allRecords.push(report);
                            }
                        }
                    } catch (e) {
                        // Report doesn't exist, continue
                    }
                }
            } catch (e) {
                console.log('Could not probe lab reports for patient:', e.message);
            }

            res.json({ success: true, data: allRecords });
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
    },

    getConsents: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await FabricService.query(ORG_ROLE, 'User1', 'getMyConsents', id);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    getAccessRequests: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await FabricService.query(ORG_ROLE, 'User1', 'getAccessRequests', id);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    rejectAccessRequest: async (req, res) => {
        try {
            const { id } = req.params;
            const { hospitalMsp } = req.body;
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'rejectAccessRequest', id, hospitalMsp);
            res.json({ success: true, message: `Access request from ${hospitalMsp} rejected`, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = PatientController;
