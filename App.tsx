import React, { useState, useEffect } from 'react';
import { fetchFigmaProjects, fetchImageFolders } from './services/figmaService';
import { useFigmaSync } from './hooks/useFigmaSync';
import { useAssetGenerator } from './hooks/useAssetGenerator';
import { Sidebar } from './components/Sidebar';
import { TopNavBar } from './components/TopNavBar';
import { MessagingView } from './views/MessagingView';
import { ImagesView } from './views/ImagesView';
import { TemplatesView } from './views/TemplatesView';
import { GenerationGalleryView } from './views/GenerationGalleryView';
import { ConfigurationPanel } from './views/ConfigurationPanel';
import JsonViewer from './components/AssetCanvas'; // Reusing your existing component
import { AlertCircle, Loader2, X, AlertTriangle, Sparkles, CheckCircle2, Play } from 'lucide-react';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'list' | 'images' | 'json' | 'json_images' | 'rendered' | 'generated'>('list');
  const [showSettings, setShowSettings] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  
  // Configuration 
  const [figmaFileId, setFigmaFileId] = useState<string>(localStorage.getItem('figma_file_key') || 'zH45M5SvQ8E6G9lwUXW4ny');
  const [imageFolder, setImageFolder] = useState<string>(localStorage.getItem('image_folder_key') || 'Dog_Stop');
  const [availableProjects, setAvailableProjects] = useState<{id: string, name: string}[]>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  const { 
    components, templates, driveAssets, manifest, rawImagesPayload,
    isLoadingAll, loadingStatus, error, setError,
    selectedComponentIds, setSelectedComponentIds,
    selectedTemplateIds, setSelectedTemplateIds,
    selectedImageIds, setSelectedImageIds,
    handleRefreshSource, componentMap
  } = useFigmaSync();

  const {
    isGenerating, generationPhase, generationProgress, generationCount,
    generatedImages, setGeneratedImages, executeGeneration,
    isDownloading, handleDownloadZip, processZipDownload,
    showGenerationWarning, setShowGenerationWarning,
    showDownloadWarning, setShowDownloadWarning, pendingDownloadSubset, setPendingDownloadSubset
  } = useAssetGenerator(templates, components, componentMap, driveAssets, selectedTemplateIds, selectedComponentIds, selectedImageIds);

  const [zoom, setZoom] = useState(0.4);

  useEffect(() => {
    const loadConfigData = async () => {
      try {
        const [projects, folders] = await Promise.all([ fetchFigmaProjects(), fetchImageFolders() ]);
        setAvailableProjects(projects);
        setAvailableFolders(folders);
      } catch (err) { console.error("Failed to load config data", err); }
    };
    loadConfigData();
    handleRefreshSource(() => setShowSettings(true));
  }, [handleRefreshSource]);

  const handleBulkSelectMsg = (shouldSelect: boolean) => {
    const newSet = new Set(selectedComponentIds);
    components.filter(c => !c.name.includes("Generic") && !(c.componentSetName && c.componentSetName.includes("Disclaimer")) && !(c.componentSetName && c.componentSetName.includes("Offer_Wide")))
              .forEach(c => shouldSelect ? newSet.add(c.id) : newSet.delete(c.id));
    setSelectedComponentIds(newSet);
  };

  const handleBulkSelectImg = (shouldSelect: boolean) => {
    // You would pass the active filter view down if you want this to only select filtered, 
    // but globally for now:
    const newSet = new Set(selectedImageIds);
    driveAssets.forEach(a => shouldSelect ? newSet.add(a.id) : newSet.delete(a.id));
    setSelectedImageIds(newSet);
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={setActiveView} showDevTools={showDevTools} onOpenSettings={() => setShowSettings(true)} isGenerating={isGenerating} generatedImageCount={generatedImages.length} />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopNavBar 
            activeView={activeView} 
            generatedCount={generatedImages.length} 
            selectedGeneratedCount={0} // Needs local selection tracking pushed up if needed, or handle inside view
            isGenerating={isGenerating} 
            generationCount={generationCount} 
            isHighVolume={generationCount >= 100} 
            isDownloading={isDownloading}
            onGenerate={() => generationCount >= 100 ? setShowGenerationWarning(true) : executeGeneration()} 
            onDownloadAll={() => handleDownloadZip()} 
            onDownloadSelected={() => {}} // Pass from Gallery state
            onBulkSelectMsg={handleBulkSelectMsg}
            onBulkSelectImg={handleBulkSelectImg}
        />

        {error && (<div className="bg-red-50 border-b border-red-100 px-8 py-3 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>)}
        {isLoadingAll && (<div className="bg-indigo-50 border-b border-indigo-100 px-8 py-3 flex items-center gap-4 text-sm text-indigo-900 animate-fade-in"><Loader2 className="w-4 h-4 animate-spin" /><span className="font-medium">{loadingStatus}</span></div>)}
        
        {isGenerating && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-4 flex flex-col justify-center text-sm text-indigo-900 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-indigo-800">{generationPhase === 'preparing' ? 'Downloading & Caching Images...' : 'Generating Variations...'}</span>
              <span className="font-mono text-xs font-medium bg-white px-2 py-1 rounded border border-indigo-100 shadow-sm text-indigo-600">{generationPhase === 'preparing' ? `${generationProgress.current} / ${generationProgress.total} Cached` : `${generationProgress.current} / ${generationCount} Rendered`}</span>
            </div>
            <div className="h-2 bg-indigo-200/50 rounded-full overflow-hidden w-full relative">
              <div className={`h-full shadow-sm transition-all duration-300 ease-out ${generationPhase === 'preparing' ? 'bg-indigo-400' : 'bg-indigo-600'}`} style={{ width: `${Math.min(100, (generationProgress.current / Math.max(generationProgress.total, 1)) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* VIEW ROUTING */}
        {activeView === 'list' && <MessagingView components={components} selectedComponentIds={selectedComponentIds} toggleComponentSelection={(id) => { const ns = new Set(selectedComponentIds); ns.has(id) ? ns.delete(id) : ns.add(id); setSelectedComponentIds(ns); }} setPreviewItem={setPreviewItem} isLoadingAll={isLoadingAll} handleBulkSelect={handleBulkSelectMsg} />}
        {activeView === 'images' && <ImagesView assets={driveAssets} selectedImageIds={selectedImageIds} toggleImageSelection={(id) => { const ns = new Set(selectedImageIds); ns.has(id) ? ns.delete(id) : ns.add(id); setSelectedImageIds(ns); }} setPreviewItem={setPreviewItem} isLoadingAll={isLoadingAll} />}
        {activeView === 'rendered' && <TemplatesView templates={templates} selectedTemplateIds={selectedTemplateIds} toggleTemplateSelection={(id) => { const ns = new Set(selectedTemplateIds); ns.has(id) ? ns.delete(id) : ns.add(id); setSelectedTemplateIds(ns); }} setSelectedTemplateIds={setSelectedTemplateIds} zoom={zoom} setZoom={setZoom} displayAssets={driveAssets} selectedImageIds={selectedImageIds} componentMap={componentMap} components={components} />}
        {activeView === 'generated' && <GenerationGalleryView generatedImages={generatedImages} setGeneratedImages={setGeneratedImages} components={components} selectedGeneratedImageIds={new Set()} toggleGeneratedImageSelection={() => {}} setPreviewItem={setPreviewItem} setActiveView={setActiveView} />}
        
        {activeView === 'json' && <JsonViewer data={manifest} />}
        {activeView === 'json_images' && <JsonViewer data={rawImagesPayload} />}
        
        {showSettings && <ConfigurationPanel onClose={() => setShowSettings(false)} figmaFileId={figmaFileId} setFigmaFileId={setFigmaFileId} imageFolder={imageFolder} setImageFolder={setImageFolder} availableProjects={availableProjects} availableFolders={availableFolders} handleRefreshSource={() => handleRefreshSource()} setError={setError} showDevTools={showDevTools} setShowDevTools={setShowDevTools} />}

        {/* MODALS */}
        {showDownloadWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-6"> <div className="flex items-start gap-4"> <div className="p-3 bg-amber-100 text-amber-600 rounded-full shrink-0"> <AlertTriangle className="w-6 h-6" /> </div> <div> <h3 className="text-lg font-bold text-gray-900 mb-2">Large Download Warning</h3> <p className="text-sm text-gray-600 leading-relaxed">You are about to download <strong>{(pendingDownloadSubset || generatedImages).length}</strong> high-resolution images. Please do not refresh the page.</p> </div> </div> </div>
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3"> <button onClick={() => { setShowDownloadWarning(false); setPendingDownloadSubset(undefined); }} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button> <button onClick={() => { setShowDownloadWarning(false); processZipDownload(pendingDownloadSubset); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">Proceed</button> </div>
            </div>
          </div>
        )}

        {showGenerationWarning && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
              <div className="p-6"> <div className="flex items-start gap-4"> <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full shrink-0"> <Sparkles className="w-6 h-6" /> </div> <div> <h3 className="text-lg font-bold text-gray-900 mb-2">Generate {generationCount} Assets?</h3> <p className="text-sm text-gray-600 leading-relaxed"> You are about to generate a large batch of images. It may take a few minutes. Do not close this tab. </p></div> </div> </div>
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100"> <button onClick={() => setShowGenerationWarning(false)} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200"> Cancel </button> <button onClick={() => { setShowGenerationWarning(false); executeGeneration(); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg flex items-center gap-2"> <Play className="w-3.5 h-3.5 fill-current" /> Start Generation </button> </div>
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
      <style>{`@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } } .animate-slide-in { animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes fade-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } } .animate-fade-in { animation: fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1); }`}</style>
    </div>
  );
};

export default App;