import React from 'react';
import { LayoutDashboard, Files, Merge, RefreshCw, FileText } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: ViewState.DOCUMENTS, label: 'My Documents', icon: Files },
    { id: ViewState.MERGE, label: 'Merge PDFs', icon: Merge },
    { id: ViewState.ROTATE, label: 'Rotate PDFs', icon: RefreshCw },
  ];

  return (
    <div className="w-64 bg-dark text-white flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 border-b border-gray-700 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <FileText className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">PDFFlow</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400">
          <p className="font-semibold text-gray-300 mb-1">Local Database Active</p>
          <p>Documents are stored securely in your browser's IndexedDB.</p>
        </div>
      </div>
    </div>
  );
};