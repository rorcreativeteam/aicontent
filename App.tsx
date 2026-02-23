import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, RefreshCw, UploadCloud, FileJson, Grid, CheckCircle2, AlertCircle, Box, Sparkles, X, Image as ImageIcon, Search, Tag, Copy, HardDrive, MoreHorizontal, Layers, Layout, Component, Figma, LogIn, Code, ZoomIn, ZoomOut, CheckSquare, Square, Download, Play, Loader2, Archive, Trash2, Maximize2, FileText, Folder, Check, Plus, CheckCircle, Eye, Filter, ChevronDown, ChevronRight, MessageSquare, AlertTriangle, ChevronLeft, Database } from 'lucide-react';
import SettingsPanel from './components/Controls';
import JsonViewer from './components/AssetCanvas';
import { fetchStaticManifest, fetchStaticImages, fetchFigmaProjects, fetchImageFolders, getFigmaConfig, getEnv } from './services/figmaService';
import { uploadToCloud, getCloudConfig } from './services/headlessService';
import { analyzeDesignSystem, analyzeComponentVisuals, VisualAnalysisResult } from './services/geminiService';
import { loadGoogleScripts, listDriveFiles, isGoogleApiInitialized } from './services/googleDriveService';
import { ComponentMetadata, HeadlessManifest, SyncLog, GoogleDriveConfig, DriveAsset, Template, TemplateLayer, ComponentTextLayer } from './types';
import JSZip from 'jszip';

// --- NEW COMPONENT: Multi-Select Filter Dropdown ---
const MultiSelectFilter = ({ 
  label, 
  options, 
  selectedSet, 
  onToggle 
}: { 
  label: string, 
  options: string[], 
  selectedSet: Set<string>, 
  onToggle: (val: string) => void 
}) => {
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

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
          selectedSet.size > 0 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span>{label}</span>
        {selectedSet.size > 0 && (
          <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px]">
            {selectedSet.size}
          </span>
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

const ActiveFiltersChips = ({ 
  filters, 
  onRemove, 
  onClearAll 
}: { 
  filters: Array<{ id: string, label: string, type: string }>, 
  onRemove: (id: string, type: string) => void,
  onClearAll: () => void 
}) => {
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

const generateMockAssets = (count: number): DriveAsset[] => {
  return [];
};

const MOCK_ASSETS = generateMockAssets(0);
const ITEMS_PER_PAGE = 30;

interface GeneratedImage {
  id: string;
  url: string;
  templateName: string;
  componentName: string;
  componentNames: string[]; 
  variantName?: string; 
  imageName?: string;   
  timestamp: number;
  folder?: string; 
}

const ImageCard = ({ asset, isSelected, toggleSelection, setPreviewItem }: any) => {
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

        {isSelected && (<div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center z-10"> <div className="bg-indigo-500 text-white p-1 rounded-full shadow-lg"> <CheckCircle2 className="w-4 h-4" /> </div> </div>)}

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

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (a, b) => a.flatMap(d => b.map(e => [...d, e])),
    [[]]
  );
}

const extractVariantKey = (name: string): string | null => {
  if (!name) return null;
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const figmaColorToCss = (color: { r: number, g: number, b: number, a: number }, opacity: number = 1) => {
  if (!color) return 'transparent';
  const isIntegerRange = color.r > 1 || color.g > 1 || color.b > 1;
  const r = isIntegerRange ? Math.round(color.r) : Math.round(color.r * 255);
  const g = isIntegerRange ? Math.round(color.g) : Math.round(color.g * 255);
  const b = isIntegerRange ? Math.round(color.b) : Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a * opacity})`;
};

const findComponentForLayer = (
  layer: TemplateLayer, 
  componentMap: Map<string, ComponentMetadata>, 
  allComponents: ComponentMetadata[] 
): ComponentMetadata | undefined => {
   
  if (layer.componentId && componentMap.has(layer.componentId)) {
    return componentMap.get(layer.componentId);
  }

  const cleanLayerName = layer.name.replace(/\s+\(\d+\)$/, '').trim();
  if (componentMap.has(cleanLayerName)) {
    return componentMap.get(cleanLayerName);
  }

  if (componentMap.has(layer.name)) {
    return componentMap.get(layer.name);
  }

  return allComponents.find(c => {
    const cNameLower = c.name.toLowerCase();
    const cleanLayerNameLower = cleanLayerName.toLowerCase();
    const baseName = c.name.split(' (')[0].toLowerCase();
    return cNameLower.startsWith(cleanLayerNameLower) ||
      cleanLayerNameLower.startsWith(baseName) ||
      (c.componentSetName && cleanLayerNameLower.includes(c.componentSetName.toLowerCase()));
  });
};

const isPlaceholderImage = (layer: TemplateLayer): boolean => {
  const name = layer.name.toLowerCase().trim();
  return name === 'hero';
};

const getDownloadFilename = (img: GeneratedImage) => {
    const safeTemplate = img.templateName.replace(/\s+/g, '_').replace(/[^a-z0-9_-]/gi, '');
    let variantPart = '';
    if (img.componentNames && img.componentNames.length > 0) {
        const targetComponent = img.componentNames.find(name => 
            name.includes('Property') || name.includes('Offer')
        );
        if (targetComponent) {
            variantPart = targetComponent
                .replace(/(Property|Offer)(\s+\d+)?/gi, '')
                .replace(/=/g, ' ') 
                .replace(/_/g, ' ')   
                .trim()               
                .replace(/\s+/g, '_'); 
        }
    }
    const safeVariant = variantPart.replace(/[^a-z0-9_.-]/gi, '');
    let safeImage = (img.imageName || '').replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/gi, '');
    safeImage = safeImage.replace(/\.[^/.]+$/, "");
    
    const parts = [safeTemplate, safeVariant, safeImage].filter(Boolean);
    return `${parts.join('_')}.png`;
};

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [activeView, setActiveView] = useState<'list' | 'images' | 'json' | 'json_images' | 'rendered' | 'generated'>('list');
  const [showDevTools, setShowDevTools] = useState(false);

  // Configuration States
  const [figmaFileId, setFigmaFileId] = useState<string>(localStorage.getItem('figma_file_key') || 'zH45M5SvQ8E6G9lwUXW4ny');
  const [imageFolder, setImageFolder] = useState<string>(localStorage.getItem('image_folder_key') || 'Dog_Stop');
  const [availableProjects, setAvailableProjects] = useState<{id: string, name: string}[]>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);

  // Loading States
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  // Data States
  const [components, setComponents] = useState<ComponentMetadata[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [driveAssets, setDriveAssets] = useState<DriveAsset[]>([]);
  const [rawImagesPayload, setRawImagesPayload] = useState<any>(null);
  const [fetchTimestamp, setFetchTimestamp] = useState<string>('');

  // Selection States
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // Image Filtering State
  const [libraryFolderFilter, setLibraryFolderFilter] = useState<Set<string>>(new Set());
  const [currentLibraryPage, setCurrentLibraryPage] = useState(1);

  // Generated Selection State
  const [selectedGeneratedImageIds, setSelectedGeneratedImageIds] = useState<Set<string>>(new Set());
  const [generatedFilter, setGeneratedFilter] = useState<Set<string>>(new Set());
  const [generatedTemplateFilter, setGeneratedTemplateFilter] = useState<Set<string>>(new Set());
  const [generatedFolderFilter, setGeneratedFolderFilter] = useState<Set<string>>(new Set());

  // Expanded states for accordion filters
  const [expandedFilterSets, setExpandedFilterSets] = useState<Set<string>>(new Set(['Templates']));
  const [selectedSet, setSelectedSet] = useState<string>('all');
  const [manifest, setManifest] = useState<HeadlessManifest | null>(null);
  const [error, setError] = useState('');

  // Google Drive Config
  const [driveConfig, setDriveConfig] = useState<GoogleDriveConfig>({ clientId: '', apiKey: '', folderId: '' });
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  // Render/Generation States
  const [zoom, setZoom] = useState(0.4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'preparing' | 'generating'>('idle');
  const [isDownloading, setIsDownloading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<ComponentMetadata | any | null>(null);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [pendingDownloadSubset, setPendingDownloadSubset] = useState<GeneratedImage[] | undefined>(undefined);
  const [showGenerationWarning, setShowGenerationWarning] = useState(false);

  const componentMap = useMemo(() => {
    const map = new Map<string, ComponentMetadata>();
    components.forEach(c => {
      if (c.id) map.set(c.id, c);
      map.set(c.name, c);
      const cleanName = c.name.split(' (')[0].trim();
      map.set(cleanName, c);
    });
    return map;
  }, [components]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isGenerating) {
        e.preventDefault();
        e.returnValue = ''; 
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGenerating]);

  useEffect(() => {
    if (!localStorage.getItem('figma_file_key') && figmaFileId) {
        localStorage.setItem('figma_file_key', figmaFileId);
    }
    if (!localStorage.getItem('image_folder_key') && imageFolder) {
        localStorage.setItem('image_folder_key', imageFolder);
    }
    
    // Fetch available projects and folders for dropdowns
    const loadConfigData = async () => {
      try {
        const [projects, folders] = await Promise.all([
          fetchFigmaProjects(),
          fetchImageFolders()
        ]);
        setAvailableProjects(projects);
        setAvailableFolders(folders);
      } catch (err) {
        console.error("Failed to load configuration data", err);
      }
    };
    loadConfigData();

    const loadedDriveConfig = {
      clientId: getEnv('GOOGLE_DRIVE_CLIENT_ID') || localStorage.getItem('google_drive_client_id') || '',
      apiKey: getEnv('GOOGLE_DRIVE_API_KEY') || localStorage.getItem('google_drive_api_key') || '',
      folderId: getEnv('GOOGLE_DRIVE_FOLDER_ID') || localStorage.getItem('google_drive_folder_id') || ''
    };
    setDriveConfig(loadedDriveConfig);
    if (loadedDriveConfig.apiKey && loadedDriveConfig.folderId) setIsDriveConnected(true);
    
    handleRefreshSource(loadedDriveConfig);
  }, []);

  const handleRefreshSource = async (overrideDriveConfig?: GoogleDriveConfig) => {
    setIsLoadingAll(true);
    setError('');
    
    const currentFigmaId = localStorage.getItem('figma_file_key') || getEnv('FIGMA_FILE_KEY');
    if (!currentFigmaId) {
        setError('Please provide a Figma File ID in the Configuration panel.');
        setLoadingStatus('');
        setIsLoadingAll(false);
        setShowSettings(true); 
        return;
    }

    const currentImageFolder = localStorage.getItem('image_folder_key') || getEnv('IMAGE_FOLDER_KEY');
    if (!currentImageFolder) {
        setError('Please provide an Image Folder Name in the Configuration panel.');
        setLoadingStatus('');
        setIsLoadingAll(false);
        setShowSettings(true); 
        return;
    }

    setLoadingStatus('Connecting to Source...');

    try {
      setLoadingStatus('Fetching Design & Images...');
      const manifestPromise = fetchStaticManifest();
      const imagesPromise = fetchStaticImages();

      const [manifestData, imagesResult] = await Promise.all([
        manifestPromise,
        imagesPromise
      ]);

      const compData = Object.values(manifestData.components) as ComponentMetadata[];
      setComponents(compData);
      if (compData.length > 0) {
        setSelectedComponentIds(new Set(compData.map(c => c.id)));
      }

      const tplData = manifestData.templates || [];
      setTemplates(tplData);

      setSelectedTemplateIds(prev => {
        const validIds = new Set(tplData.map(t => t.id));
        const hasValidSelection = Array.from(prev).some(id => validIds.has(id));
        if (hasValidSelection && prev.size > 0) return prev;
        return tplData.length > 0 ? new Set([tplData[0].id]) : new Set();
      });

      setDriveAssets(imagesResult.assets);
      setRawImagesPayload(imagesResult.raw);
      setFetchTimestamp(new Date().toLocaleTimeString());

      if (imagesResult.assets.length > 0) {
        setSelectedImageIds(new Set([imagesResult.assets[0].id]));
      } else {
        setSelectedImageIds(new Set());
      }

      setManifest(manifestData);

    } catch (err: any) {
      console.error("Full Refresh Failed", err);
      const errorMsg = (err instanceof Error) ? err.message : (typeof err === 'string' ? err : 'Failed to refresh sources.');
      setError(errorMsg);
    } finally {
      setIsLoadingAll(false);
      setLoadingStatus('');
    }
  };

  const handleConnectDrive = () => { setShowSettings(true); };

  const toggleTemplateSelection = (id: string) => {
    const newSet = new Set(selectedTemplateIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTemplateIds(newSet);
  };

  const toggleComponentSelection = (id: string) => {
    const newSet = new Set(selectedComponentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedComponentIds(newSet);
  };

  const toggleImageSelection = (id: string) => {
    const newSet = new Set(selectedImageIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedImageIds(newSet);
  };

  const handleBulkSelect = (shouldSelect: boolean) => {
    const newSet = new Set(selectedComponentIds);
    filteredComponents.forEach(c => {
      if (shouldSelect) newSet.add(c.id);
      else newSet.delete(c.id);
    });
    setSelectedComponentIds(newSet);
  };

  const toggleGeneratedImageSelection = (id: string) => {
    const newSet = new Set(selectedGeneratedImageIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedGeneratedImageIds(newSet);
  };

  const toggleGeneratedFilter = (name: string) => {
    const newSet = new Set(generatedFilter);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setGeneratedFilter(newSet);
    setCurrentPage(1);
  };

  const toggleGeneratedTemplateFilter = (name: string) => {
    const newSet = new Set(generatedTemplateFilter);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setGeneratedTemplateFilter(newSet);
    setCurrentPage(1);
  };

  const toggleGeneratedFolderFilter = (name: string) => {
    const newSet = new Set(generatedFolderFilter);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setGeneratedFolderFilter(newSet);
    setCurrentPage(1);
  };

  const toggleFilterSet = (setName: string) => {
    const newSet = new Set(expandedFilterSets);
    if (newSet.has(setName)) newSet.delete(setName);
    else newSet.add(setName);
    setExpandedFilterSets(newSet);
  };

  const activeFiltersList = useMemo(() => {
    const list: { id: string, label: string, type: string }[] = [];
    generatedTemplateFilter.forEach(t => list.push({ id: t, label: t, type: 'Template' }));
    generatedFolderFilter.forEach(f => list.push({ id: f, label: f, type: 'Folder' }));
    generatedFilter.forEach(c => list.push({ id: c, label: c, type: 'Variant' }));
    return list;
  }, [generatedTemplateFilter, generatedFolderFilter, generatedFilter]);

  const handleRemoveFilter = (id: string, type: string) => {
    if (type === 'Template') toggleGeneratedTemplateFilter(id);
    if (type === 'Folder') toggleGeneratedFolderFilter(id);
    if (type === 'Variant') toggleGeneratedFilter(id);
  };

  const toggleLibraryFolderFilter = (folder: string) => {
    const newSet = new Set(libraryFolderFilter);
    if (newSet.has(folder)) newSet.delete(folder);
    else newSet.add(folder);
    setLibraryFolderFilter(newSet);
    setCurrentLibraryPage(1);
  };

  const libraryActiveFiltersList = useMemo(() => {
    const list: { id: string, label: string, type: string }[] = [];
    libraryFolderFilter.forEach(f => list.push({ id: f, label: f, type: 'Folder' }));
    return list;
  }, [libraryFolderFilter]);

  const handleRemoveLibraryFilter = (id: string, type: string) => {
      toggleLibraryFolderFilter(id);
  };


  const getLayerStyle = (layer: TemplateLayer) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
      opacity: layer.opacity ?? 1,
    };
    if (layer.fills && layer.fills.length > 0) {
      const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
      if (fill && fill.color) {
        style.backgroundColor = figmaColorToCss(fill.color, fill.opacity ?? 1);
      }
    }
    return style;
  };

  const getTextStyle = (layer: TemplateLayer) => {
    const style: React.CSSProperties = {
      fontSize: layer.fontSize ? `${layer.fontSize}px` : '16px',
      fontFamily: layer.fontFamily || 'sans-serif',
      fontWeight: layer.fontWeight || 400,
      color: '#000000',
      whiteSpace: 'pre-wrap',
      textAlign: layer.textAlignHorizontal?.toLowerCase() as any || 'left',
      display: 'flex',
      alignItems: layer.textAlignVertical === 'CENTER' ? 'center' : layer.textAlignVertical === 'BOTTOM' ? 'flex-end' : 'flex-start'
    };
    if (layer.fills && layer.fills.length > 0) {
      const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
      if (fill && fill.color) {
        style.color = figmaColorToCss(fill.color, fill.opacity ?? 1);
      }
    }
    return style;
  };

  const handleGenerateClick = () => {
    if (selectedTemplateIds.size === 0) {
      setError("Please select at least one template.");
      return;
    }
    if (generationCount >= 100) {
      setShowGenerationWarning(true);
    } else {
      executeGeneration();
    }
  };

  const executeGeneration = async () => {
    setIsGenerating(true);
    setGenerationPhase('preparing');
    
    setGeneratedImages([]);
    setSelectedGeneratedImageIds(new Set());
    setGeneratedFilter(new Set());
    setGeneratedTemplateFilter(new Set());
    setGeneratedFolderFilter(new Set());
    setCurrentPage(1);

    const activeTemplates = templates.filter(t => selectedTemplateIds.has(t.id));
    const activeImages = displayAssets.filter(a => selectedImageIds.has(a.id));
    const imagesToUse = activeImages; 

    const imageCache: Record<string, HTMLImageElement> = {};

    const loadImage = (url: string): Promise<HTMLImageElement> => {
      if (imageCache[url]) return Promise.resolve(imageCache[url]);
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        const safeUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
        
        img.onload = async () => {
          try { await img.decode(); } catch (e) { console.warn(e); }
          imageCache[url] = img;
          resolve(img);
        };
        img.onerror = () => {
           if (!url.includes('corsproxy.io')) {
             const proxy = new Image();
             proxy.crossOrigin = "Anonymous";
             proxy.onload = () => { imageCache[url] = proxy; resolve(proxy); };
             proxy.onerror = () => resolve(img);
             proxy.src = `https://corsproxy.io/?${encodeURIComponent(url)}`;
           } else { resolve(img); }
        };
        img.src = safeUrl;
      });
    };

    const uniqueImageUrls = new Set<string>();
    activeTemplates.forEach(template => {
      template.layers.forEach(layer => {
        const original = findComponentForLayer(layer, componentMap, components);
        const isComponentSlot = ['INSTANCE', 'COMPONENT'].includes(layer.type) || !!original;
        if (isComponentSlot) {
           const cleanName = layer.name.replace(/\s+\(\d+\)$/, '').trim();
           const likelySetName = cleanName.split('/')[0].trim();
           const isOfferCandidate = likelySetName.includes('Offer') || (original && original.name.includes('Offer')) || (original && original.componentSetName && original.componentSetName.includes('Offer'));

           if (isOfferCandidate) {
             const allOffers = components.filter(c => c.name.includes('Offer') || (c.componentSetName && c.componentSetName.includes('Offer')));
             allOffers.forEach(c => { if (c.thumbnailUrl) uniqueImageUrls.add(c.thumbnailUrl); });
           }
           if (original) {
             if (original.componentSetName) {
               const candidates = components.filter(c => c.componentSetName === original.componentSetName);
               candidates.forEach(c => { if (c.thumbnailUrl) uniqueImageUrls.add(c.thumbnailUrl); });
             } else if (original.thumbnailUrl) {
               uniqueImageUrls.add(original.thumbnailUrl);
             }
           }
           if (likelySetName && likelySetName.length > 0) {
             const fuzzyCandidates = components.filter(c => c.componentSetName === likelySetName);
             fuzzyCandidates.forEach(c => { if (c.thumbnailUrl) uniqueImageUrls.add(c.thumbnailUrl); });
           }
        } else if (layer.fillImageUrl) {
           uniqueImageUrls.add(layer.fillImageUrl);
        }
      });
    });
    imagesToUse.forEach(a => { if (a.thumbnailLink) uniqueImageUrls.add(a.thumbnailLink); });

    let loadedCount = 0;
    if (uniqueImageUrls.size > 0) {
      const promises = Array.from(uniqueImageUrls).map(url => 
        loadImage(url).then(() => {
          loadedCount++;
          setGenerationProgress({ current: loadedCount, total: uniqueImageUrls.size });
        })
      );
      await Promise.all(promises);
    }

    await new Promise(r => setTimeout(r, 100));
    const totalToGenerate = generationCount; 
    setGenerationPhase('generating');
    setGenerationProgress({ current: 0, total: totalToGenerate });

    const results: GeneratedImage[] = [];
    let validImagesGenerated = 0;
    let loopIterations = 0;
    const yieldFreq = 20;

    const drawText = (ctx: CanvasRenderingContext2D, layer: TemplateLayer) => {
      ctx.save();
      const fontSize = layer.fontSize || 16;
      const fontWeight = layer.fontWeight || 400;
      const fontFamily = layer.fontFamily || 'Inter, sans-serif';
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = '#000000';
      if (layer.fills && layer.fills.length > 0) {
        const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
        if (fill && fill.color) ctx.fillStyle = figmaColorToCss(fill.color, fill.opacity ?? 1);
      }
      const text = layer.characters || '';
      const x = layer.x;
      const y = layer.y;
      let drawX = x;
      if (layer.textAlignHorizontal === 'CENTER') { drawX = x + layer.width / 2; ctx.textAlign = 'center'; }
      else if (layer.textAlignHorizontal === 'RIGHT') { drawX = x + layer.width; ctx.textAlign = 'right'; }
      else { ctx.textAlign = 'left'; }
      let drawY = y;
      const metrics = ctx.measureText(text);
      if (layer.textAlignVertical === 'CENTER') { drawY = y + (layer.height / 2) + (fontSize / 3); }
      else if (layer.textAlignVertical === 'BOTTOM') { drawY = y + layer.height - (metrics.actualBoundingBoxDescent || 2); }
      else { drawY = y + fontSize; }
      ctx.fillText(text, drawX, drawY);
      ctx.restore();
    };

    const drawScaledImage = (ctx: CanvasRenderingContext2D, layer: TemplateLayer, img: HTMLImageElement) => {
        const scaleW = layer.width / img.width;
        const scaleH = layer.height / img.height;
        const scale = Math.max(scaleW, scaleH);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = (layer.width - drawW) / 2;
        const offsetY = (layer.height - drawH) / 2;
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(layer.x, layer.y, layer.width, layer.height);
        ctx.clip(); 
        ctx.drawImage(img, layer.x + offsetX, layer.y + offsetY, drawW, drawH);
        ctx.restore();
    };

    for (const template of activeTemplates) {
      const canvas = document.createElement('canvas');
      canvas.width = template.width;
      canvas.height = template.height;
      const ctx = canvas.getContext('2d');

      const componentSlots: { layerIndex: number, originalId: string, candidates: ComponentMetadata[] }[] = [];
      for (let i = 0; i < template.layers.length; i++) {
         const layer = template.layers[i];
         const isImage = isPlaceholderImage(layer);
         const original = findComponentForLayer(layer, componentMap, components);
         const isComponentSlot = !isImage && (['INSTANCE', 'COMPONENT'].includes(layer.type) || !!original);
         
         if (isComponentSlot && original) {
            let candidates: ComponentMetadata[] = [];
            if (original.componentSetName) {
               const setMembers = components.filter(c => c.componentSetName === original.componentSetName);
               const isOffer = original.componentSetName.includes('Offer');
               if (isOffer) {
                  const isWideTemplate = template.name.includes('Template_Long') || template.name.includes('Template_Wide');
                  const targetSetNames = isWideTemplate ? ['Offer_Wide', 'Offer Wide', 'Offer-Wide'] : ['Offer'];
                  const baseOfferSet = components.filter(c => c.componentSetName === 'Offer');
                  const selectedBaseOffers = baseOfferSet.filter(c => selectedComponentIds.has(c.id));
                  const sourceOffers = selectedBaseOffers.length > 0 ? selectedBaseOffers : baseOfferSet;
                  candidates = sourceOffers.map(source => {
                    if (!isWideTemplate) return source;
                    const key = extractVariantKey(source.name);
                    if (!key) return null;
                    return components.find(c => c.componentSetName && targetSetNames.includes(c.componentSetName) && extractVariantKey(c.name) === key);
                  }).filter(Boolean) as ComponentMetadata[];
               } else {
                  const isHiddenSet = original.componentSetName.includes("Disclaimer");
                  if (isHiddenSet) { candidates = setMembers; } 
                  else {
                    const selectedMembers = setMembers.filter(c => selectedComponentIds.has(c.id));
                    candidates = selectedMembers.length > 0 ? selectedMembers : [original];
                  }
               }
            } else if (original) { candidates = [original]; } 
            else {
               const cleanName = layer.name.replace(/\s+\(\d+\)$/, '').trim();
               const likelySetName = cleanName.split('/')[0].trim();
               const fuzzyCandidates = components.filter(c => c.componentSetName === likelySetName);
               const selectedFuzzy = fuzzyCandidates.filter(c => selectedComponentIds.has(c.id));
               if (selectedFuzzy.length > 0) candidates = selectedFuzzy;
               else if (fuzzyCandidates.length > 0) candidates = [fuzzyCandidates[0]];
            }
            if (candidates.length > 0) componentSlots.push({ layerIndex: i, originalId: layer.componentId || '', candidates });
         }
      }

      const slotCandidates = componentSlots.map(s => s.candidates);
      const combinations = cartesianProduct(slotCandidates);
      const hasImageLayer = template.layers.some(l => isPlaceholderImage(l));
      const imageLoop = hasImageLayer ? imagesToUse : [null];

      for (const currentImage of imageLoop) {
        for (const combination of combinations) {
          loopIterations++; 

          const offerComponent = combination.find(c => c.componentSetName?.includes('Offer'));
          const disclaimerComponent = combination.find(c => c.componentSetName?.includes('Disclaimer'));
          let isValid = true;
          if (offerComponent && disclaimerComponent) {
            const offerKey = extractVariantKey(offerComponent.name);
            const disclaimerKey = extractVariantKey(disclaimerComponent.name);
            if (offerKey && offerKey !== disclaimerKey) isValid = false;
          }

          if (!isValid) {
             if (loopIterations % yieldFreq === 0) await new Promise(r => setTimeout(r, 0));
             continue; 
          }

          try {
            if (ctx) {
                canvas.width = template.width; 

                let bgDrawn = false;
                if (template.backgroundColor) {
                  ctx.fillStyle = figmaColorToCss(template.backgroundColor);
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  bgDrawn = true;
                } else if (template.fills && template.fills.length > 0) {
                  const bgFill = template.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
                  if (bgFill && bgFill.color) {
                    ctx.fillStyle = figmaColorToCss(bgFill.color, bgFill.opacity ?? 1);
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    bgDrawn = true;
                  }
                }
                if (!bgDrawn) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

                for (let i = 0; i < template.layers.length; i++) {
                    const layer = template.layers[i];
                    
                    const slotIndex = componentSlots.findIndex(s => s.layerIndex === i);
                    if (slotIndex !== -1 || ['INSTANCE', 'COMPONENT'].includes(layer.type)) {
                        let componentToRender: ComponentMetadata | undefined;
                        if (slotIndex !== -1) { componentToRender = combination[slotIndex]; }
                        else { componentToRender = findComponentForLayer(layer, componentMap, components); }

                        if (componentToRender && componentToRender.thumbnailUrl) {
                            const img = await loadImage(componentToRender.thumbnailUrl);
                            if (img.width > 0) { 
                                drawScaledImage(ctx, layer, img); 
                            } else {
                                ctx.fillStyle = '#eeeeee'; ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                            }
                        }
                        continue;
                    }

                    if (isPlaceholderImage(layer)) {
                        const vpsAsset = currentImage;
                        if (vpsAsset && vpsAsset.thumbnailLink) {
                            const img = await loadImage(vpsAsset.thumbnailLink);
                            if (img.width > 0) drawScaledImage(ctx, layer, img);
                        }
                        continue;
                    }

                    if (layer.type === 'TEXT') { 
                        drawText(ctx, layer); 
                    }
                    else if (['RECTANGLE', 'FRAME', 'GROUP', 'VECTOR', 'ELLIPSE', 'STAR', 'LINE', 'REGULAR_POLYGON'].includes(layer.type)) {
                        if (layer.fillImageUrl) {
                            const img = await loadImage(layer.fillImageUrl);
                            if (img.width > 0) drawScaledImage(ctx, layer, img);
                        } else if (layer.fills && layer.fills.length > 0) {
                            const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
                            if (fill && fill.color) {
                                ctx.fillStyle = figmaColorToCss(fill.color, fill.opacity ?? 1);
                                ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                            }
                        }
                    }
                }
                
                const dataUrl = canvas.toDataURL('image/png');
                
                validImagesGenerated++;
                results.push({
                    id: `${template.id}_${Date.now()}_${Math.random()}`,
                    url: dataUrl,
                    templateName: template.name,
                    componentName: 'Generated Asset',
                    componentNames: combination.map(c => c.name),
                    timestamp: Date.now(),
                    folder: currentImage ? (currentImage.folder || 'Uncategorized') : undefined,
                    variantName: combination.map(c => c.name).join('_'),
                    imageName: currentImage ? currentImage.name : undefined
                });
            }
          } catch (e) {
            console.error("Generation Error:", e);
          }

          setGenerationProgress(prev => ({ ...prev, current: validImagesGenerated }));

          if (loopIterations % yieldFreq === 0) {
             await new Promise(r => setTimeout(r, 0));
          }
        }
      }
    }

    setGenerationPhase('idle');
    setGeneratedImages(results);
    setIsGenerating(false);
  };

  const removeGeneratedImage = (id: string) => {
    setGeneratedImages(prev => prev.filter(img => img.id !== id));
    if (selectedGeneratedImageIds.has(id)) {
      const newSet = new Set(selectedGeneratedImageIds);
      newSet.delete(id);
      setSelectedGeneratedImageIds(newSet);
    }
  };
  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a'); link.href = dataUrl; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  const processZipDownload = async (subset?: GeneratedImage[]) => {
    const imagesToZip = subset || generatedImages;
    if (imagesToZip.length === 0) return;
    setIsDownloading(true);
    const zip = new JSZip();
    imagesToZip.forEach((img) => {
      const base64Data = img.url.replace(/^data:image\/(png|jpg);base64,/, "");
      const filename = getDownloadFilename(img);
      zip.file(filename, base64Data, { base64: true });
    });
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a'); link.href = url; link.download = `generated_assets_${new Date().getTime()}.zip`; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) { setError("Failed to generate ZIP file."); } finally { setIsDownloading(false); }
  };
  const handleDownloadZip = async (subset?: GeneratedImage[]) => {
    const imagesToZip = subset || generatedImages;
    if (imagesToZip.length === 0) return;
    if (imagesToZip.length > 150) { setPendingDownloadSubset(subset); setShowDownloadWarning(true); return; }
    await processZipDownload(subset);
  };

  const getPageTitle = () => {
    switch (activeView) {
      case 'list': return 'Messaging';
      case 'images': return 'Images';
      case 'json': return 'System Manifest (JSON)';
      case 'json_images': return 'Raw Images Payload (Debug)';
      case 'rendered': return 'Templates'; 
      case 'generated': return 'Generation Gallery';
    }
  };

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
    if (selectedSet === 'ungrouped') return visibleComponents.filter(c => !c.componentSetName);
    return visibleComponents.filter(c => c.componentSetName === selectedSet);
  }, [components, selectedSet]);

  const displayAssets = driveAssets.length > 0 ? driveAssets : MOCK_ASSETS;

  const sortedFolders = useMemo(() => {
    return Array.from(new Set(displayAssets.map(a => a.folder || 'Uncategorized'))).sort();
  }, [displayAssets]);

  const filteredImages = useMemo(() => {
    if (libraryFolderFilter.size === 0) return displayAssets;
    return displayAssets.filter(a => libraryFolderFilter.has(a.folder || 'Uncategorized'));
  }, [displayAssets, libraryFolderFilter]);

  const libraryTotalPages = Math.ceil(filteredImages.length / ITEMS_PER_PAGE);
  const paginatedLibraryImages = useMemo(() => {
    return filteredImages.slice((currentLibraryPage - 1) * ITEMS_PER_PAGE, currentLibraryPage * ITEMS_PER_PAGE);
  }, [filteredImages, currentLibraryPage]);

  const handleBulkSelectImages = (shouldSelect: boolean) => {
    const newSet = new Set(selectedImageIds);
    filteredImages.forEach(asset => {
      if (shouldSelect) newSet.add(asset.id);
      else newSet.delete(asset.id);
    });
    setSelectedImageIds(newSet);
  };

  const selectedTemplatesList = useMemo(() => templates.filter(t => selectedTemplateIds.has(t.id)), [selectedTemplateIds, templates]);
  const generationCount = useMemo(() => {
    if (selectedTemplateIds.size === 0) return 0;
    const activeTemplates = templates.filter(t => selectedTemplateIds.has(t.id));
    const imageCount = selectedImageIds.size; 

    let total = 0;

    for (const template of activeTemplates) {
      const slotCandidates: ComponentMetadata[][] = [];
      for (const layer of template.layers) {
        const isImage = isPlaceholderImage(layer);
        const original = findComponentForLayer(layer, componentMap, components);
        const isComponentSlot = !isImage && (['INSTANCE', 'COMPONENT'].includes(layer.type) || !!original);

        if (isComponentSlot && original) {
          let candidates: ComponentMetadata[] = [];
          if (original.componentSetName) {
            const setMembers = components.filter(c => c.componentSetName === original.componentSetName);
            const isOffer = original.componentSetName.includes('Offer');
            if (isOffer) {
              const isWideTemplate = template.name.includes('Template_Long') || template.name.includes('Template_Wide');
              const targetSetNames = isWideTemplate ? ['Offer_Wide', 'Offer Wide', 'Offer-Wide'] : ['Offer'];
              const baseOfferSet = components.filter(c => c.componentSetName === 'Offer');
              const selectedBaseOffers = baseOfferSet.filter(c => selectedComponentIds.has(c.id));
              const sourceOffers = selectedBaseOffers.length > 0 ? selectedBaseOffers : baseOfferSet;
              candidates = sourceOffers.map(source => {
                if (!isWideTemplate) return source;
                const key = extractVariantKey(source.name);
                if (!key) return null;
                const match = components.find(c => c.componentSetName && targetSetNames.includes(c.componentSetName) && extractVariantKey(c.name) === key);
                return match;
              }).filter(Boolean) as ComponentMetadata[];
            } else {
              const isHiddenSet = original.componentSetName.includes("Disclaimer");
              if (isHiddenSet) { candidates = setMembers; } 
              else {
                const selectedMembers = setMembers.filter(c => selectedComponentIds.has(c.id));
                candidates = selectedMembers.length > 0 ? selectedMembers : [original];
              }
            }
          } else if (original) { candidates = [original]; } 
          else {
            const cleanName = layer.name.replace(/\s+\(\d+\)$/, '').trim();
            const likelySetName = cleanName.split('/')[0].trim();
            const fuzzyCandidates = components.filter(c => c.componentSetName === likelySetName);
            const selectedFuzzy = fuzzyCandidates.filter(c => selectedComponentIds.has(c.id));
            if (selectedFuzzy.length > 0) candidates = selectedFuzzy;
            else if (fuzzyCandidates.length > 0) candidates = [fuzzyCandidates[0]];
          }
          if (candidates.length > 0) slotCandidates.push(candidates);
        }
      }
      let validCombos = 0;
      if (slotCandidates.length > 0) {
        const combinations = cartesianProduct(slotCandidates);
        for (const combination of combinations) {
          const offerComponent = combination.find(c => c.componentSetName?.includes('Offer'));
          const disclaimerComponent = combination.find(c => c.componentSetName?.includes('Disclaimer'));
          let isValid = true;
          if (offerComponent && disclaimerComponent) {
            const offerKey = extractVariantKey(offerComponent.name);
            const disclaimerKey = extractVariantKey(disclaimerComponent.name);
            if (offerKey && offerKey !== disclaimerKey) isValid = false;
          }
          if (isValid) validCombos++;
        }
      } else { validCombos = 1; }
      const hasImageLayer = template.layers.some(l => isPlaceholderImage(l));
      const finalCountForTemplate = validCombos * (hasImageLayer ? imageCount : 1);
      total += finalCountForTemplate;
    }
    return total;
  }, [selectedTemplateIds, templates, components, componentMap, selectedComponentIds, selectedImageIds, displayAssets]);
   
  const isHighVolume = generationCount >= 100;
   
  const generatedFilterData = useMemo(() => {
    const groups: Record<string, { total: number, variants: Map<string, number> }> = {};
    const ungrouped: Map<string, number> = new Map();
    
    generatedImages.forEach(img => {
      img.componentNames.forEach(name => {
        const comp = components.find(c => c.name === name);
        const setName = comp?.componentSetName;
        
        if (setName && setName.includes("Disclaimer")) {
          return; 
        }

        if (setName) {
          if (!groups[setName]) { groups[setName] = { total: 0, variants: new Map() }; }
          const group = groups[setName];
          group.total++;
          group.variants.set(name, (group.variants.get(name) || 0) + 1);
        } else { 
          ungrouped.set(name, (ungrouped.get(name) || 0) + 1); 
        }
      });
    });
    
    return { groups, ungrouped };
  }, [generatedImages, components]);
  
  const uniqueTemplates = useMemo(() => Array.from(new Set(generatedImages.map(img => img.templateName))).sort(), [generatedImages]);

  const uniqueGeneratedFolders = useMemo(() => {
    const folders = new Set<string>();
    generatedImages.forEach(img => { if (img.folder) folders.add(img.folder); });
    return Array.from(folders).sort();
  }, [generatedImages]);

  const displayGeneratedImages = useMemo(() => {
    let result = generatedImages;
    if (generatedTemplateFilter.size > 0) { result = result.filter(img => generatedTemplateFilter.has(img.templateName)); }
    if (generatedFolderFilter.size > 0) { result = result.filter(img => img.folder && generatedFolderFilter.has(img.folder)); }
    if (generatedFilter.size > 0) { result = result.filter(img => img.componentNames.some(name => generatedFilter.has(name))); }
    return result;
  }, [generatedImages, generatedFilter, generatedTemplateFilter, generatedFolderFilter]);
  const totalPages = Math.ceil(displayGeneratedImages.length / ITEMS_PER_PAGE);
  const paginatedImages = useMemo(() => displayGeneratedImages.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [displayGeneratedImages, currentPage]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* SIDEBAR */}
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
          <button onClick={() => { setActiveView('rendered'); }} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'rendered' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Eye className="w-4 h-4" /> Templates
          </button>
          <button onClick={() => setActiveView('generated')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'generated' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            {isGenerating ? (<Loader2 className="w-4 h-4 animate-spin text-indigo-600" />) : generatedImages.length > 0 ? (<CheckCircle2 className="w-4 h-4 text-green-600" />) : (<Grid className="w-4 h-4" />)}
            Generation Gallery
            {generatedImages.length > 0 && (<span className="ml-auto bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-[10px]">{generatedImages.length}</span>)}
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
          <button onClick={() => setShowSettings(!showSettings)} className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showSettings ? 'bg-gray-100 border-gray-300 text-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}> <Settings className="w-4 h-4" /> Configuration </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
            {activeView === 'generated' && generatedImages.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium border border-indigo-100 shadow-sm">
                {generatedImages.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {(activeView === 'list' || activeView === 'json_images') && (
              <div className="flex items-center gap-3">
                {activeView === 'list' && (
                  <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                    <button onClick={() => handleBulkSelect(true)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-200 transition-colors">Select All</button>
                    <button onClick={() => handleBulkSelect(false)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">Deselect All</button>
                  </div>
                )}
              </div>
            )}
            {activeView === 'images' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                    <button onClick={() => handleBulkSelectImages(true)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 border-r border-gray-200 transition-colors">Select All</button>
                    <button onClick={() => handleBulkSelectImages(false)} className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">Deselect All</button>
                  </div>
                </div>
              </div>
            )}
            {activeView === 'generated' && (
              <div className="flex items-center gap-2">
                {selectedGeneratedImageIds.size > 0 && (
                  <button onClick={() => handleDownloadZip(generatedImages.filter(img => selectedGeneratedImageIds.has(img.id)))} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50">
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Download Selected ({selectedGeneratedImageIds.size})
                  </button>
                )}
                <button onClick={() => handleDownloadZip()} disabled={generatedImages.length === 0 || isDownloading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-indigo-700 hover:text-white transition-colors shadow-sm disabled:opacity-50">
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />} Download All
                </button>
              </div>
            )}
            {['list', 'images', 'rendered'].includes(activeView) && (
              <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
                {isHighVolume && (
                  <div className="hidden xl:flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 animate-pulse"> <AlertTriangle className="w-3.5 h-3.5" /> High volume (100+) </div>
                )}
                <button onClick={handleGenerateClick} disabled={isGenerating || generationCount === 0} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${isHighVolume ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                  {isGenerating ? 'Generating...' : `Generate (${generationCount})`}
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (<div className="bg-red-50 border-b border-red-100 px-8 py-3 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>)}
        {isLoadingAll && (<div className="bg-indigo-50 border-b border-indigo-100 px-8 py-3 flex items-center gap-4 text-sm text-indigo-900 animate-fade-in"><Loader2 className="w-4 h-4 animate-spin" /><span className="font-medium">{loadingStatus}</span></div>)}
        
        {isGenerating && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-4 flex flex-col justify-center text-sm text-indigo-900 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-indigo-800">
                {generationPhase === 'preparing' ? 'Downloading & Caching Images...' : 'Generating Variations...'}
              </span>
              <span className="font-mono text-xs font-medium bg-white px-2 py-1 rounded border border-indigo-100 shadow-sm text-indigo-600">
                {generationPhase === 'preparing' 
                  ? `${generationProgress.current} / ${generationProgress.total} Cached`
                  : `${generationProgress.current} / ${generationCount} Rendered`
                }
              </span>
            </div>
            <div className="h-2 bg-indigo-200/50 rounded-full overflow-hidden w-full relative">
              <div 
                className={`h-full shadow-sm transition-all duration-300 ease-out ${generationPhase === 'preparing' ? 'bg-indigo-400' : 'bg-indigo-600'}`} 
                style={{ width: `${Math.min(100, (generationProgress.current / Math.max(generationProgress.total, 1)) * 100)}%` }} 
              />
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden relative">
          {activeView === 'list' && (
            <div className="flex-1 flex overflow-hidden">
              {components.length > 0 && (
                <div className="w-64 bg-gray-50/50 border-r border-gray-200 overflow-y-auto custom-scrollbar flex-shrink-0">
                  <div className="p-4">
                    <nav className="space-y-1">
                      <button onClick={() => { setSelectedSet('all'); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${selectedSet === 'all' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}> <Layers className="w-3.5 h-3.5" /> All </button>
                      <div className="pt-2"></div>
                      {componentSets.map(set => (
                        <button key={set} onClick={() => { setSelectedSet(set); }} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${selectedSet === set ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}> <Layout className="w-3.5 h-3.5" /> {set} </button>
                      ))}
                    </nav>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto p-8">
                {isLoadingAll ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500"> <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-500" /> <p>Scanning Library...</p> </div>
                ) : components.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl"> <p>No components found.</p> <p className="text-sm">Check your configuration or the Figma file content.</p> </div>
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
          )}

          {activeView === 'images' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
              <div className="bg-white border-b border-gray-200 px-8 py-4 z-30 shadow-sm">
                <div className="flex items-center gap-3">
                  
                  {sortedFolders.length > 1 && (
                    <>
                      <div className="flex items-center gap-2 mr-4 text-gray-400">
                        <Filter className="w-4 h-4" />
                        <span className="text-sm font-medium">Filters</span>
                      </div>
                      
                      <MultiSelectFilter 
                        label="Categories" 
                        options={sortedFolders} 
                        selectedSet={libraryFolderFilter} 
                        onToggle={toggleLibraryFolderFilter} 
                      />
                    </>
                  )}
                  
                  <div className={`${sortedFolders.length > 1 ? 'ml-auto' : ''} flex items-center gap-3 text-xs text-gray-400`}>
                     <span>{filteredImages.length} images shown</span>
                     {selectedImageIds.size > 0 && (
                        <span className="font-medium text-indigo-600">({selectedImageIds.size} selected)</span>
                     )}
                  </div>
                </div>

                {sortedFolders.length > 1 && (
                  <ActiveFiltersChips 
                    filters={libraryActiveFiltersList} 
                    onRemove={handleRemoveLibraryFilter} 
                    onClearAll={() => {
                      setLibraryFolderFilter(new Set());
                      setCurrentLibraryPage(1);
                    }}
                  />
                )}
              </div>

              <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                {isLoadingAll ? (
                    <div className="flex flex-col items-center justify-center h-40"> <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mb-2" /> <p className="text-xs text-gray-400">Fetching from API...</p> </div>
                ) : (
                    <div>
                      {filteredImages.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl"> <Folder className="w-8 h-8 mb-2 text-gray-300" /> <p>No images found matching filters.</p> </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 mb-8">
                            {paginatedLibraryImages.map((asset) => {
                              const isSelected = selectedImageIds.has(asset.id);
                              return (<ImageCard key={asset.id} asset={asset} isSelected={isSelected} toggleSelection={toggleImageSelection} setPreviewItem={setPreviewItem} />);
                            })}
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
                  )}
              </div>
            </div>
          )}

          {activeView === 'rendered' && (
            <div className="flex-1 flex overflow-hidden relative">
              <div className="w-64 bg-gray-50/50 border-r border-gray-200 overflow-y-auto custom-scrollbar flex-shrink-0">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3"> <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Templates</h3> </div>
                  {templates.length === 0 ? (<div className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">No templates loaded.<br />Check "Campaign Assets"</div>) : (
                    <nav className="space-y-1">
                      <div className="flex items-center justify-between px-2 mb-2"> <span className="text-[10px] text-gray-400">{selectedTemplateIds.size} Selected</span> <button onClick={() => setSelectedTemplateIds(new Set(templates.map(t => t.id)))} className="text-[10px] text-indigo-600 hover:underline">Select All</button> </div>
                      {templates.map(tpl => {
                        const isSelected = selectedTemplateIds.has(tpl.id);
                        return (
                          <div key={tpl.id} onClick={() => toggleTemplateSelection(tpl.id)} className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer select-none ${isSelected ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
                            <div className="shrink-0"> {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />} </div> <span className="truncate">{tpl.name}</span>
                          </div>
                        )
                      })}
                    </nav>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-gray-100 overflow-hidden relative">
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 p-1.5 rounded-lg shadow-sm">
                  <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-1 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100"> <ZoomOut className="w-4 h-4" /> </button>
                  <span className="text-xs font-mono w-12 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="p-1 text-gray-500 hover:text-gray-800 rounded hover:bg-gray-100"> <ZoomIn className="w-4 h-4" /> </button>
                </div>
                <div className="w-full h-full overflow-auto p-12 bg-gray-100 custom-scrollbar">
                  {selectedTemplatesList.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-16 transition-all duration-200 ease-out" style={{ width: '100%' }}>
                      {selectedTemplatesList.map((template, tIndex) => {
                        const bgStyle = (() => {
                          if (template.backgroundColor) { return { backgroundColor: figmaColorToCss(template.backgroundColor) }; }
                          if (!template.fills) return { backgroundColor: '#FFFFFF' };
                          const fill = template.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
                          return { backgroundColor: fill && fill.color ? figmaColorToCss(fill.color, fill.opacity ?? 1) : '#FFFFFF' };
                        })();
                        return (
                          <div key={template.id} className="relative group transition-all duration-200" style={{ width: template.width * zoom, height: template.height * zoom }}>
                            <div className="relative shadow-2xl overflow-hidden bg-white origin-top-left" style={{ width: template.width, height: template.height, transform: `scale(${zoom})`, ...bgStyle }}>
                              {template.layers.map((layer, index) => {
                                const isImage = isPlaceholderImage(layer);
                                let vpsAsset = null;
                                if (isImage) {
                                  if (selectedImageIds.size > 0) {
                                    const selected = displayAssets.filter(a => selectedImageIds.has(a.id));
                                    vpsAsset = selected[index % selected.length];
                                  } else if (displayAssets.length > 0) { vpsAsset = displayAssets[index % displayAssets.length]; }
                                }
                                const matchedComponent = !vpsAsset ? findComponentForLayer(layer, componentMap, components) : null;
                                return (
                                  <div key={layer.id} title={`Layer: ${layer.name}\nID Ref: ${layer.componentId || 'None'}\nMatch: ${matchedComponent ? matchedComponent.name : 'None'}`} style={layer.type === 'TEXT' ? getTextStyle(layer) : getLayerStyle(layer)}>
                                    {vpsAsset ? (<img src={vpsAsset.thumbnailLink} alt={vpsAsset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />) : matchedComponent ? (<img src={matchedComponent.thumbnailUrl} alt={matchedComponent.name} className="w-full h-full" />) : layer.type === 'TEXT' ? (<span>{layer.characters}</span>) : ['RECTANGLE', 'FRAME', 'GROUP', 'VECTOR', 'ELLIPSE', 'STAR', 'LINE', 'REGULAR_POLYGON'].includes(layer.type) ? (<>{layer.fillImageUrl ? (<img src={layer.fillImageUrl} alt={layer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />) : null}</>) : (<div className="w-full h-full flex flex-col items-center justify-center"> {(!layer.fills || layer.fills.length === 0) && (<span className="text-[6px] text-gray-400 opacity-50 p-1 border border-dashed border-gray-300"> {layer.name} </span>)} </div>)}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (<div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-sm"> <Square className="w-12 h-12 mb-4 text-gray-300" /> <p>No templates selected.</p> <p className="text-xs text-gray-400 mt-1">Select templates from the sidebar to preview.</p> </div>)}
                </div>
              </div>
            </div>
          )}

          {activeView === 'generated' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
                <div className="bg-white border-b border-gray-200 px-8 py-4 z-30 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 mr-4 text-gray-400">
                            <Filter className="w-4 h-4" />
                            <span className="text-sm font-medium">Filters</span>
                        </div>

                        <MultiSelectFilter 
                            label="Templates" 
                            options={uniqueTemplates} 
                            selectedSet={generatedTemplateFilter} 
                            onToggle={toggleGeneratedTemplateFilter} 
                        />

                        {uniqueGeneratedFolders.length > 0 && (
                            <MultiSelectFilter 
                                label="Images" 
                                options={uniqueGeneratedFolders} 
                                selectedSet={generatedFolderFilter} 
                                onToggle={toggleGeneratedFolderFilter} 
                            />
                        )}

                        <div className="h-8 w-px bg-gray-200 mx-2"></div>

                        {Object.entries(generatedFilterData.groups).map(([setName, data]) => (
                            <MultiSelectFilter 
                                key={setName}
                                label={setName} 
                                options={Array.from(data.variants.keys())} 
                                selectedSet={generatedFilter} 
                                onToggle={toggleGeneratedFilter} 
                            />
                        ))}
                    </div>

                    <ActiveFiltersChips 
                        filters={activeFiltersList} 
                        onRemove={handleRemoveFilter} 
                        onClearAll={() => {
                            setGeneratedFilter(new Set());
                            setGeneratedTemplateFilter(new Set());
                            setGeneratedFolderFilter(new Set());
                        }}
                    />
                </div>

                <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                    {generatedImages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Sparkles className="w-12 h-12 mb-4 text-gray-300" />
                            <p>No assets generated yet.</p>
                            <button 
                                onClick={() => setActiveView('rendered')} 
                                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                Go to Templates & Generate
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 mb-8">
                                {paginatedImages.map(img => {
                                    const isSelected = selectedGeneratedImageIds.has(img.id);
                                    
                                    const offerName = img.componentNames.find(name => {
                                        const comp = components.find(c => c.name === name);
                                        return comp?.componentSetName?.includes('Offer');
                                    });

                                    return (
                                        <div key={img.id} className={`group bg-white rounded-lg shadow-sm overflow-hidden border transition-all hover:shadow-md relative ${isSelected ? 'ring-2 ring-indigo-500 border-transparent' : 'border-gray-200'}`}>
                                            <div className="bg-gray-100 aspect-square relative overflow-hidden">
                                                <img src={img.url} alt={img.componentName} className="w-full h-full object-contain" />
                                                
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                                <div onClick={() => toggleGeneratedImageSelection(img.id)} className="absolute top-2 left-2 cursor-pointer p-1 bg-white/80 rounded hover:bg-white shadow-sm backdrop-blur-sm z-10"> 
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 bg-white'}`}> 
                                                        {isSelected && <Check className="w-3 h-3 text-white" />} 
                                                    </div> 
                                                </div>
                                                
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-[10px] bg-black/70 text-white px-2 py-1 rounded-full backdrop-blur-md">
                                                        {img.templateName.substring(0, 15)}...
                                                    </span>
                                                </div>

                                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-white/95 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform duration-200 flex items-center justify-between border-t border-gray-100">
                                                    <button onClick={() => downloadImage(img.url, getDownloadFilename(img))} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Download"> <Download className="w-4 h-4" /> </button>
                                                    <button onClick={() => setPreviewItem({ name: img.componentName, thumbnailUrl: img.url, description: img.templateName })} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Zoom"> <Maximize2 className="w-4 h-4" /> </button>
                                                    <button onClick={() => removeGeneratedImage(img.id)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete"> <Trash2 className="w-4 h-4" /> </button>
                                                </div>
                                            </div>
                                            
                                            <div className="p-3 flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-medium text-gray-900 truncate" title={img.templateName}>
                                                        {img.templateName}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                                        {img.folder || 'Uncategorized'}
                                                    </p>
                                                </div>
                                                
                                                {offerName && (
                                                    <div className="shrink-0 max-w-[50%] flex items-center">
                                                        <span 
                                                            className="inline-block truncate max-w-full px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-medium"
                                                            title={offerName}
                                                        >
                                                            {offerName}
                                                        </span>
                                                    </div>
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
          )}

          {activeView === 'json' && <JsonViewer data={manifest} />}
          {activeView === 'json_images' && <JsonViewer data={rawImagesPayload} />}
          
          {/* NEW INLINE CONFIGURATION PANEL */}
          {showSettings && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-50 animate-slide-in flex flex-col border-l border-gray-200">
               <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                 <h3 className="font-bold text-gray-900">Configuration</h3>
                 <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:bg-gray-100 p-1 rounded-full transition-colors">
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
                     if (!figmaFileId.trim()) { 
                         setError("Figma File ID is required."); 
                         return; 
                     }
                     if (!imageFolder.trim()) { 
                         setError("Image Folder Name is required."); 
                         return; 
                     }
                     localStorage.setItem('figma_file_key', figmaFileId.trim());
                     localStorage.setItem('image_folder_key', imageFolder.trim());
                     setShowSettings(false);
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
                 <SettingsPanel onClose={() => setShowSettings(false)} showDevTools={showDevTools} setShowDevTools={setShowDevTools} />
               </div>
            </div>
          )}
          
          {showDownloadWarning && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-full shrink-0"> <AlertTriangle className="w-6 h-6" /> </div>
                    <div> <h3 className="text-lg font-bold text-gray-900 mb-2">Large Download Warning</h3> <p className="text-sm text-gray-600 leading-relaxed">You are about to download <strong>{(pendingDownloadSubset || generatedImages).length}</strong> high-resolution images.</p> <p className="text-sm text-gray-600 leading-relaxed mt-2">This process may take a significant amount of time. Please <strong>do not refresh the page</strong> until the download prompt appears.</p> </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
                  <button onClick={() => { setShowDownloadWarning(false); setPendingDownloadSubset(undefined); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={() => { setShowDownloadWarning(false); processZipDownload(pendingDownloadSubset); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Proceed</button>
                </div>
              </div>
            </div>
          )}

          {showGenerationWarning && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full shrink-0"> <Sparkles className="w-6 h-6" /> </div>
                    <div> <h3 className="text-lg font-bold text-gray-900 mb-2">Generate {generationCount} Assets?</h3> <p className="text-sm text-gray-600 leading-relaxed"> You are about to generate a large batch of images. This process runs entirely in your browser. </p> <ul className="mt-3 space-y-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100"> <li className="flex items-start gap-2"> <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" /> <span>It may take a few minutes to complete.</span> </li> <li className="flex items-start gap-2"> <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" /> <span className="font-medium text-gray-900">Do not close or refresh this tab.</span> </li> </ul> </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
                  <button onClick={() => setShowGenerationWarning(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"> Cancel </button>
                  <button onClick={() => { setShowGenerationWarning(false); executeGeneration(); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"> <Play className="w-3.5 h-3.5 fill-current" /> Start Generation </button>
                </div>
              </div>
            </div>
          )}

          {previewItem && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8 animate-fade-in backdrop-blur-sm" onClick={() => setPreviewItem(null)}>
              <div className="relative flex flex-col items-center justify-center max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setPreviewItem(null)} className="absolute -top-12 right-0 md:top-0 md:-right-16 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"> <X className="w-8 h-8" /> </button>
                <div className="relative group"> <img src={previewItem.thumbnailUrl} alt={previewItem.name} className="max-w-full max-h-[80vh] rounded shadow-2xl object-contain" style={{ backgroundColor: '#1e1e1e' }} referrerPolicy="no-referrer" /> </div>
                <div className="mt-4 text-white text-center"> <h3 className="font-semibold">{previewItem.name}</h3> {previewItem.description && <p className="text-sm text-gray-400">{previewItem.description}</p>} </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } } .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes fade-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } } .animate-fade-in { animation: fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); }`}</style>
    </div>
  );
};

export default App;