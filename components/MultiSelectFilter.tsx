import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedSet: Set<string>;
  onToggle: (val: string) => void;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ label, options, selectedSet, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
          selectedSet.size > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>{label}</span>
        {selectedSet.size > 0 && (
          <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">{selectedSet.size}</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2.5 text-gray-400" />
              <input 
                type="text" 
                placeholder={`Search ${label}...`}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-[10px] text-gray-400">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md flex items-center justify-between transition-colors ${selectedSet.has(opt) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
                >
                  <span className="truncate pr-2" title={opt}>{opt}</span>
                  {selectedSet.has(opt) && <Check className="w-3 h-3 text-indigo-600 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};