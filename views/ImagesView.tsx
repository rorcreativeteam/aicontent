import React, { useMemo, useState } from 'react';
import { Filter, Folder, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { DriveAsset } from '../types';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import { ActiveFiltersChips } from '../components/ActiveFiltersChips';
import { ImageCard } from '../components/ImageCard';

interface ImagesViewProps {
  assets: DriveAsset[];
  selectedImageIds: Set<string>;
  toggleImageSelection: (id: string) => void;
  setPreviewItem: (item: any) => void;
  isLoadingAll: boolean;
}

const ITEMS_PER_PAGE = 30;

export const ImagesView: React.FC<ImagesViewProps> = ({ assets, selectedImageIds, toggleImageSelection, setPreviewItem, isLoadingAll }) => {
  const [libraryFolderFilter, setLibraryFolderFilter] = useState<Set<string>>(new Set());
  const [currentLibraryPage, setCurrentLibraryPage] = useState(1);

  const displayAssets = assets.length > 0 ? assets : [];
  const sortedFolders = useMemo(() => Array.from(new Set(displayAssets.map(a => a.folder || 'Uncategorized'))).sort(), [displayAssets]);

  const filteredImages = useMemo(() => {
    if (libraryFolderFilter.size === 0) return displayAssets;
    return displayAssets.filter(a => libraryFolderFilter.has(a.folder || 'Uncategorized'));
  }, [displayAssets, libraryFolderFilter]);

  const libraryTotalPages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE);
  const paginatedLibraryImages = useMemo(() => filteredImages.slice((currentLibraryPage - 1) * ITEMS_PER_PAGE, currentLibraryPage * ITEMS_PER_PAGE), [filteredImages, currentLibraryPage]);

  const toggleLibraryFolderFilter = (folder: string) => {
    const newSet = new Set(libraryFolderFilter);
    if (newSet.has(folder)) newSet.delete(folder); else newSet.add(folder);
    setLibraryFolderFilter(newSet);
    setCurrentLibraryPage(1);
  };

  const libraryActiveFiltersList = useMemo(() => {
    const list: { id: string, label: string, type: string }[] = [];
    libraryFolderFilter.forEach(f => list.push({ id: f, label: f, type: 'Folder' }));
    return list;
  }, [libraryFolderFilter]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          {sortedFolders.length > 1 && (
            <>
              <div className="flex items-center gap-2 mr-4 text-gray-400">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              <MultiSelectFilter label="Categories" options={sortedFolders} selectedSet={libraryFolderFilter} onToggle={toggleLibraryFolderFilter} />
            </>
          )}
          <div className={`${sortedFolders.length > 1 ? 'ml-auto' : ''} flex items-center gap-3 text-xs text-gray-400`}>
              <span>{filteredImages.length} images shown</span>
              {selectedImageIds.size > 0 && <span className="font-medium text-indigo-600">({selectedImageIds.size} selected)</span>}
          </div>
        </div>
        {sortedFolders.length > 1 && (
          <ActiveFiltersChips filters={libraryActiveFiltersList} onRemove={(id) => toggleLibraryFolderFilter(id)} onClearAll={() => { setLibraryFolderFilter(new Set()); setCurrentLibraryPage(1); }} />
        )}
      </div>

      <div className="flex-1 overflow-auto p-8 custom-scrollbar">
        {isLoadingAll ? (
            <div className="flex flex-col items-center justify-center h-40"> <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mb-2" /> <p className="text-xs text-gray-400">Fetching from API...</p> </div>
        ) : filteredImages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl"> <Folder className="w-8 h-8 mb-2 text-gray-300" /> <p>No images found matching filters.</p> </div>
        ) : (
            <>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 mb-8">
                {paginatedLibraryImages.map((asset) => (
                  <ImageCard key={asset.id} asset={asset} isSelected={selectedImageIds.has(asset.id)} toggleSelection={toggleImageSelection} setPreviewItem={setPreviewItem} />
                ))}
              </div>
              {libraryTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pb-8">
                  <button onClick={() => setCurrentLibraryPage(p => Math.max(1, p - 1))} disabled={currentLibraryPage === 1} className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"> <ChevronLeft className="w-4 h-4" /> </button>
                  <span className="text-sm font-medium text-gray-600">Page {currentLibraryPage} of {libraryTotalPages}</span>
                  <button onClick={() => setCurrentLibraryPage(p => Math.min(libraryTotalPages, p + 1))} disabled={currentLibraryPage === libraryTotalPages} className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-50"> <ChevronRight className="w-4 h-4" /> </button>
                </div>
              )}
            </>
        )}
      </div>
    </div>
  );
};