'use strict';

const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'healthchain-secure-docs';

class GCSService {
    static async generateUploadUrl(fileName, contentType) {
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.warn('GCP Credentials not found. Returning a mock URL for development.');
            return {
                uploadUrl: `https://mock-gcp-storage.local/upload/${fileName}`,
                documentUrl: `gs://${bucketName}/${fileName}`
            };
        }

        const options = {
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000,
            contentType: contentType,
        };

        const [url] = await storage
            .bucket(bucketName)
            .file(fileName)
            .getSignedUrl(options);

        return {
            uploadUrl: url,
            documentUrl: `gs://${bucketName}/${fileName}`
        };
    }

    static async generateDownloadUrl(documentUrl) {
        if (!documentUrl || !documentUrl.startsWith('gs://')) {
            return null;
        }

        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.warn('GCP Credentials not found. Returning a mock Download URL.');
            return `https://mock-gcp-storage.local/download?file=${documentUrl}`;
        }

        const pathParts = documentUrl.replace(`gs://${bucketName}/`, '');

        const options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
        };

        const [url] = await storage
            .bucket(bucketName)
            .file(pathParts)
            .getSignedUrl(options);

        return url;
    }
}

module.exports = GCSService;
