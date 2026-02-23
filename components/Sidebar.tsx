import React from 'react';
import { MessageSquare, Image as ImageIcon, Eye, Grid, Loader2, CheckCircle2, FileJson, Database, Settings } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: any) => void;
  showDevTools: boolean;
  onOpenSettings: () => void;
  isGenerating: boolean;
  generatedImageCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, showDevTools, onOpenSettings, isGenerating, generatedImageCount }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-20 shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <img src="https://rorwebsite.sfo3.cdn.digitaloceanspaces.com/aimedia/activimpact-logo.png" alt="ActivImpact" className="h-8 w-auto object-contain" />
      </div>
      <nav className="p-4 space-y-1 flex-1">
        <button onClick={() => setActiveView('list')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
          <MessageSquare className="w-4 h-4" /> Messaging
        </button>
        <button onClick={() => setActiveView('images')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'images' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
          <ImageIcon className="w-4 h-4" /> Images
        </button>
        <button onClick={() => setActiveView('rendered')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'rendered' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
          <Eye className="w-4 h-4" /> Templates
        </button>
        <button onClick={() => setActiveView('generated')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'generated' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : generatedImageCount > 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Grid className="w-4 h-4" />}
          Generation Gallery
          {generatedImageCount > 0 && <span className="ml-auto bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-[10px]">{generatedImageCount}</span>}
        </button>
        {showDevTools && (
          <>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3 mt-6">Developer</div>
            <button onClick={() => setActiveView('json')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'json' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}> <FileJson className="w-4 h-4" /> Raw Manifest Data </button>
            <button onClick={() => setActiveView('json_images')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'json_images' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}> <Database className="w-4 h-4" /> Raw Images Data </button>
          </>
        )}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <button onClick={onOpenSettings} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 text-sm font-medium transition-all"> <Settings className="w-4 h-4" /> Configuration </button>
      </div>
    </div>
  );
};