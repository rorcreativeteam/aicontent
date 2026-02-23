import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, RefreshCw, UploadCloud, FileJson, Grid, CheckCircle2, AlertCircle, Box, Sparkles, X, Image as ImageIcon, Search, Tag, Copy, HardDrive, MoreHorizontal, Layers, Layout, Component, Figma, LogIn, Code, ZoomIn, ZoomOut, CheckSquare, Square, Download, Play, Loader2, Archive, Trash2, Maximize2, FileText, Folder, Check, Plus, CheckCircle, Eye, Filter, ChevronDown, ChevronRight, MessageSquare, AlertTriangle, ChevronLeft, Database, LayoutDashboard, ArrowUpRight, Activity, Clock, PieChart } from 'lucide-react';
import SettingsPanel from './components/Controls';
import JsonViewer from './components/AssetCanvas';
import { fetchStaticManifest, fetchStaticImages, getFigmaConfig, getEnv } from './services/figmaService';
import { uploadToCloud, getCloudConfig } from './services/headlessService';
import { analyzeDesignSystem, analyzeComponentVisuals, VisualAnalysisResult } from './services/geminiService';
import { loadGoogleScripts, listDriveFiles, isGoogleApiInitialized } from './services/googleDriveService';
// IMPORT THE SERVICE AND INTERFACE
import { generateImages, GeneratedImage } from './services/imageGenerator'; 
import { ComponentMetadata, HeadlessManifest, SyncLog, GoogleDriveConfig, DriveAsset, Template, TemplateLayer, ComponentTextLayer } from './types';
import JSZip from 'jszip';

// Asset Generation Helper (Fallback)
const generateMockAssets = (count: number): DriveAsset[] => {
  return [];
};

const MOCK_ASSETS = generateMockAssets(0);
const ITEMS_PER_PAGE = 30;

// --- CRITICAL FIX: REMOVED LOCAL "interface GeneratedImage" TO PREVENT CRASH ---

// Optimized Image Card Component with Loading State
const ImageCard = ({ asset, isSelected, toggleSelection, setPreviewItem }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <div
      className={`group relative cursor-pointer rounded-lg transition-all ${isSelected ? 'ring-2 ring-indigo-500 shadow-md transform scale-[1.02]' : 'hover:ring-2 hover:ring-gray-300'}`}
      onClick={() => toggleSelection(asset.id)}
    >
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative">
        {/* Loading Skeleton */}
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

// Helper for Cartesian Product of arrays
function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (a, b) => a.flatMap(d => b.map(e => [...d, e])),
    [[]]
  );
}

// Helper: Extract matching key from component name (Price or Keyword)
const extractVariantKey = (name: string): string | null => {
  // 1. Exact Price Match (e.g. 10.99)
  const priceMatch = name.match(/(\d+\.\d{2})/);
  if (priceMatch) return priceMatch[0];

  // 2. Specific Keyword Match (50cent, freepass)
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (lower.includes('50cent')) return '50cent';
  if (lower.includes('freepass')) return 'freepass';

  return null;
};

// Helper: Convert Figma Color to CSS
const figmaColorToCss = (color: { r: number, g: number, b: number, a: number }, opacity: number = 1) => {
  if (!color) return 'transparent';

  // Detect if color values are likely 0-255 integers (if any component > 1)
  const isIntegerRange = color.r > 1 || color.g > 1 || color.b > 1;

  const r = isIntegerRange ? Math.round(color.r) : Math.round(color.r * 255);
  const g = isIntegerRange ? Math.round(color.g) : Math.round(color.g * 255);
  const b = isIntegerRange ? Math.round(color.b) : Math.round(color.b * 255);

  return `rgba(${r}, ${g}, ${b}, ${color.a * opacity})`;
};

// OPTIMIZED HELPER: Component Finder using Map for O(1) lookup
const findComponentForLayer = (
  layer: TemplateLayer, 
  componentMap: Map<string, ComponentMetadata>, 
  allComponents: ComponentMetadata[] 
): ComponentMetadata | undefined => {
  
  // 1. Direct ID Match (Best Strategy - O(1))
  if (layer.componentId && componentMap.has(layer.componentId)) {
    return componentMap.get(layer.componentId);
  }

  // 2. Clean Name Match (O(1))
  const cleanLayerName = layer.name.replace(/\s+\(\d+\)$/, '').trim();
  if (componentMap.has(cleanLayerName)) {
    return componentMap.get(cleanLayerName);
  }

  // 3. Exact Name Match (O(1))
  if (componentMap.has(layer.name)) {
    return componentMap.get(layer.name);
  }

  // 4. Fuzzy / StartsWith Match (Fallback - O(N))
  // Kept for backward compatibility but used rarely
  return allComponents.find(c => {
    const cNameLower = c.name.toLowerCase();
    const cleanLayerNameLower = cleanLayerName.toLowerCase();
    const baseName = c.name.split(' (')[0].toLowerCase();

    return cNameLower.startsWith(cleanLayerNameLower) ||
      cleanLayerNameLower.startsWith(baseName) ||
      (c.componentSetName && cleanLayerNameLower.includes(c.componentSetName.toLowerCase()));
  });
};

// HELPER: Identify if a layer is intended to be a VPS Image Placeholder
const isPlaceholderImage = (layer: TemplateLayer): boolean => {
  // STRICT MODE: Match "Hero" exactly as requested
  const name = layer.name.toLowerCase().trim();
  return name === 'hero';
};

// HELPER: Generate standardized filename (Regex Fix Applied)
const getDownloadFilename = (img: GeneratedImage) => {
    const safeTemplate = img.templateName.replace(/\s+/g, '_').replace(/[^a-z0-9_-]/gi, '');
    
    let variantPart = '';

    if (img.componentNames && img.componentNames.length > 0) {
        // 1. Find the component that is the "Property" or "Offer"
        const targetComponent = img.componentNames.find(name => 
            name.includes('Property') || name.includes('Offer')
        );

        if (targetComponent) {
            variantPart = targetComponent
                // 1. Remove "Property" or "Offer" AND any trailing index (e.g., "Property 1")
                // This regex matches "Property" followed optionally by spaces and digits
                .replace(/(Property|Offer)(\s+\d+)?/gi, '')
                
                // 2. Remove equals signs (Figma often formats as "Property 1=Value")
                .replace(/=/g, ' ') 
                
                // 3. Standard clean up
                .replace(/_/g, ' ')   // temp replace underscore with space to trim
                .trim()               // trim whitespace
                .replace(/\s+/g, '_'); // replace space back to underscore
        }
    }

    // Clean up the variant string (allow dots for prices like 19.99)
    const safeVariant = variantPart.replace(/[^a-z0-9_.-]/gi, '');
    
    let safeImage = (img.imageName || '').replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/gi, '');
    
    // Remove extension from image if present to prevent double extensions
    safeImage = safeImage.replace(/\.[^/.]+$/, "");
    
    // Filter out empty parts
    const parts = [safeTemplate, safeVariant, safeImage].filter(Boolean);
    return `${parts.join('_')}.png`;
};

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'list' | 'images' | 'json' | 'json_images' | 'rendered' | 'generated'>('dashboard');
  const [showDevTools, setShowDevTools] = useState(false);

  // Loading States
  const [isLoadingAll, setIsLoadingAll] = useState(false); // Global sync loading
  const [loadingStatus, setLoadingStatus] = useState(''); // Text for loading

  const [uploading, setUploading] = useState(false);

  // Data States
  const [components, setComponents] = useState<ComponentMetadata[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [driveAssets, setDriveAssets] = useState<DriveAsset[]>([]);
  const [rawImagesPayload, setRawImagesPayload] = useState<any>(null); // To store the raw fetch response
  const [fetchTimestamp, setFetchTimestamp] = useState<string>(''); // To show when data was fetched

  // Selection States
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // NEW: Image Filtering State
  const [activeImageFolder, setActiveImageFolder] = useState<string>('All');
  const [currentLibraryPage, setCurrentLibraryPage] = useState(1); // Pagination for Library

  // Generated Selection State
  const [selectedGeneratedImageIds, setSelectedGeneratedImageIds] = useState<Set<string>>(new Set());
  const [generatedFilter, setGeneratedFilter] = useState<Set<string>>(new Set());
  const [generatedTemplateFilter, setGeneratedTemplateFilter] = useState<Set<string>>(new Set());
  const [generatedFolderFilter, setGeneratedFolderFilter] = useState<Set<string>>(new Set()); // New Filter for Folders

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

  // Download Warning State
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [pendingDownloadSubset, setPendingDownloadSubset] = useState<GeneratedImage[] | undefined>(undefined);

  // Generation Warning State
  const [showGenerationWarning, setShowGenerationWarning] = useState(false);

  // --- OPTIMIZATION 1: Create Fast Lookup Map ---
  const componentMap = useMemo(() => {
    const map = new Map<string, ComponentMetadata>();
    components.forEach(c => {
      if (c.id) map.set(c.id, c);
      map.set(c.name, c);
      // Index by Clean Name
      const cleanName = c.name.split(' (')[0].trim();
      map.set(cleanName, c);
    });
    return map;
  }, [components]);

  // Prevent accidental tab closure during generation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isGenerating) {
        e.preventDefault();
        e.returnValue = ''; // Legacy support for Chrome
        return ''; // Legacy support for other browsers
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGenerating]);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Load Config (mostly unused for new logic but kept for consistency)
    const loadedDriveConfig = {
      clientId: getEnv('GOOGLE_DRIVE_CLIENT_ID') || localStorage.getItem('google_drive_client_id') || '',
      apiKey: getEnv('GOOGLE_DRIVE_API_KEY') || localStorage.getItem('google_drive_api_key') || '',
      folderId: getEnv('GOOGLE_DRIVE_FOLDER_ID') || localStorage.getItem('google_drive_folder_id') || ''
    };
    setDriveConfig(loadedDriveConfig);
    if (loadedDriveConfig.apiKey && loadedDriveConfig.folderId) setIsDriveConnected(true);

    // 2. Perform Initial Scan (Refresh Everything from new Static Sources)
    handleRefreshSource(loadedDriveConfig);
  }, []);

  // --- MASTER REFRESH FUNCTION ---
  const handleRefreshSource = async (overrideDriveConfig?: GoogleDriveConfig) => {
    setIsLoadingAll(true);
    setError('');
    setLoadingStatus('Connecting to Source...');

    try {
      // --- STEP 1: PARALLEL FETCH NEW SOURCES ---
      setLoadingStatus('Fetching Design & Images...');

      // A. Static Manifest (Figma Data)
      const manifestPromise = fetchStaticManifest();

      // B. Static Images (Replacing Drive)
      // Now returns { assets, raw }
      const imagesPromise = fetchStaticImages();

      // --- STEP 2: WAIT FOR DATA ---
      const [manifestData, imagesResult] = await Promise.all([
        manifestPromise,
        imagesPromise
      ]);

      // --- STEP 3: MAP DATA TO STATE ---

      // 1. Components
      // Convert Record<string, Component> to Array
      const compData = Object.values(manifestData.components) as ComponentMetadata[];
      setComponents(compData);
      if (compData.length > 0) {
        setSelectedComponentIds(new Set(compData.map(c => c.id)));
      }

      // 2. Templates
      const tplData = manifestData.templates || [];
      setTemplates(tplData);

      // AUTO-SELECT LOGIC: Ensure we have a valid template selected
      setSelectedTemplateIds(prev => {
        const validIds = new Set(tplData.map(t => t.id));
        const hasValidSelection = Array.from(prev).some(id => validIds.has(id));

        // If current selection matches new data, keep it
        if (hasValidSelection && prev.size > 0) return prev;

        // Otherwise, default to the first available template
        return tplData.length > 0 ? new Set([tplData[0].id]) : new Set();
      });

      // 3. Drive Assets (Now Static Images)
      setDriveAssets(imagesResult.assets);
      setRawImagesPayload(imagesResult.raw); // Store raw data for debug view
      setFetchTimestamp(new Date().toLocaleTimeString()); // Capture time of fetch

      // AUTO-SELECT: Select the first image by default to prevent "All selected" fallback
      if (imagesResult.assets.length > 0) {
        setSelectedImageIds(new Set([imagesResult.assets[0].id]));
      } else {
        setSelectedImageIds(new Set());
      }

      // 4. Update Manifest State
      setManifest(manifestData);

    } catch (err: any) {
      console.error("Full Refresh Failed", err);
      // Safely handle error message extraction to avoid unknown type errors
      const errorMsg = (err instanceof Error) ? err.message : (typeof err === 'string' ? err : 'Failed to refresh sources.');
      setError(errorMsg);
    } finally {
      setIsLoadingAll(false);
      setLoadingStatus('');
    }
  };

  const handleConnectDrive = () => {
    setShowSettings(true);
  };

  const toggleTemplateSelection = (id: string) => {
    const newSet = new Set(selectedTemplateIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
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

  const handleBulkSelectImages = (shouldSelect: boolean) => {
    // Re-derive filtered images to ensure we only select/deselect what is in the current folder view
    const assets = driveAssets.length > 0 ? driveAssets : MOCK_ASSETS;
    const targetImages = activeImageFolder === 'All'
      ? assets
      : assets.filter(a => (a.folder || 'Uncategorized') === activeImageFolder);

    const newSet = new Set(selectedImageIds);
    targetImages.forEach(asset => {
      if (shouldSelect) {
        newSet.add(asset.id);
      } else {
        newSet.delete(asset.id);
      }
    });
    setSelectedImageIds(newSet);
  };

  const toggleGeneratedImageSelection = (id: string) => {
    const newSet = new Set(selectedGeneratedImageIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
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

  // ... (Rendering Helpers - getLayerStyle, getTextStyle, renderTextLayerOverlay - unchanged) ...
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

  // --- GENERATION COUNT CALCULATOR (For Validation) ---
  const generationCount = useMemo(() => {
    if (selectedTemplateIds.size === 0) return 0;
    const activeTemplates = templates.filter(t => selectedTemplateIds.has(t.id));
    const imageCount = selectedImageIds.size > 0 ? selectedImageIds.size : displayAssets.length; 

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

  // --- DASHBOARD ANALYTICS ---
  const dashboardMetrics = useMemo(() => {
    const totalComponents = components.length;
    const totalImages = driveAssets.length;
    const totalTemplates = templates.length;
    const sessionGenerations = generatedImages.length;
    
    // Calculate "Top Component Sets" for the chart
    const setCounts: Record<string, number> = {};
    components.forEach(c => {
      const set = c.componentSetName || 'Ungrouped';
      setCounts[set] = (setCounts[set] || 0) + 1;
    });
    
    // Sort by count and take top 7 for the chart
    const chartData = Object.entries(setCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 7)
      .map(([name, count]) => ({ name, count }));

    // Find max value for bar scaling
    const maxChartValue = Math.max(...chartData.map(d => d.count), 1);

    return {
      totalAssets: totalComponents + totalImages,
      componentCount: totalComponents,
      imageCount: totalImages,
      templateCount: totalTemplates,
      generatedCount: sessionGenerations,
      chartData,
      maxChartValue
    };
  }, [components, driveAssets, templates, generatedImages]);

  // Get last 5 generated images for "Recent Activity"
  const recentActivity = useMemo(() => {
    return [...generatedImages].reverse().slice(0, 5);
  }, [generatedImages]);

  const generatedFilterData = useMemo(() => {
    const groups: Record<string, { total: number, variants: Map<string, number> }> = {};
    const ungrouped: Map<string, number> = new Map();
    generatedImages.forEach(img => {
      img.componentNames.forEach(name => {
        const comp = components.find(c => c.name === name);
        const setName = comp?.componentSetName;
        if (setName) {
          if (!groups[setName]) { groups[setName] = { total: 0, variants: new Map() }; }
          const group = groups[setName];
          group.total++;
          group.variants.set(name, (group.variants.get(name) || 0) + 1);
        } else { ungrouped.set(name, (ungrouped.get(name) || 0) + 1); }
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

  // --- GENERATION HANDLERS ---
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
    
    // Reset State
    setGeneratedImages([]);
    setSelectedGeneratedImageIds(new Set());
    setGeneratedFilter(new Set());
    setGeneratedTemplateFilter(new Set());
    setGeneratedFolderFilter(new Set());
    setCurrentPage(1);

    const activeTemplates = templates.filter(t => selectedTemplateIds.has(t.id));
    const activeImages = displayAssets.filter(a => selectedImageIds.has(a.id));
    
    // FIX: Fallback to all images if none selected
    const imagesToUse = activeImages.length > 0 ? activeImages : displayAssets; 

    // Calculate Total for Progress Bar
    const totalEstimated = generationCount; 
    setGenerationProgress({ current: 0, total: totalEstimated });
    
    // Give UI a moment to update
    await new Promise(r => setTimeout(r, 50)); 
    setGenerationPhase('generating');

    try {
      // CALL THE SERVICE
      const results = await generateImages({
        templates: activeTemplates,
        images: imagesToUse, 
        components: components,
        componentMap: componentMap,
        selectedComponentIds: selectedComponentIds,
        yieldFreq: 20,
        onProgress: (current) => {
           setGenerationProgress(prev => ({ ...prev, current: current }));
        }
      });

      setGeneratedImages(results);
    } catch (e) {
      console.error("Generation failed", e);
      setError("Generation failed. Check console.");
    } finally {
      setGenerationPhase('idle');
      setIsGenerating(false);
    }
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
  const handleDownloadCsv = () => {
    if (generatedImages.length === 0) return;
    const maxComponents = Math.max(...generatedImages.map(img => img.componentNames.length));
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Template Name", "Variant ID", "Filename", "Preview URL (Public)", "Source Folder", ...Array.from({ length: maxComponents }, (_, i) => `Component ${i + 1}`)];
    csvContent += headers.join(",") + "\r\n";
    generatedImages.forEach(img => {
      const filename = getDownloadFilename(img);
      const safeTemplate = img.templateName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const safeId = img.id.split('_').pop() || '000';
      const storageFilename = `gen_${safeTemplate}_${safeId}.png`;
      const publicUrl = `https://storage.googleapis.com/campaign-assets-prod/${storageFilename}`;
      const row = [`"${img.templateName}"`, img.id, `"${filename}"`, publicUrl, `"${img.folder || ''}"`, ...img.componentNames.map(n => `"${n.replace(/"/g, '""')}"`)];
      csvContent += row.join(",") + "\r\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "campaign_manifest.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getPageTitle = () => {
    switch (activeView) {
      case 'dashboard': return 'Dashboard';
      case 'list': return 'Messaging';
      case 'images': return 'Images';
      case 'json': return 'System Manifest (JSON)';
      case 'json_images': return 'Raw Images Payload (Debug)';
      case 'rendered': return 'Templates'; // Updated Title
      case 'generated': return 'Generation Gallery';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-20 shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <img src="https://rorwebsite.sfo3.cdn.digitaloceanspaces.com/aimedia/activimpact-logo.png" alt="ActivImpact" className="h-8 w-auto object-contain" />
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {/* NEW: Dashboard Item */}
          <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center justify-start text-left whitespace-nowrap gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          
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
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h2>
            
            {/* Total Count Pill for Generation Gallery */}
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
                <button onClick={handleDownloadCsv} disabled={generatedImages.length === 0} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"> <FileText className="w-4 h-4" /> Download CSV </button>
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
        
        {/* GENERATION PROGRESS BANNER */}
        {isGenerating && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-4 flex flex-col justify-center text-sm text-indigo-900 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-indigo-800">
                {generationPhase === 'preparing' ? 'Preparing Assets...' : 'Generating Variations...'}
              </span>
              <span className="font-mono text-xs font-medium bg-white px-2 py-1 rounded border border-indigo-100 shadow-sm text-indigo-600">
                {generationProgress.current} / {generationProgress.total}
              </span>
            </div>
            <div className="h-2 bg-indigo-200/50 rounded-full overflow-hidden w-full">
              <div 
                className="h-full bg-indigo-600 shadow-sm transition-all duration-300 ease-out" 
                style={{ width: `${Math.min(100, (generationProgress.current / Math.max(generationProgress.total, 1)) * 100)}%` }} 
              />
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden relative">
          
          {/* VIEW: DASHBOARD (REAL DATA) */}
          {activeView === 'dashboard' && (
            <div className="flex-1 overflow-auto p-8 bg-gray-50/50">
              <div className="max-w-6xl mx-auto">
                 <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Campaign Overview</h1>
                    <p className="text-sm text-gray-500">Real-time metrics for your current session.</p>
                 </div>

                 {/* Stats Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                   {/* Card 1: Total Assets */}
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-medium text-gray-500">Total Messaging</h3>
                         <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Layers className="w-5 h-5" />
                         </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.componentCount}</div>
                      <div className="text-xs text-gray-400 mt-1">Available components</div>
                   </div>
                   
                   {/* Card 2: Images */}
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-medium text-gray-500">Source Images</h3>
                         <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <ImageIcon className="w-5 h-5" />
                         </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.imageCount}</div>
                      <div className="text-xs text-gray-400 mt-1">Across {sortedFolders.length} folders</div>
                   </div>

                   {/* Card 3: Templates */}
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-medium text-gray-500">Active Templates</h3>
                         <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <Layout className="w-5 h-5" />
                         </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.templateCount}</div>
                      <div className="text-xs text-green-600 flex items-center mt-1">
                         <CheckCircle2 className="w-3 h-3 mr-1" /> {selectedTemplateIds.size} Selected
                      </div>
                   </div>

                   {/* Card 4: Generations */}
                   <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                         <h3 className="text-sm font-medium text-gray-500">Session Output</h3>
                         <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Sparkles className="w-5 h-5" />
                         </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardMetrics.generatedCount}</div>
                      <div className="text-xs text-gray-400 mt-1">Images generated</div>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Dynamic Chart: Component Distribution */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                       <div className="flex items-center justify-between mb-6">
                          <div>
                             <h3 className="text-lg font-semibold text-gray-900">Asset Distribution</h3>
                             <p className="text-sm text-gray-500">Component count by category set</p>
                          </div>
                       </div>
                       
                       {dashboardMetrics.chartData.length > 0 ? (
                         <div className="flex-1 min-h-[250px] flex items-end justify-between gap-4 px-4 pb-2 border-b border-gray-100">
                            {dashboardMetrics.chartData.map((data, i) => {
                                const heightPercent = (data.count / dashboardMetrics.maxChartValue) * 80; // scale to 80% max height
                                return (
                                  <div key={i} className="w-full relative group hover:bg-gray-50 transition-colors flex flex-col justify-end items-center gap-2">
                                     <div 
                                        className="bg-indigo-500 w-full rounded-t-sm transition-all duration-500 hover:bg-indigo-600 relative" 
                                        style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                                     >
                                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded shadow-lg z-10 whitespace-nowrap">
                                          {data.count} items
                                        </div>
                                     </div>
                                     <span className="text-[10px] font-medium text-gray-500 truncate w-full text-center max-w-[60px]" title={data.name}>
                                       {data.name}
                                     </span>
                                  </div>
                                );
                            })}
                         </div>
                       ) : (
                         <div className="h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                            <Database className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">No component data available.</p>
                         </div>
                       )}
                    </div>

                    {/* Real Recent Activity List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                       <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-900">Recent Exports</h3>
                          {generatedImages.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Live</span>}
                       </div>
                       <div className="flex-1 overflow-y-auto max-h-[300px]">
                          {recentActivity.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                               {recentActivity.map((img) => (
                                  <div key={img.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                     <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-200">
                                           <img src={img.url} className="w-full h-full object-cover" alt="thumb" />
                                        </div>
                                        <div className="min-w-0">
                                           <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors" title={img.componentName}>
                                             {getDownloadFilename(img)}
                                           </p>
                                           <p className="text-xs text-gray-500 truncate">{img.templateName}</p>
                                        </div>
                                     </div>
                                  </div>
                               ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center">
                               <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
                                  <Clock className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-medium text-gray-900">No activity yet</h4>
                                <p className="text-xs text-gray-500 mt-1">Generate assets to see them here.</p>
                                <button onClick={() => setActiveView('rendered')} className="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-800">
                                   Go to Templates &rarr;
                                </button>
                            </div>
                          )}
                       </div>
                       {generatedImages.length > 5 && (
                         <div className="p-4 border-t border-gray-100 bg-gray-50">
                            <button onClick={() => setActiveView('generated')} className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
                               View All {generatedImages.length} Files
                            </button>
                         </div>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* VIEW: COMPONENT REGISTRY (LIST) */}
          {activeView === 'list' && (
            <div className="flex-1 flex overflow-hidden">
              {/* COMPONENT SET SIDEBAR */}
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
            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 bg-gray-50/50 border-r border-gray-200 overflow-y-auto custom-scrollbar flex-shrink-0">
                <div className="p-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Folders</h3>
                  <nav className="space-y-1">
                    <button onClick={() => { setActiveImageFolder('All'); setCurrentLibraryPage(1); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeImageFolder === 'All' ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
                      <div className="flex items-center gap-2"> <Folder className="w-3.5 h-3.5" /> <span>All Images</span> </div>
                      <span className="text-[10px] bg-gray-100 px-1.5 rounded-full text-gray-500">{displayAssets.length}</span>
                    </button>
                    <div className="my-2 border-t border-gray-200 mx-2"></div>
                    {sortedFolders.map(folder => {
                      const count = assetsByFolder[folder]?.length || 0;
                      return (
                        <button key={folder} onClick={() => { setActiveImageFolder(folder); setCurrentLibraryPage(1); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeImageFolder === folder ? 'bg-white shadow text-indigo-700' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
                          <div className="flex items-center gap-2 truncate"> <span className="truncate pl-1" title={folder}>{folder}</span> </div>
                          <span className="text-[10px] bg-gray-100 px-1.5 rounded-full text-gray-500">{count}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50/50">
                <div className="px-8 py-3 bg-white border-b border-gray-200 flex items-center gap-2 text-xs text-gray-500 mb-6 sticky top-0 z-10">
                  <HardDrive className="w-4 h-4 text-gray-400" /> <span className="font-medium text-indigo-600 truncate">{activeImageFolder}</span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="text-xs text-gray-400">{filteredImages.length} items</div>
                    {selectedImageIds.size > 0 && (<button onClick={() => setSelectedImageIds(new Set())} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Clear Selection ({selectedImageIds.size})</button>)}
                  </div>
                </div>
                <div className="px-8 pb-8">
                  {isLoadingAll ? (
                    <div className="flex flex-col items-center justify-center h-40"> <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mb-2" /> <p className="text-xs text-gray-400">Fetching from API...</p> </div>
                  ) : (
                    <div>
                      {filteredImages.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl"> <Folder className="w-8 h-8 mb-2 text-gray-300" /> <p>No images found in this folder.</p> </div>
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
            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 bg-gray-50/50 border-r border-gray-200 overflow-y-auto custom-scrollbar flex-shrink-0">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3"> <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Results Filter</h3> <button onClick={() => { setGeneratedFilter(new Set()); setGeneratedTemplateFilter(new Set()); setGeneratedFolderFilter(new Set()); }} className="text-[10px] text-indigo-600 hover:underline">Clear All</button> </div>
                  <div className="mb-6">
                    <button onClick={() => toggleFilterSet('Templates')} className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 mb-2"> <span>Templates</span> {expandedFilterSets.has('Templates') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} </button>
                    {expandedFilterSets.has('Templates') && (
                      <div className="space-y-1 ml-1">
                        {uniqueTemplates.map(tName => (
                          <button key={tName} onClick={() => toggleGeneratedTemplateFilter(tName)} className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${generatedTemplateFilter.has(tName) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <div className={`w-3 h-3 border rounded-sm flex items-center justify-center ${generatedTemplateFilter.has(tName) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}> {generatedTemplateFilter.has(tName) && <Check className="w-2 h-2 text-white" />} </div> <span className="truncate">{tName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {uniqueGeneratedFolders.length > 0 && (
                    <div className="mb-6">
                      <button onClick={() => toggleFilterSet('Folders')} className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 mb-2"> <span>Images</span> {expandedFilterSets.has('Folders') ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} </button>
                      {expandedFilterSets.has('Folders') && (
                        <div className="space-y-1 ml-1">
                          {uniqueGeneratedFolders.map(folderName => (
                            <button key={folderName} onClick={() => toggleGeneratedFolderFilter(folderName)} className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${generatedFolderFilter.has(folderName) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                              <div className={`w-3 h-3 border rounded-sm flex items-center justify-center ${generatedFolderFilter.has(folderName) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}> {generatedFolderFilter.has(folderName) && <Check className="w-2 h-2 text-white" />} </div> <span className="truncate" title={folderName}>{folderName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {Object.entries(generatedFilterData.groups).filter(([setName]) => setName.includes('Offer')).map(([setName, d]) => {
                    const data = d as { total: number, variants: Map<string, number> };
                    return (
                      <div key={setName} className="mb-2">
                        <button onClick={() => toggleFilterSet(setName)} className="flex items-center justify-between w-full text-xs font-semibold text-gray-700 mb-1"> <span className="truncate pr-2" title={setName}>{setName}</span> {expandedFilterSets.has(setName) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} </button>
                        {expandedFilterSets.has(setName) && (
                          <div className="space-y-1 ml-1 border-l-2 border-gray-200 pl-2">
                            {Array.from(data.variants.keys()).map(variantName => {
                              const displayName = variantName.includes('=') ? variantName.split('=')[1] : variantName;
                              return (
                                <button key={variantName} onClick={() => toggleGeneratedFilter(variantName)} className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors ${generatedFilter.has(variantName) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                                  <div className={`w-3 h-3 border rounded-sm flex items-center justify-center ${generatedFilter.has(variantName) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}> {generatedFilter.has(variantName) && <Check className="w-2 h-2 text-white" />} </div> <span className="truncate" title={variantName}>{displayName}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-100 p-8">
                {generatedImages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400"> <Sparkles className="w-12 h-12 mb-4 text-gray-300" /> <p>No assets generated yet.</p> <button onClick={() => setActiveView('rendered')} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Go to Preview & Generate</button> </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
                      {paginatedImages.map(img => {
                        const isSelected = selectedGeneratedImageIds.has(img.id);
                        return (
                          <div key={img.id} className={`group bg-white rounded-lg shadow-sm overflow-hidden border transition-all hover:shadow-md relative ${isSelected ? 'ring-2 ring-indigo-500 border-transparent' : 'border-gray-200'}`}>
                            <div className="bg-gray-100 relative overflow-hidden">
                              <img src={img.url} alt={img.componentName} className="w-full h-full object-contain" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                              <div onClick={() => toggleGeneratedImageSelection(img.id)} className="absolute top-2 left-2 cursor-pointer p-1 bg-white/80 rounded hover:bg-white shadow-sm backdrop-blur-sm"> <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400 bg-white'}`}> {isSelected && <Check className="w-3 h-3 text-white" />} </div> </div>
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-white/90 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform flex items-center justify-between">
                                <button onClick={() => downloadImage(img.url, getDownloadFilename(img))} className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Download"> <Download className="w-4 h-4" /> </button>
                                <button onClick={() => setPreviewItem({ name: img.componentName, thumbnailUrl: img.url, description: img.templateName })} className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Zoom"> <Maximize2 className="w-4 h-4" /> </button>
                                <button onClick={() => removeGeneratedImage(img.id)} className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"> <Trash2 className="w-4 h-4" /> </button>
                              </div>
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
          {showSettings && (<div className="absolute right-0 top-0 bottom-0 shadow-2xl z-50 animate-slide-in"> <SettingsPanel onClose={() => setShowSettings(false)} showDevTools={showDevTools} setShowDevTools={setShowDevTools} /> </div>)}
          
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