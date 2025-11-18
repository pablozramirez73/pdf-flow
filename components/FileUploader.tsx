import React, { useRef, useState } from 'react';
import { UploadCloud, File as FileIcon, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (files: FileList) => Promise<void>;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = async (files: FileList) => {
    setIsUploading(true);
    try {
      await onUpload(files);
    } finally {
      setIsUploading(false);
    }
  };

  return (
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
      
      {isUploading ? (
        <div className="flex flex-col items-center animate-pulse">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-3" />
          <p className="text-gray-600 font-medium">Processing files...</p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};