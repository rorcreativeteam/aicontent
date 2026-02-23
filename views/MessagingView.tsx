import React, { useMemo, useState } from 'react';
import { Layers, Layout, Check, RefreshCw } from 'lucide-react';
import { ComponentMetadata } from '../types';

interface MessagingViewProps {
  components: ComponentMetadata[];
  selectedComponentIds: Set<string>;
  toggleComponentSelection: (id: string) => void;
  setPreviewItem: (item: any) => void;
  isLoadingAll: boolean;
  handleBulkSelect: (select: boolean) => void; 
}

export const MessagingView: React.FC<MessagingViewProps> = ({ 
    components, selectedComponentIds, toggleComponentSelection, setPreviewItem, isLoadingAll 
}) => {
  const [selectedSet, setSelectedSet] = useState<string>('all');

  const componentSets = useMemo(() => {
    const sets = new Set<string>();
    components.forEach(c => {
      if (c.componentSetName && !c.name.includes("Generic") && !c.componentSetName.includes("Disclaimer") && !c.componentSetName.includes("Offer_Wide")) {
        sets.add(c.componentSetName);
      }
    });
    return Array.from(sets).sort();
  }, [components]);

  const filteredComponents = useMemo(() => {
    const visibleComponents = components.filter(c =>
      !c.name.includes("Generic") &&
      !(c.componentSetName && c.componentSetName.includes("Disclaimer")) &&
      !(c.componentSetName && c.componentSetName.includes("Offer_Wide"))
    );
    if (selectedSet === 'all') return visibleComponents;
    return visibleComponents.filter(c => c.componentSetName === selectedSet);
  }, [components, selectedSet]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {components.length > 0 && (
        <div className="w-64 bg-gray-50/50 border-r border-gray-200 overflow-y-auto custom-scrollbar flex-shrink-0">
          <div className="p-4">
            <nav className="space-y-1">
              <button onClick={() => setSelectedSet('all')} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${selectedSet === 'all' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}> <Layers className="w-3.5 h-3.5" /> All </button>
              <div className="pt-2"></div>
              {componentSets.map(set => (
                <button key={set} onClick={() => setSelectedSet(set)} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${selectedSet === set ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}> <Layout className="w-3.5 h-3.5" /> {set} </button>
              ))}
            </nav>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-8">
        {isLoadingAll ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500"> <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" /> <p>Scanning Library...</p> </div>
        ) : components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl"> <p>No components found.</p> </div>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
            {filteredComponents.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">No components found in this set.</div>
            ) : filteredComponents.map((comp) => {
              const isSelected = selectedComponentIds.has(comp.id);
              return (
                <div key={comp.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow group flex flex-col h-full relative ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200'}`} title={comp.name}>
                  <div onClick={(e) => { e.stopPropagation(); toggleComponentSelection(comp.id); }} className="absolute top-2 left-2 z-10 cursor-pointer">
                    <div className={`w-5 h-5 rounded border shadow-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300 hover:border-gray-400'}`}> {isSelected && <Check className="w-3.5 h-3.5 text-white" />} </div>
                  </div>
                  <div className="aspect-square bg-gray-400 p-2 flex items-center justify-center relative cursor-zoom-in overflow-hidden" onClick={() => setPreviewItem(comp)}>
                    {comp.thumbnailUrl ? (<img src={comp.thumbnailUrl} alt={comp.name} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />) : (<div className="text-gray-300 text-[10px]">No Preview</div>)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
};