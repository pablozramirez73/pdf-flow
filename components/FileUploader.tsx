import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, File as FileIcon, Loader2, CheckCircle, XCircle, X, Trash2 } from 'lucide-react';

interface FileUploaderProps {
  onUploadFile: (file: File) => Promise<void>;
  onBatchComplete: () => void;
}

interface UploadItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  errorMessage?: string;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileUploader: React.FC<FileUploaderProps> = ({ onUploadFile, onBatchComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Processing queue effect
  useEffect(() => {
    const pending = uploads.find(u => u.status === 'pending');
    const uploading = uploads.find(u => u.status === 'uploading');
    
    // Process one at a time
    if (pending && !uploading) {
      processUpload(pending);
    } else if (!pending && !uploading && uploads.some(u => u.status === 'completed' || u.status === 'error')) {
        // Check if we just finished a batch
        const hasRecentActivity = uploads.some(u => u.status !== 'pending');
        if (hasRecentActivity) {
             // We could trigger batch complete here if we tracked "batch sessions",
             // but for now we assume the parent might want to know when *any* sequence finishes.
             // To avoid infinite loops or excessive calls, we might rely on the individual process completion,
             // but the requirement is to notify when the batch is done.
             // We'll handle the callback invocation in the processUpload function's completion block.
        }
    }
  }, [uploads]);

  const processUpload = async (item: UploadItem) => {
    // Update status to uploading
    setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading', progress: 0 } : u));

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploads(prev => prev.map(u => {
        if (u.id === item.id && u.status === 'uploading') {
          const nextProgress = u.progress + Math.random() * 10;
          return { ...u, progress: Math.min(nextProgress, 90) };
        }
        return u;
      }));
    }, 200);

    try {
      await onUploadFile(item.file);
      
      clearInterval(progressInterval);
      setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'completed', progress: 100 } : u));
    } catch (error) {
      clearInterval(progressInterval);
      setUploads(prev => prev.map(u => u.id === item.id ? { 
        ...u, 
        status: 'error', 
        progress: 0, 
        errorMessage: error instanceof Error ? error.message : 'Upload failed' 
      } : u));
    } finally {
        // Check if this was the last pending item
        setUploads(currentUploads => {
            const remainingPending = currentUploads.filter(u => u.status === 'pending' && u.id !== item.id);
            if (remainingPending.length === 0) {
                // Defer the callback to avoid state update conflicts
                setTimeout(onBatchComplete, 100);
            }
            return currentUploads;
        });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addFiles = (files: FileList) => {
    const newUploads: UploadItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0
    }));
    setUploads(prev => [...prev, ...newUploads]);
  };

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const clearCompleted = () => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'));
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative group cursor-pointer
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200
          flex flex-col items-center justify-center min-h-[200px]
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-[1.01]' 
            : 'border-gray-300 hover:border-primary hover:bg-gray-50 bg-white'
          }
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf"
          multiple
        />
        
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
          ${isDragging ? 'bg-primary/20 text-primary' : 'bg-gray-100 text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'}
        `}>
          <UploadCloud className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">
          Drop PDF files here
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse from your computer
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          <FileIcon className="w-3 h-3" />
          <span>Supports PDF up to 50MB</span>
        </div>
      </div>

      {/* Upload List */}
      {uploads.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm animate-fade-in">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h4 className="font-medium text-gray-700 text-sm">Uploads</h4>
            {uploads.some(u => u.status === 'completed') && (
              <button 
                onClick={clearCompleted}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear Completed
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
            {uploads.map((item) => (
              <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-5 h-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[200px] sm:max-w-xs">
                      {item.file.name}
                    </p>
                    <span className="text-xs text-gray-500">{formatBytes(item.file.size)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 rounded-full ${
                          item.status === 'error' ? 'bg-red-500' : 
                          item.status === 'completed' ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-16 text-right ${
                       item.status === 'error' ? 'text-red-500' : 
                       item.status === 'completed' ? 'text-green-600' : 'text-primary'
                    }`}>
                      {item.status === 'error' ? 'Failed' : 
                       item.status === 'completed' ? 'Done' : 
                       item.status === 'pending' ? 'Pending' :
                       `${Math.round(item.progress)}%`}
                    </span>
                  </div>
                  {item.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{item.errorMessage}</p>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {item.status === 'uploading' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  {item.status === 'completed' && <CheckCircle className="w-5 h-5 text-success" />}
                  {item.status === 'error' && <XCircle className="w-5 h-5 text-danger" />}
                  {item.status === 'pending' && (
                    <button onClick={() => removeUpload(item.id)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
