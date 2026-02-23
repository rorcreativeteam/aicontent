import React, { useState } from 'react';
import { Loader2, CheckCircle2, Maximize2 } from 'lucide-react';
import { DriveAsset } from '../types';

interface ImageCardProps {
  asset: DriveAsset;
  isSelected: boolean;
  toggleSelection: (id: string) => void;
  setPreviewItem: (item: any) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({ asset, isSelected, toggleSelection, setPreviewItem }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <div
      className={`group relative cursor-pointer rounded-lg transition-all ${isSelected ? 'ring-2 ring-indigo-500 shadow-md transform scale-[1.02]' : 'hover:ring-2 hover:ring-gray-300'}`}
      onClick={() => toggleSelection(asset.id)}
    >
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        )}
        {asset.thumbnailLink ? (
          <img
            src={asset.thumbnailLink}
            alt={asset.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px] p-2 text-center bg-gray-100">No Preview</div>
        )}
        {isSelected && (
            <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center z-10"> 
                <div className="bg-indigo-500 text-white p-1 rounded-full shadow-lg"> 
                    <CheckCircle2 className="w-4 h-4" /> 
                </div> 
            </div>
        )}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewItem({ name: asset.name, thumbnailUrl: asset.thumbnailLink, description: `Size: ${asset.size}` }); }}
            className="p-1 bg-white/90 text-gray-600 rounded-full hover:bg-white shadow-sm"
            title="Preview"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};