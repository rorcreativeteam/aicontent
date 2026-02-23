import React, { useMemo, useState } from 'react';
import { Sparkles, Check, Download, Maximize2, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { ComponentMetadata } from '../types';
import { GeneratedImage, getDownloadFilename } from '../utils/helpers';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import { ActiveFiltersChips } from '../components/ActiveFiltersChips';

interface GenerationGalleryViewProps {
  generatedImages: GeneratedImage[];
  setGeneratedImages: React.Dispatch<React.SetStateAction<GeneratedImage[]>>;
  components: ComponentMetadata[];
  selectedGeneratedImageIds: Set<string>;
  toggleGeneratedImageSelection: (id: string) => void;
  setPreviewItem: (item: any) => void;
  setActiveView: (v: string) => void;
}

const ITEMS_PER_PAGE = 30;

export const GenerationGalleryView: React.FC<GenerationGalleryViewProps> = ({ generatedImages, setGeneratedImages, components, selectedGeneratedImageIds, toggleGeneratedImageSelection, setPreviewItem, setActiveView }) => {
  const [generatedFilter, setGeneratedFilter] = useState<Set<string>>(new Set());
  const [generatedTemplateFilter, setGeneratedTemplateFilter] = useState<Set<string>>(new Set());
  const [generatedFolderFilter, setGeneratedFolderFilter] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const generatedFilterData = useMemo(() => {
    const groups: Record<string, { total: number, variants: Map<string, number> }> = {};
    generatedImages.forEach(img => {
      img.componentNames.forEach(name => {
        const comp = components.find(c => c.name === name);
        const setName = comp?.componentSetName;
        if (setName && setName.includes("Disclaimer")) return; 
        if (setName) {
          if (!groups[setName]) groups[setName] = { total: 0, variants: new Map() };
          groups[setName].total++;
          groups[setName].variants.set(name, (groups[setName].variants.get(name) || 0) + 1);
        }
      });
    });
    return { groups };
  }, [generatedImages, components]);
  
  const uniqueTemplates = useMemo(() => Array.from(new Set(generatedImages.map(img => img.templateName))).sort(), [generatedImages]);
  const uniqueGeneratedFolders = useMemo(() => Array.from(new Set(generatedImages.filter(img => img.folder).map(img => img.folder as string))).sort(), [generatedImages]);

  const displayGeneratedImages = useMemo(() => {
    let result = generatedImages;
    if (generatedTemplateFilter.size > 0) result = result.filter(img => generatedTemplateFilter.has(img.templateName));
    if (generatedFolderFilter.size > 0) result = result.filter(img => img.folder && generatedFolderFilter.has(img.folder));
    if (generatedFilter.size > 0) result = result.filter(img => img.componentNames.some(name => generatedFilter.has(name)));
    return result;
  }, [generatedImages, generatedFilter, generatedTemplateFilter, generatedFolderFilter]);

  const totalPages = Math.ceil(displayGeneratedImages.length / ITEMS_PER_PAGE);
  const paginatedImages = useMemo(() => displayGeneratedImages.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [displayGeneratedImages, currentPage]);

  const activeFiltersList = useMemo(() => {
    const list: { id: string, label: string, type: string }[] = [];
    generatedTemplateFilter.forEach(t => list.push({ id: t, label: t, type: 'Template' }));
    generatedFolderFilter.forEach(f => list.push({ id: f, label: f, type: 'Folder' }));
    generatedFilter.forEach(c => list.push({ id: c, label: c, type: 'Variant' }));
    return list;
  }, [generatedTemplateFilter, generatedFolderFilter, generatedFilter]);

  const handleRemoveFilter = (id: string, type: string) => {
    if (type === 'Template') { const ns = new Set(generatedTemplateFilter); ns.delete(id); setGeneratedTemplateFilter(ns); }
    if (type === 'Folder') { const ns = new Set(generatedFolderFilter); ns.delete(id); setGeneratedFolderFilter(ns); }
    if (type === 'Variant') { const ns = new Set(generatedFilter); ns.delete(id); setGeneratedFilter(ns); }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a'); link.href = dataUrl; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const removeGeneratedImage = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
        <div className="bg-white border-b border-gray-200 px-8 py-4 z-30 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 mr-4 text-gray-400"> <Filter className="w-4 h-4" /> <span className="text-sm font-medium">Filters</span> </div>
                <MultiSelectFilter label="Templates" options={uniqueTemplates} selectedSet={generatedTemplateFilter} onToggle={val => { const ns = new Set(generatedTemplateFilter); ns.has(val) ? ns.delete(val) : ns.add(val); setGeneratedTemplateFilter(ns); setCurrentPage(1);}} />
                {uniqueGeneratedFolders.length > 0 && (
                    <MultiSelectFilter label="Images" options={uniqueGeneratedFolders} selectedSet={generatedFolderFilter} onToggle={val => { const ns = new Set(generatedFolderFilter); ns.has(val) ? ns.delete(val) : ns.add(val); setGeneratedFolderFilter(ns); setCurrentPage(1);}} />
                )}
                <div className="h-8 w-px bg-gray-200 mx-2"></div>
                {Object.entries(generatedFilterData.groups).map(([setName, data]) => (
                    <MultiSelectFilter key={setName} label={setName} options={Array.from(data.variants.keys())} selectedSet={generatedFilter} onToggle={val => { const ns = new Set(generatedFilter); ns.has(val) ? ns.delete(val) : ns.add(val); setGeneratedFilter(ns); setCurrentPage(1);}} />
                ))}
            </div>
            <ActiveFiltersChips filters={activeFiltersList} onRemove={handleRemoveFilter} onClearAll={() => { setGeneratedFilter(new Set()); setGeneratedTemplateFilter(new Set()); setGeneratedFolderFilter(new Set()); }} />
        </div>

        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
            {generatedImages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <Sparkles className="w-12 h-12 mb-4 text-gray-300" />
                    <p>No assets generated yet.</p>
                    <button onClick={() => setActiveView('rendered')} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"> Go to Templates & Generate </button>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 mb-8">
                        {paginatedImages.map(img => {
                            const isSelected = selectedGeneratedImageIds.has(img.id);
                            const offerName = img.componentNames.find(name => components.find(c => c.name === name)?.componentSetName?.includes('Offer'));

                            return (
                                <div key={img.id} className={`group bg-white rounded-lg shadow-sm overflow-hidden border transition-all hover:shadow-md relative ${isSelected ? 'ring-2 ring-indigo-500 border-transparent' : 'border-gray-200'}`}>
                                    <div className="bg-gray-100 aspect-square relative overflow-hidden">
                                        <img src={img.url} alt={img.componentName} className="w-full h-full object-contain" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                        <div onClick={() => toggleGeneratedImageSelection(img.id)} className="absolute top-2 left-2 cursor-pointer p-1 bg-white/80 rounded hover:bg-white shadow-sm backdrop-blur-sm z-10"> 
                                            <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 bg-white'}`}> {isSelected && <Check className="w-3 h-3 text-white" />} </div> 
                                        </div>
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] bg-black/70 text-white px-2 py-1 rounded-full backdrop-blur-md">{img.templateName.substring(0, 15)}...</span>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-white/95 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex items-center justify-between border-t border-gray-100">
                                            <button onClick={() => downloadImage(img.url, getDownloadFilename(img))} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Download"> <Download className="w-4 h-4" /> </button>
                                            <button onClick={() => setPreviewItem({ name: img.componentName, thumbnailUrl: img.url, description: img.templateName })} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Zoom"> <Maximize2 className="w-4 h-4" /> </button>
                                            <button onClick={() => removeGeneratedImage(img.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete"> <Trash2 className="w-4 h-4" /> </button>
                                        </div>
                                    </div>
                                    <div className="p-3 flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-gray-900 truncate" title={img.templateName}>{img.templateName}</p>
                                            <p className="text-[10px] text-gray-500 truncate mt-0.5">{img.folder || 'Uncategorized'}</p>
                                        </div>
                                        {offerName && (
                                            <div className="shrink-0 max-w-[50%] flex items-center"> <span className="inline-block truncate max-w-full px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-medium" title={offerName}>{offerName}</span> </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 pb-8">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"> <ChevronLeft className="w-4 h-4" /> </button>
                            <span className="text-sm font-medium text-gray-600">Page {currentPage} of {totalPages}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"> <ChevronRight className="w-4 h-4" /> </button>
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};