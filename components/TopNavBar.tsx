import React from 'react';
import { Loader2, Archive, AlertTriangle, Play } from 'lucide-react';

interface TopNavBarProps {
  activeView: string;
  generatedCount: number;
  selectedGeneratedCount: number;
  isGenerating: boolean;
  generationCount: number;
  isHighVolume: boolean;
  isDownloading: boolean;
  onGenerate: () => void;
  onDownloadAll: () => void;
  onDownloadSelected: () => void;
  onBulkSelectMsg?: (b: boolean) => void;
  onBulkSelectImg?: (b: boolean) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({ activeView, generatedCount, selectedGeneratedCount, isGenerating, generationCount, isHighVolume, isDownloading, onGenerate, onDownloadAll, onDownloadSelected, onBulkSelectMsg, onBulkSelectImg }) => {
  const getPageTitle = () => {
    switch (activeView) {
      case 'list': return 'Messaging';
      case 'images': return 'Images';
      case 'json': return 'System Manifest (JSON)';
      case 'json_images': return 'Raw Images Payload (Debug)';
      case 'rendered': return 'Templates'; 
      case 'generated': return 'Generation Gallery';
      default: return 'ActivImpact';
    }
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
        {activeView === 'generated' && generatedCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-100 shadow-sm">{generatedCount}</span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {activeView === 'list' && onBulkSelectMsg && (
          <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
            <button onClick={() => onBulkSelectMsg(true)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-200 transition-colors">Select All</button>
            <button onClick={() => onBulkSelectMsg(false)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">Deselect All</button>
          </div>
        )}
        {activeView === 'images' && onBulkSelectImg && (
          <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
            <button onClick={() => onBulkSelectImg(true)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-200 transition-colors">Select All</button>
            <button onClick={() => onBulkSelectImg(false)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">Deselect All</button>
          </div>
        )}
        {activeView === 'generated' && (
          <div className="flex items-center gap-2">
            {selectedGeneratedCount > 0 && (
              <button onClick={onDownloadSelected} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50">
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Download Selected ({selectedGeneratedCount})
              </button>
            )}
            <button onClick={onDownloadAll} disabled={generatedCount === 0 || isDownloading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-indigo-700 hover:text-white transition-colors shadow-sm disabled:opacity-50">
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Download All
            </button>
          </div>
        )}
        {['list', 'images', 'rendered'].includes(activeView) && (
          <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
            {isHighVolume && (
              <div className="hidden xl:flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 animate-pulse"> <AlertTriangle className="w-3.5 h-3.5" /> High volume (100+) </div>
            )}
            <button onClick={onGenerate} disabled={isGenerating || generationCount === 0} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isHighVolume ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isGenerating ? 'Generating...' : `Generate (${generationCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};