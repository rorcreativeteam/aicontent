import { useState, useCallback, useMemo } from 'react';
import { ComponentMetadata, Template, DriveAsset, HeadlessManifest } from '../types';
import { fetchStaticManifest, fetchStaticImages, getEnv } from '../services/figmaService';

export const useFigmaSync = () => {
  const [components, setComponents] = useState<ComponentMetadata[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [driveAssets, setDriveAssets] = useState<DriveAsset[]>([]);
  const [manifest, setManifest] = useState<HeadlessManifest | null>(null);
  const [rawImagesPayload, setRawImagesPayload] = useState<any>(null);
  
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState('');

  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  const handleRefreshSource = useCallback(async (onRequireConfig?: () => void) => {
    setIsLoadingAll(true);
    setError('');
    
    const currentFigmaId = localStorage.getItem('figma_file_key') || getEnv('FIGMA_FILE_KEY');
    const currentImageFolder = localStorage.getItem('image_folder_key') || getEnv('IMAGE_FOLDER_KEY');
    
    if (!currentFigmaId || !currentImageFolder) {
        setError('Missing Configuration. Please provide Figma File ID and Image Folder.');
        setIsLoadingAll(false);
        if (onRequireConfig) onRequireConfig();
        return;
    }

    setLoadingStatus('Fetching Design & Images...');
    try {
      const [manifestData, imagesResult] = await Promise.all([
        fetchStaticManifest(),
        fetchStaticImages()
      ]);

      const compData = Object.values(manifestData.components) as ComponentMetadata[];
      setComponents(compData);
      setSelectedComponentIds(new Set(compData.map(c => c.id)));

      const tplData = manifestData.templates || [];
      setTemplates(tplData);
      setSelectedTemplateIds(prev => tplData.length > 0 ? new Set([tplData[0].id]) : new Set());

      setDriveAssets(imagesResult.assets);
      setRawImagesPayload(imagesResult.raw);
      setSelectedImageIds(imagesResult.assets.length > 0 ? new Set([imagesResult.assets[0].id]) : new Set());
      setManifest(manifestData);

    } catch (err: any) {
      console.error("Full Refresh Failed", err);
      setError(err instanceof Error ? err.message : 'Failed to refresh sources.');
    } finally {
      setIsLoadingAll(false);
      setLoadingStatus('');
    }
  }, []);

  const componentMap = useMemo(() => {
    const map = new Map<string, ComponentMetadata>();
    components.forEach(c => {
      if (c.id) map.set(c.id, c);
      map.set(c.name, c);
      map.set(c.name.split(' (')[0].trim(), c);
    });
    return map;
  }, [components]);

  return {
    components, setComponents,
    templates, setTemplates,
    driveAssets, setDriveAssets,
    manifest, rawImagesPayload,
    isLoadingAll, loadingStatus, error, setError,
    selectedComponentIds, setSelectedComponentIds,
    selectedTemplateIds, setSelectedTemplateIds,
    selectedImageIds, setSelectedImageIds,
    handleRefreshSource, componentMap
  };
};