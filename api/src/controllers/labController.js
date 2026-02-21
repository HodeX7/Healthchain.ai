const FabricService = require('../services/fabricService');

const ORG_ROLE = 'lab';

const LabController = {
    viewLabOrders: async (req, res) => {
        try {
            // Lab Org views all orders assigned to them
            const mspId = require('../config/fabricConfig').getOrgDetails(ORG_ROLE).mspId;
            const result = await FabricService.query(ORG_ROLE, 'User1', 'viewLabOrders', mspId);
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    uploadReport: async (req, res) => {
        try {
            const { reportId, orderId, patientId, testName, testResults, documentUrl, docHash } = req.body;
            // testResults is expected to be a JSON object, so we stringify it
            const result = await FabricService.invoke(ORG_ROLE, 'User1', 'uploadLabReport', reportId, orderId, patientId, testName, JSON.stringify(testResults), documentUrl || '', docHash || '');
            res.status(201).json({ success: true, message: 'Lab report uploaded', data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = LabController;
