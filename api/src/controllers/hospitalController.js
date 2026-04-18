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
            // 1. Get PDC records (medical records + lab reports)
            const pdcRecords = await FabricService.query(orgRole, 'User1', 'queryPatientRecords', id);
            const allRecords = Array.isArray(pdcRecords) ? pdcRecords : [];

            // 2. Get prescriptions from public state (use pharmacy context since viewPrescriptions requires PharmacyOrgMSP)
            try {
                const prescriptions = await FabricService.query('pharmacy', 'User1', 'viewPrescriptions', '');
                if (Array.isArray(prescriptions)) {
                    const patientRx = prescriptions.filter(rx => rx.patientId === id);
                    allRecords.push(...patientRx);
                }
            } catch (e) {
                console.log('Could not fetch prescriptions:', e.message);
            }

            // 3. Get insurance claims from public state (use insurance context since viewClaims requires InsuranceOrgMSP)
            try {
                const claims = await FabricService.query('insurance', 'User1', 'viewClaims', '');
                if (Array.isArray(claims)) {
                    const patientClaims = claims.filter(c => c.patientId === id);
                    allRecords.push(...patientClaims);
                }
            } catch (e) {
                console.log('Could not fetch claims:', e.message);
            }

            // 4. Probe for lab reports directly (getLabReport has no MSP restriction)
            // Lab reports are in PDCs - the CouchDB query often misses them, so probe by ID
            try {
                for (let i = 1; i <= 50; i++) {
                    const reportId = `REP${String(i).padStart(3, '0')}`;
                    try {
                        const report = await FabricService.query(orgRole, 'User1', 'getLabReport', reportId);
                        if (report && report.patientId === id) {
                            // Avoid duplicates
                            if (!allRecords.find(r => (r.reportId || r.Record?.reportId) === reportId)) {
                                allRecords.push(report);
                            }
                        }
                    } catch (e) {
                        // Report doesn't exist, continue
                    }
                }
            } catch (e) {
                console.log('Could not probe lab reports:', e.message);
            }

            res.json({ success: true, data: allRecords });
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
            const { prescriptionId, patientId, medications, diagnosis, validUntil } = req.body;
            // medications expected as an array of objects
            const result = await FabricService.invoke(orgRole, 'User1', 'issuePrescription', prescriptionId, patientId, JSON.stringify(medications), diagnosis, validUntil);
            res.status(201).json({ success: true, message: 'Prescription issued', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    submitInsuranceClaim: async (req, res) => {
        const orgRole = req.headers['x-user-role'] || 'hospitalA';
        try {
            const { claimId, patientId, serviceDate, procedures, totalAmount } = req.body;
            // procedures expected as an array of objects
            const result = await FabricService.invoke(orgRole, 'User1', 'submitInsuranceClaim', claimId, patientId, serviceDate, JSON.stringify(procedures), String(totalAmount));
            res.status(201).json({ success: true, message: 'Insurance claim submitted', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = HospitalController;
