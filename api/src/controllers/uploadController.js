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
    static async getSignedDownloadUrl(req, res) {
        try {
            const { documentUrl } = req.body;

            if (!documentUrl || !documentUrl.startsWith('gs://')) {
                return res.status(400).json({ success: false, error: 'Valid GCS documentUrl string is required' });
            }

            const downloadUrl = await GCSService.generateDownloadUrl(documentUrl);

            res.status(200).json({ success: true, downloadUrl });
        } catch (error) {
            console.error(`Error generating download URL: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = UploadController;
