import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { DocumentService } from '../../services/api';

export function DocumentViewer({ documentUrl }) {
    const [isLoading, setIsLoading] = useState(false);

    // Only render if there's a valid Cloud Storage URI attached to this record
    if (!documentUrl || !documentUrl.startsWith('gs://')) {
        return null;
    }

    const handleViewClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsLoading(true);
        try {
            const data = await DocumentService.getDownloadUrl({ documentUrl });
            if (data && data.downloadUrl) {
                window.open(data.downloadUrl, '_blank');
            } else {
                alert("Could not generate a download URL for this document.");
            }
        } catch (error) {
            console.error("Error hydrating documentUrl:", error);
            alert("Failed to securely query Cloud Storage.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button 
           type="button"
           onClick={handleViewClick}
           disabled={isLoading}
           title={documentUrl} // Hover to see raw URI
           className="mt-2 inline-flex items-center text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
        >
            {isLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
            {isLoading ? 'Connecting to GCS...' : 'View Secure Attachment'}
        </button>
    );
}
