import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileUploader } from './components/FileUploader';
import { dbService } from './services/db.ts';
import { pdfService } from './services/pdfService.ts';
import { PDFMetadata, ViewState, ToastMessage } from './types';
import { Trash2, Eye, Download, File as FileIcon, ArrowRight, RefreshCw, Merge, CheckCircle, AlertCircle, Info } from 'lucide-react';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [documents, setDocuments] = useState<PDFMetadata[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Initial Data Load
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await dbService.getAllMetadata();
      setDocuments(docs);
    } catch (error) {
      addToast('error', 'Failed to load documents from database');
    }
  };

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleUpload = async (files: FileList) => {
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        addToast('error', `${file.name} is not a PDF`);
        continue;
      }
      try {
        await dbService.saveDocument(file);
        successCount++;
      } catch (error) {
        addToast('error', `Failed to save ${file.name}`);
      }
    }
    if (successCount > 0) {
      addToast('success', `Successfully uploaded ${successCount} file(s)`);
      await loadDocuments();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await dbService.deleteDocument(id);
        setDocuments(prev => prev.filter(d => d.id !== id));
        setSelectedDocs(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        addToast('success', 'Document deleted');
      } catch (error) {
        addToast('error', 'Failed to delete document');
      }
    }
  };

  const handleDownload = async (id: string, name: string) => {
    try {
      const doc = await dbService.getDocument(id);
      if (doc) {
        const blob = new Blob([doc.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      addToast('error', 'Failed to download document');
    }
  };

  const handleMerge = async () => {
    if (selectedDocs.size < 2) {
      addToast('error', 'Please select at least 2 documents to merge');
      return;
    }
    setIsProcessing(true);
    try {
      // Fetch actual data for selected docs
      // Preserve order based on selection or list? 
      // For simplicity, we preserve list order filtered by selection
      const orderedIds = documents.filter(d => selectedDocs.has(d.id)).map(d => d.id);
      
      const buffers: ArrayBuffer[] = [];
      for (const id of orderedIds) {
        const doc = await dbService.getDocument(id);
        if (doc) buffers.push(doc.data);
      }

      const mergedBytes = await pdfService.mergePdfs(buffers);
      const mergedFile = new File([mergedBytes], `merged_workflow_${Date.now()}.pdf`, { type: 'application/pdf' });
      await dbService.saveDocument(mergedFile);
      await loadDocuments();
      setSelectedDocs(new Set());
      addToast('success', 'PDFs merged successfully!');
      setCurrentView(ViewState.DOCUMENTS);
    } catch (error) {
      console.error(error);
      addToast('error', 'Failed to merge PDFs');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = async () => {
    if (selectedDocs.size !== 1) {
      addToast('error', 'Please select exactly 1 document to rotate');
      return;
    }
    setIsProcessing(true);
    try {
      const id = Array.from(selectedDocs)[0];
      const doc = await dbService.getDocument(id);
      if (doc) {
        const rotatedBytes = await pdfService.rotatePdf(doc.data, 90);
        const rotatedFile = new File([rotatedBytes], `rotated_${doc.name}`, { type: 'application/pdf' });
        await dbService.saveDocument(rotatedFile);
        await loadDocuments();
        setSelectedDocs(new Set());
        addToast('success', 'PDF rotated 90° CW successfully!');
        setCurrentView(ViewState.DOCUMENTS);
      }
    } catch (error) {
      addToast('error', 'Failed to rotate PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Views ---

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium text-sm">Total Documents</h3>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileIcon className="w-5 h-5 text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{documents.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium text-sm">Recent Activity</h3>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {documents.length > 0 ? 'Active' : 'No activity'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium text-sm">Storage Used</h3>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Info className="w-5 h-5 text-warning" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {formatBytes(documents.reduce((acc, doc) => acc + doc.size, 0))}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Upload</h2>
        <FileUploader onUpload={handleUpload} />
      </div>
    </div>
  );

  const renderDocumentList = (selectionMode: boolean = false) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">
          {selectionMode ? 'Select Documents' : 'All Documents'}
        </h2>
        {selectionMode && (
           <div className="text-sm text-gray-500">
             {selectedDocs.size} selected
           </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                {selectionMode ? '#' : 'Type'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Uploaded</th>
              {!selectionMode && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No documents found. Upload some files to get started.
                </td>
              </tr>
            ) : documents.map((doc) => (
              <tr 
                key={doc.id} 
                className={`hover:bg-gray-50 transition-colors ${selectedDocs.has(doc.id) ? 'bg-blue-50' : ''}`}
                onClick={() => selectionMode && toggleSelection(doc.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  {selectionMode ? (
                    <input 
                      type="checkbox" 
                      checked={selectedDocs.has(doc.id)}
                      readOnly
                      className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                    />
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{formatBytes(doc.size)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{formatDate(doc.createdAt)}</div>
                </td>
                {!selectionMode && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDownload(doc.id, doc.name); }}
                        className="text-primary hover:text-blue-700 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                        className="text-danger hover:text-red-700 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMergeView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-purple-50 rounded-lg">
            <Merge className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Merge PDFs</h2>
            <p className="text-gray-500">Select multiple documents to combine them into a single PDF file.</p>
          </div>
        </div>
        
        <div className="flex justify-end mb-4">
             <button
              onClick={handleMerge}
              disabled={selectedDocs.size < 2 || isProcessing}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all
                ${selectedDocs.size < 2 || isProcessing 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/30 active:scale-95'}
              `}
            >
              {isProcessing ? 'Merging...' : 'Merge Selected Files'}
              <ArrowRight className="w-4 h-4" />
            </button>
        </div>
      </div>
      {renderDocumentList(true)}
    </div>
  );

  const renderRotateView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-orange-50 rounded-lg">
            <RefreshCw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Rotate PDF</h2>
            <p className="text-gray-500">Select a document to rotate it 90 degrees clockwise.</p>
          </div>
        </div>

         <div className="flex justify-end mb-4">
             <button
              onClick={handleRotate}
              disabled={selectedDocs.size !== 1 || isProcessing}
              className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all
                ${selectedDocs.size !== 1 || isProcessing 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/30 active:scale-95'}
              `}
            >
              {isProcessing ? 'Rotating...' : 'Rotate Selected File'}
              <RefreshCw className="w-4 h-4" />
            </button>
        </div>
      </div>
      {renderDocumentList(true)}
    </div>
  );

  // --- Toasts Render ---
  const renderToasts = () => (
    <div className="fixed bottom-6 right-6 z-50 space-y-3">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle className="w-5 h-5 text-success" />,
          error: <AlertCircle className="w-5 h-5 text-danger" />,
          info: <Info className="w-5 h-5 text-info" />,
        };
        const bgs = {
          success: 'bg-white border-success/20',
          error: 'bg-white border-danger/20',
          info: 'bg-white border-info/20',
        };

        return (
          <div 
            key={toast.id}
            className={`${bgs[toast.type]} border flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] animate-slide-in-right`}
          >
            {icons[toast.type]}
            <p className="text-gray-800 text-sm font-medium">{toast.message}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentView={currentView} onChangeView={(view) => {
        setCurrentView(view);
        setSelectedDocs(new Set()); // Reset selection on view change
      }} />
      
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {currentView === ViewState.DASHBOARD && renderDashboard()}
          {currentView === ViewState.DOCUMENTS && renderDocumentList(false)}
          {currentView === ViewState.MERGE && renderMergeView()}
          {currentView === ViewState.ROTATE && renderRotateView()}
        </div>
      </main>

      {renderToasts()}
    </div>
  );
}

export default App;