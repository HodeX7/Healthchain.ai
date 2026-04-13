import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { DocumentService } from '../../services/api';
import { Button } from './Button';

export function DocumentUploader({ onUploadComplete, onError }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [successStatus, setSuccessStatus] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setSuccessStatus(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setSuccessStatus(false);
    onUploadComplete(null); // Clear parent state
  };

  const handleUpload = async (e) => {
    e.preventDefault(); // Prevent form submission if inside a form
    if (!file) return;
    
    setIsUploading(true);
    try {
      const documentUrl = await DocumentService.uploadFileToGCS(file);
      setSuccessStatus(true);
      onUploadComplete(documentUrl);
    } catch (error) {
      console.error(error);
      if (onError) onError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (successStatus) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center text-green-700">
          <CheckCircle className="w-5 h-5 mr-2" />
          <span className="text-sm font-medium border-b border-transparent truncate max-w-[200px]" title={file.name}>
            {file.name} attached!
          </span>
        </div>
        <button type="button" onClick={handleClear} className="text-green-600 hover:text-green-800 focus:outline-none">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-slate-300 bg-slate-50 rounded-lg p-4">
      {!file ? (
        <div className="text-center">
          <label className="cursor-pointer flex flex-col items-center justify-center h-20 w-full focus:outline-none">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-sm text-slate-500 font-medium hover:text-brand-600 transition-colors">
              Click to select PDF attachment (Optional)
            </span>
            <input 
              type="file" 
              className="hidden" 
              accept="application/pdf,image/*" 
              onChange={handleFileChange} 
            />
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded shadow-sm">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="bg-brand-100 text-brand-600 p-2 rounded">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-slate-700 truncate" title={file.name}>{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
             {!isUploading && (
                <button type="button" onClick={handleClear} className="p-1 text-slate-400 hover:text-red-500 focus:outline-none" title="Remove File">
                  <X className="w-4 h-4" />
                </button>
             )}
             <Button type="button" onClick={handleUpload} disabled={isUploading} className="text-xs px-3 py-1.5 h-auto">
               {isUploading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading...</> : 'Upload & Attach'}
             </Button>
          </div>
        </div>
      )}
    </div>
  );
}
