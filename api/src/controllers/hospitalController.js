const FabricService = require('../services/fabricService');

// Role context for gateway
const ORG_ROLE = 'hospitalA';

// Hospital routes must always use a hospital identity, never patient/lab/pharmacy/insurance
function getHospitalRole(req) {
    const role = req.headers['x-user-role'] || 'hospitalA';
    // Only allow hospital roles; default to hospitalA for anything else
    if (role.toLowerCase().startsWith('hospital')) return role;
    return ORG_ROLE;
}

const HospitalController = {
    requestAccess: async (req, res) => {
        const orgRole = getHospitalRole(req);
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
        const orgRole = getHospitalRole(req);
        try {
            // 1. Get PDC records (medical records + lab reports)
            const pdcRecords = await FabricService.query(orgRole, 'User1', 'queryPatientRecords', id);
            const allRecords = Array.isArray(pdcRecords) ? pdcRecords : [];

            // Run prescriptions + claims queries in parallel
            const [rxResult, claimsResult, auditResult] = await Promise.allSettled([
                FabricService.query('pharmacy', 'User1', 'viewPrescriptions', ''),
                FabricService.query('insurance', 'User1', 'viewClaims', ''),
                // Fetch patient audit logs to discover lab report IDs
                FabricService.query('patient', 'User1', 'getAuditLog', id),
            ]);

            // Merge prescriptions
            if (rxResult.status === 'fulfilled' && Array.isArray(rxResult.value)) {
                allRecords.push(...rxResult.value.filter(rx => rx.patientId === id));
            }

            // Merge claims
            if (claimsResult.status === 'fulfilled' && Array.isArray(claimsResult.value)) {
                allRecords.push(...claimsResult.value.filter(c => c.patientId === id));
            }

            // Extract lab report IDs from audit logs, then fetch each report in parallel
            if (auditResult.status === 'fulfilled' && Array.isArray(auditResult.value)) {
                const reportIds = auditResult.value
                    .map(log => (log.Record || log))
                    .filter(log => log.action === 'UPLOAD_LAB_REPORT' && log.reportId)
                    .map(log => log.reportId);
                
                if (reportIds.length > 0) {
                    const reportResults = await Promise.allSettled(
                        reportIds.map(rid => FabricService.query(orgRole, 'User1', 'getLabReport', rid))
                    );
                    for (const lr of reportResults) {
                        if (lr.status === 'fulfilled' && lr.value) {
                            if (!allRecords.find(r => (r.reportId || r.Record?.reportId) === lr.value.reportId)) {
                                allRecords.push(lr.value);
                            }
                        }
                    }
                }
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
        const orgRole = getHospitalRole(req);
        try {
            const { recordId, patientId, recordType, diagnosis, treatment, notes, documentUrl, docHash } = req.body;
            const result = await FabricService.invoke(orgRole, 'User1', 'createMedicalRecord', recordId || '', patientId || '', recordType || '', diagnosis || '', treatment || '', notes || '', documentUrl || '', docHash || '');
            res.status(201).json({ success: true, message: 'Medical record created', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    orderLabTest: async (req, res) => {
        const orgRole = getHospitalRole(req);
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
        const orgRole = getHospitalRole(req);
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
        const orgRole = getHospitalRole(req);
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
