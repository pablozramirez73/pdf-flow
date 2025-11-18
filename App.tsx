
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileUploader } from './components/FileUploader';
import { dbService } from './services/db.ts';
import { pdfService } from './services/pdfService.ts';
import { aiService } from './services/aiService.ts';
import { PDFMetadata, ViewState, ToastMessage } from './types';
import { Trash2, Download, File as FileIcon, ArrowRight, RefreshCw, Merge, CheckCircle, AlertCircle, Info, X, Loader2, Scissors, Sparkles, Bot, Globe, ExternalLink, Search, ArrowUpDown } from 'lucide-react';

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
  const [splitRange, setSplitRange] = useState('');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ text: string; sources: { title: string; uri: string }[] } | null>(null);
  const [mergeOrder, setMergeOrder] = useState<'asc' | 'desc'>('asc');

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

  const handleUploadFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      throw new Error(`File ${file.name} is not a PDF`);
    }
    await dbService.saveDocument(file);
  };

  const handleBatchComplete = async () => {
    addToast('success', 'Files processed successfully');
    await loadDocuments();
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
      const docsToMerge = documents
        .filter(d => selectedDocs.has(d.id))
        .sort((a, b) => {
           return mergeOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
        });
      
      const buffers: ArrayBuffer[] = [];
      for (const docMeta of docsToMerge) {
        const doc = await dbService.getDocument(docMeta.id);
        if (doc) buffers.push(doc.data);
      }

      const mergedBytes = await pdfService.mergePdfs(buffers);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const mergedFile = new File(
        [mergedBytes], 
        `merged-document-${timestamp}.pdf`, 
        { type: 'application/pdf' }
      );
      
      await dbService.saveDocument(mergedFile);
      await loadDocuments();
      setSelectedDocs(new Set());
      addToast('success', 'PDFs merged successfully! You can download it from the list.');
      setCurrentView(ViewState.DOCUMENTS);
    } catch (error) {
      console.error(error);
      addToast('error', error instanceof Error ? error.message : 'Failed to merge PDFs');
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
      addToast('error', error instanceof Error ? error.message : 'Failed to rotate PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const parsePageRange = (rangeStr: string): number[] => {
    const pages = new Set<number>();
    const parts = rangeStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (!part) continue;
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n));
        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          for (let i = start; i <= end; i++) pages.add(i - 1);
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page > 0) pages.add(page - 1);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleSplit = async () => {
    if (selectedDocs.size !== 1) {
      addToast('error', 'Please select exactly 1 document to split');
      return;
    }
    if (!splitRange.trim()) {
      addToast('error', 'Please enter a page range (e.g., 1-3)');
      return;
    }

    setIsProcessing(true);
    try {
      const indices = parsePageRange(splitRange);
      if (indices.length === 0) {
        throw new Error('Invalid page selection');
      }

      const id = Array.from(selectedDocs)[0];
      const doc = await dbService.getDocument(id);
      if (doc) {
        const extractedBytes = await pdfService.extractPages(doc.data, indices);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newFileName = `extracted-${doc.name.replace('.pdf', '')}-${timestamp}.pdf`;
        const newFile = new File([extractedBytes], newFileName, { type: 'application/pdf' });
        
        await dbService.saveDocument(newFile);
        await loadDocuments();
        
        setSelectedDocs(new Set());
        setSplitRange('');
        addToast('success', 'Pages extracted successfully!');
        setCurrentView(ViewState.DOCUMENTS);
      }
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to extract pages. Check page numbers.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyze = async () => {
    if (selectedDocs.size !== 1) {
      addToast('error', 'Please select exactly 1 document to analyze');
      return;
    }
    setIsProcessing(true);
    setAiSummary(null);
    try {
      const id = Array.from(selectedDocs)[0];
      const doc = await dbService.getDocument(id);
      if (doc) {
        const summary = await aiService.summarizeDocument(doc.data, doc.name);
        setAiSummary(summary);
        addToast('success', 'Document analysis complete!');
      }
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to analyze document');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWebSearch = async () => {
    if (!searchQuery.trim()) {
      addToast('error', 'Please enter a search query');
      return;
    }
    setIsProcessing(true);
    setSearchResult(null);
    try {
      const result = await aiService.searchWeb(searchQuery);
      setSearchResult(result);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedDocs(prev => {
      // For Rotate, Split, and AI views, we only allow single selection
      const singleSelectViews = [ViewState.ROTATE, ViewState.SPLIT, ViewState.AI_ASSISTANT];
      if (singleSelectViews.includes(currentView) && !prev.has(id)) {
        return new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Views ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
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
        <FileUploader onUploadFile={handleUploadFile} onBatchComplete={handleBatchComplete} />
      </div>
    </div>
  );

  const renderDocumentList = (selectionMode: boolean = false) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">
          {selectionMode ? 'Select Document' : 'All Documents'}
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
                {selectionMode ? '' : 'Type'}
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
                className={`
                  hover:bg-gray-50 transition-colors cursor-pointer
                  ${selectedDocs.has(doc.id) ? 'bg-blue-50/50' : ''}
                `}
                onClick={() => selectionMode && toggleSelection(doc.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  {selectionMode ? (
                    <div className={`
                      w-5 h-5 rounded border flex items-center justify-center transition-colors
                      ${selectedDocs.has(doc.id) ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}
                    `}>
                      {selectedDocs.has(doc.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                  ) : (
                    <FileIcon className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${selectedDocs.has(doc.id) ? 'text-primary' : 'text-gray-900'}`}>
                    {doc.name}
                  </div>
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
                        className="text-primary hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                        className="text-danger hover:text-red-700 transition-colors p-1 hover:bg-red-50 rounded"
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

  const renderMergeView = () => {
    const selectedList = documents
      .filter(d => selectedDocs.has(d.id))
      .sort((a, b) => {
        return mergeOrder === 'asc' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt;
      });

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Merge className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Merge PDFs</h2>
                <p className="text-gray-500 text-sm">Select documents below to combine them. They will be merged in the order displayed.</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setMergeOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                disabled={selectedDocs.size < 2}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 font-medium text-gray-600 bg-white transition-all
                  ${selectedDocs.size < 2 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 hover:text-gray-900 shadow-sm'}
                `}
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>Reverse Order</span>
              </button>

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
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Merge className="w-4 h-4" />}
                <span>{isProcessing ? 'Merging...' : 'Merge Selected'}</span>
              </button>
            </div>
          </div>

          {selectedList.length > 0 && (
            <div className="bg-purple-50/50 rounded-lg p-4 border border-purple-100">
              <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 bg-purple-200 text-purple-700 rounded-full text-xs">
                  {selectedList.length}
                </span>
                Selected Sequence:
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedList.map((doc, idx) => (
                  <div key={doc.id} className="group flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-purple-200 shadow-sm hover:border-purple-300 transition-colors">
                    <span className="text-xs font-bold text-purple-400">#{idx + 1}</span>
                    <span className="text-sm text-gray-700 truncate max-w-[150px]">{doc.name}</span>
                    <button 
                      onClick={() => toggleSelection(doc.id)}
                      className="text-gray-400 hover:text-red-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {renderDocumentList(true)}
      </div>
    );
  };

  const renderRotateView = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <RefreshCw className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Rotate PDF</h2>
              <p className="text-gray-500">Select a document to rotate it 90 degrees clockwise.</p>
            </div>
          </div>

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
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4" />}
            <span>{isProcessing ? 'Rotating...' : 'Rotate Selected'}</span>
          </button>
        </div>
      </div>
      {renderDocumentList(true)}
    </div>
  );

  const renderSplitView = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Scissors className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Split / Extract Pages</h2>
              <p className="text-gray-500 text-sm mt-1">Select a document and specify pages to create a new PDF.</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Ranges
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={splitRange}
                onChange={(e) => setSplitRange(e.target.value)}
                placeholder="e.g. 1, 3-5, 8"
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2.5 text-sm"
              />
              <button
                onClick={handleSplit}
                disabled={selectedDocs.size !== 1 || !splitRange || isProcessing}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all whitespace-nowrap
                  ${selectedDocs.size !== 1 || !splitRange || isProcessing 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 active:scale-95'}
                `}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Scissors className="w-4 h-4" />}
                <span>{isProcessing ? 'Extracting...' : 'Extract Pages'}</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Enter page numbers separated by commas. Use hyphens for ranges. Example: <strong>1, 3-5</strong> will extract pages 1, 3, 4, and 5.
            </p>
          </div>
        </div>
      </div>
      {renderDocumentList(true)}
    </div>
  );

  const renderAiView = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 rounded-lg">
              <Sparkles className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">AI Assistant</h2>
              <p className="text-gray-500">Select a document to generate a summary using Gemini AI.</p>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={selectedDocs.size !== 1 || isProcessing}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all
              ${selectedDocs.size !== 1 || isProcessing 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/30 active:scale-95'}
            `}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Bot className="w-4 h-4" />}
            <span>{isProcessing ? 'Analyzing...' : 'Generate Summary'}</span>
          </button>
        </div>
      </div>

      {aiSummary && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-teal-100 animate-fade-in-up">
           <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
             <Sparkles className="w-5 h-5 text-teal-500" />
             <h3 className="font-bold text-gray-800">AI Analysis Result</h3>
           </div>
           <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
             {aiSummary}
           </div>
        </div>
      )}

      {renderDocumentList(true)}
    </div>
  );

  const renderWebSearchView = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Globe className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Web Search</h2>
            <p className="text-gray-500 text-sm">Ask questions and get answers grounded in Google Search.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
              placeholder="Ask anything (e.g., 'Latest news on climate change')"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleWebSearch}
            disabled={!searchQuery.trim() || isProcessing}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all
              ${!searchQuery.trim() || isProcessing 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30 active:scale-95'}
            `}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </div>
      </div>

      {searchResult && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <Bot className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-gray-800">AI Answer</h3>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
            {searchResult.text}
          </div>

          {searchResult.sources && searchResult.sources.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Globe className="w-3 h-3" /> Sources
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchResult.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all group"
                  >
                    <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate group-hover:text-blue-600" title={source.title}>
                      {source.title}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderToasts = () => (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
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
            className={`${bgs[toast.type]} border flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] animate-slide-in-right pointer-events-auto`}
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
        setSelectedDocs(new Set());
        setSplitRange('');
        setAiSummary(null);
        setSearchResult(null);
      }} />
      
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {currentView === ViewState.DASHBOARD && renderDashboard()}
          {currentView === ViewState.DOCUMENTS && renderDocumentList(false)}
          {currentView === ViewState.MERGE && renderMergeView()}
          {currentView === ViewState.SPLIT && renderSplitView()}
          {currentView === ViewState.ROTATE && renderRotateView()}
          {currentView === ViewState.AI_ASSISTANT && renderAiView()}
          {currentView === ViewState.WEB_SEARCH && renderWebSearchView()}
        </div>
      </main>

      {renderToasts()}
    </div>
  );
}

export default App;
