
import React from 'react';
import { Palette, ToggleLeft, ToggleRight, X } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
  showDevTools: boolean;
  setShowDevTools: (show: boolean) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, showDevTools, setShowDevTools }) => {
  return (
    <div className="bg-white border-l border-gray-200 w-80 h-full flex flex-col shadow-xl z-40 overflow-hidden font-sans">
      {/* HEADER */}
      <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" />
            Configuration
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white p-6">
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50/50">
            <div>
                <h3 className="text-sm font-semibold text-gray-900">Developer Tools</h3>
                <p className="text-xs text-gray-500 mt-1">Show Raw JSON & Debug Views</p>
            </div>
            <button 
                onClick={() => setShowDevTools(!showDevTools)}
                className="text-indigo-600 hover:text-indigo-700 transition-colors focus:outline-none"
            >
                {showDevTools ? (
                    <ToggleRight className="w-8 h-8 fill-indigo-100" />
                ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-300" />
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
