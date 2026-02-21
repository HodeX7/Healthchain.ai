const FabricService = require('../services/fabricService');

const ORG_ROLE = 'insurance';

const InsuranceController = {
    viewClaims: async (req, res) => {
        try {
            // Can filter by status, e.g., 'submitted'
            const status = req.query.status || 'submitted';
            const result = await FabricService.query(ORG_ROLE, 'User1', 'viewClaims', status);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    approveClaim: async (req, res) => {
        try {
            const { claimId, approvedAmount, remarks } = req.body;
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'approveClaim', claimId, String(approvedAmount), remarks || '');
            res.status(200).json({ success: true, message: 'Claim approved', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = InsuranceController;
