const FabricService = require('../services/fabricService');

const ORG_ROLE = 'pharmacy';

const PharmacyController = {
    viewPrescriptions: async (req, res) => {
        try {
            // Can filter by status, e.g., 'issued'
            const status = req.query.status || 'issued';
            const result = await FabricService.query(ORG_ROLE, 'User1', 'viewPrescriptions', status);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    fulfillPrescription: async (req, res) => {
        try {
            const { prescriptionId } = req.body;
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'fulfillPrescription', prescriptionId);
            res.status(200).json({ success: true, message: 'Prescription fulfilled', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = PharmacyController;
