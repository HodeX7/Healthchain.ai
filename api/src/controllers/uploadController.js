'use strict';

const GCSService = require('../services/gcsService');

class UploadController {
    static async getSignedUploadUrl(req, res) {
        try {
            const { fileName, contentType } = req.body;

            if (!fileName || !contentType) {
                return res.status(400).json({
                    success: false,
                    error: 'fileName and contentType are required'
                });
            }

            const { uploadUrl, documentUrl } = await GCSService.generateUploadUrl(fileName, contentType);

            res.status(200).json({
                success: true,
                message: 'Signed URL generated. Use this URL to PUT the file directly to Google Cloud.',
                uploadUrl,
                documentUrl
            });

        } catch (error) {
            console.error(`Error generating signed URL: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = UploadController;
