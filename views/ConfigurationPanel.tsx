import React from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import SettingsPanel from '../components/Controls'; // Note: update the path to wherever your existing Controls are

interface ConfigurationPanelProps {
  onClose: () => void;
  figmaFileId: string;
  setFigmaFileId: (id: string) => void;
  imageFolder: string;
  setImageFolder: (folder: string) => void;
  availableProjects: {id: string, name: string}[];
  availableFolders: string[];
  handleRefreshSource: () => void;
  setError: (msg: string) => void;
  showDevTools: boolean;
  setShowDevTools: (v: boolean) => void;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ onClose, figmaFileId, setFigmaFileId, imageFolder, setImageFolder, availableProjects, availableFolders, handleRefreshSource, setError, showDevTools, setShowDevTools }) => {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 animate-slide-in flex flex-col border-l border-gray-200">
       <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
         <h3 className="font-bold text-gray-900">Configuration</h3>
         <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-1 rounded-full transition-colors">
           <X className="w-5 h-5"/>
         </button>
       </div>
       
       <div className="p-6 border-b border-gray-100 bg-gray-50/50">
         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Figma Source Project</label>
         {availableProjects.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading projects...
            </div>
         ) : (
            <select 
               value={figmaFileId} 
               onChange={(e) => setFigmaFileId(e.target.value)} 
               className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-4 shadow-sm bg-white"
             >
               <option value="" disabled>Select a project...</option>
               {availableProjects.map(p => (
                 <option key={p.id} value={p.id}>{p.name}</option>
               ))}
             </select>
         )}

         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Image Folder Name</label>
         {availableFolders.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading folders...
            </div>
         ) : (
            <select 
               value={imageFolder} 
               onChange={(e) => setImageFolder(e.target.value)} 
               className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-4 shadow-sm bg-white"
             >
               <option value="" disabled>Select a folder...</option>
               {availableFolders.map(folder => (
                 <option key={folder} value={folder}>{folder}</option>
               ))}
             </select>
         )}

         <button 
           onClick={() => {
             if (!figmaFileId.trim()) { setError("Figma File ID is required."); return; }
             if (!imageFolder.trim()) { setError("Image Folder Name is required."); return; }
             localStorage.setItem('figma_file_key', figmaFileId.trim());
             localStorage.setItem('image_folder_key', imageFolder.trim());
             onClose();
             handleRefreshSource();
           }}
           className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
         >
           <RefreshCw className="w-4 h-4" /> Save & Sync Project
         </button>
         <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
           These variables define which JSON manifest and Image source folder are pulled from your cloud storage.
         </p>
       </div>
       <div className="flex-1 overflow-auto relative">
         <SettingsPanel onClose={onClose} showDevTools={showDevTools} setShowDevTools={setShowDevTools} />
       </div>
    </div>
  );
};