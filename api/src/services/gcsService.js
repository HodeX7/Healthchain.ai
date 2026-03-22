'use strict';

const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'healthchain-secure-docs';

class GCSService {
    static async generateUploadUrl(fileName, contentType) {


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
