import React from 'react';
import { X } from 'lucide-react';

interface ActiveFiltersChipsProps {
  filters: Array<{ id: string, label: string, type: string }>;
  onRemove: (id: string, type: string) => void;
  onClearAll: () => void;
}

export const ActiveFiltersChips: React.FC<ActiveFiltersChipsProps> = ({ filters, onRemove, onClearAll }) => {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 pb-1 border-t border-gray-100 mt-2">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mr-1">Active:</span>
      {filters.map((f) => (
        <span key={`${f.type}-${f.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">
          <span className="opacity-60 uppercase tracking-wider mr-1">{f.type}:</span>
          <span className="max-w-[120px] truncate" title={f.label}>{f.label}</span>
          <button 
            onClick={() => onRemove(f.id, f.type)}
            className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors ml-1"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button 
        onClick={onClearAll}
        className="text-[10px] text-gray-400 hover:text-red-600 underline ml-2 transition-colors"
      >
        Clear all
      </button>
    </div>
  );
};