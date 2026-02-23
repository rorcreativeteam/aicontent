import { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { ComponentMetadata, Template, DriveAsset, TemplateLayer } from '../types';
import { cartesianProduct, extractVariantKey, figmaColorToCss, findComponentForLayer, isPlaceholderImage, getDownloadFilename, GeneratedImage } from '../utils/helpers';

export const useAssetGenerator = (
  templates: Template[],
  components: ComponentMetadata[],
  componentMap: Map<string, ComponentMetadata>,
  displayAssets: DriveAsset[],
  selectedTemplateIds: Set<string>,
  selectedComponentIds: Set<string>,
  selectedImageIds: Set<string>
) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'preparing' | 'generating'>('idle');
  const [isDownloading, setIsDownloading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);
  const [pendingDownloadSubset, setPendingDownloadSubset] = useState<GeneratedImage[] | undefined>(undefined);
  const [showGenerationWarning, setShowGenerationWarning] = useState(false);

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

  const executeGeneration = async () => {
    setIsGenerating(true);
    setGenerationPhase('preparing');
    setGeneratedImages([]);
    
    const activeTemplates = templates.filter(t => selectedTemplateIds.has(t.id));
    const imagesToUse = displayAssets.filter(a => selectedImageIds.has(a.id)); 
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
             components.filter(c => c.name.includes('Offer') || (c.componentSetName && c.componentSetName.includes('Offer')))
                       .forEach(c => { if (c.thumbnailUrl) uniqueImageUrls.add(c.thumbnailUrl); });
           }
           if (original) {
             if (original.componentSetName) {
               components.filter(c => c.componentSetName === original.componentSetName)
                         .forEach(c => { if (c.thumbnailUrl) uniqueImageUrls.add(c.thumbnailUrl); });
             } else if (original.thumbnailUrl) { uniqueImageUrls.add(original.thumbnailUrl); }
           }
           if (likelySetName && likelySetName.length > 0) {
             components.filter(c => c.componentSetName === likelySetName)
                       .forEach(c => { if (c.thumbnailUrl) uniqueImageUrls.add(c.thumbnailUrl); });
           }
        } else if (layer.fillImageUrl) { uniqueImageUrls.add(layer.fillImageUrl); }
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
    setGenerationPhase('generating');
    setGenerationProgress({ current: 0, total: generationCount });

    const results: GeneratedImage[] = [];
    let validImagesGenerated = 0;
    let loopIterations = 0;

    const drawText = (ctx: CanvasRenderingContext2D, layer: TemplateLayer) => {
      ctx.save();
      const fontSize = layer.fontSize || 16;
      ctx.font = `${layer.fontWeight || 400} ${fontSize}px ${layer.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = '#000000';
      if (layer.fills && layer.fills.length > 0) {
        const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
        if (fill && fill.color) ctx.fillStyle = figmaColorToCss(fill.color, fill.opacity ?? 1);
      }
      let drawX = layer.x, drawY = layer.y;
      if (layer.textAlignHorizontal === 'CENTER') { drawX = layer.x + layer.width / 2; ctx.textAlign = 'center'; }
      else if (layer.textAlignHorizontal === 'RIGHT') { drawX = layer.x + layer.width; ctx.textAlign = 'right'; }
      else { ctx.textAlign = 'left'; }
      
      const metrics = ctx.measureText(layer.characters || '');
      if (layer.textAlignVertical === 'CENTER') { drawY = layer.y + (layer.height / 2) + (fontSize / 3); }
      else if (layer.textAlignVertical === 'BOTTOM') { drawY = layer.y + layer.height - (metrics.actualBoundingBoxDescent || 2); }
      else { drawY = layer.y + fontSize; }
      
      ctx.fillText(layer.characters || '', drawX, drawY);
      ctx.restore();
    };

    const drawScaledImage = (ctx: CanvasRenderingContext2D, layer: TemplateLayer, img: HTMLImageElement) => {
        const scale = Math.max(layer.width / img.width, layer.height / img.height);
        const drawW = img.width * scale, drawH = img.height * scale;
        const offsetX = (layer.width - drawW) / 2, offsetY = (layer.height - drawH) / 2;
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
         const original = findComponentForLayer(layer, componentMap, components);
         if (!isPlaceholderImage(layer) && (['INSTANCE', 'COMPONENT'].includes(layer.type) || !!original) && original) {
            let candidates: ComponentMetadata[] = [];
            if (original.componentSetName) {
               const setMembers = components.filter(c => c.componentSetName === original.componentSetName);
               if (original.componentSetName.includes('Offer')) {
                  const targetSetNames = template.name.includes('Template_Long') || template.name.includes('Template_Wide') ? ['Offer_Wide', 'Offer Wide', 'Offer-Wide'] : ['Offer'];
                  const baseOffers = components.filter(c => c.componentSetName === 'Offer');
                  const sourceOffers = baseOffers.filter(c => selectedComponentIds.has(c.id)).length > 0 ? baseOffers.filter(c => selectedComponentIds.has(c.id)) : baseOffers;
                  candidates = sourceOffers.map(source => {
                    if (!targetSetNames.includes('Offer_Wide')) return source;
                    const key = extractVariantKey(source.name);
                    return components.find(c => c.componentSetName && targetSetNames.includes(c.componentSetName) && extractVariantKey(c.name) === key);
                  }).filter(Boolean) as ComponentMetadata[];
               } else {
                  candidates = original.componentSetName.includes("Disclaimer") ? setMembers : (setMembers.filter(c => selectedComponentIds.has(c.id)).length > 0 ? setMembers.filter(c => selectedComponentIds.has(c.id)) : [original]);
               }
            } else { candidates = [original]; }
            if (candidates.length > 0) componentSlots.push({ layerIndex: i, originalId: layer.componentId || '', candidates });
         }
      }

      const combinations = cartesianProduct(componentSlots.map(s => s.candidates));
      const imageLoop = template.layers.some(l => isPlaceholderImage(l)) ? imagesToUse : [null];

      for (const currentImage of imageLoop) {
        for (const combination of combinations) {
          loopIterations++; 
          const offerKey = extractVariantKey(combination.find(c => c.componentSetName?.includes('Offer'))?.name || '');
          const disclaimerKey = extractVariantKey(combination.find(c => c.componentSetName?.includes('Disclaimer'))?.name || '');
          if (offerKey && disclaimerKey && offerKey !== disclaimerKey) {
             if (loopIterations % 20 === 0) await new Promise(r => setTimeout(r, 0));
             continue; 
          }

          if (ctx) {
              canvas.width = template.width; 
              let bgDrawn = false;
              if (template.backgroundColor) {
                ctx.fillStyle = figmaColorToCss(template.backgroundColor);
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                bgDrawn = true;
              } else if (template.fills?.length > 0) {
                const bgFill = template.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
                if (bgFill?.color) {
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
                      const comp = slotIndex !== -1 ? combination[slotIndex] : findComponentForLayer(layer, componentMap, components);
                      if (comp?.thumbnailUrl) {
                          const img = await loadImage(comp.thumbnailUrl);
                          if (img.width > 0) drawScaledImage(ctx, layer, img);
                      }
                      continue;
                  }

                  if (isPlaceholderImage(layer) && currentImage?.thumbnailLink) {
                      const img = await loadImage(currentImage.thumbnailLink);
                      if (img.width > 0) drawScaledImage(ctx, layer, img);
                      continue;
                  }

                  if (layer.type === 'TEXT') { drawText(ctx, layer); }
                  else if (['RECTANGLE', 'FRAME', 'GROUP', 'VECTOR'].includes(layer.type)) {
                      if (layer.fillImageUrl) {
                          const img = await loadImage(layer.fillImageUrl);
                          if (img.width > 0) drawScaledImage(ctx, layer, img);
                      } else if (layer.fills?.length > 0) {
                          const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
                          if (fill?.color) {
                              ctx.fillStyle = figmaColorToCss(fill.color, fill.opacity ?? 1);
                              ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                          }
                      }
                  }
              }
              
              results.push({
                  id: `${template.id}_${Date.now()}_${Math.random()}`,
                  url: canvas.toDataURL('image/png'),
                  templateName: template.name,
                  componentName: 'Generated Asset',
                  componentNames: combination.map(c => c.name),
                  timestamp: Date.now(),
                  folder: currentImage ? (currentImage.folder || 'Uncategorized') : undefined,
                  variantName: combination.map(c => c.name).join('_'),
                  imageName: currentImage ? currentImage.name : undefined
              });
              validImagesGenerated++;
          }
          setGenerationProgress(prev => ({ ...prev, current: validImagesGenerated }));
          if (loopIterations % 20 === 0) await new Promise(r => setTimeout(r, 0));
        }
      }
    }
    setGenerationPhase('idle');
    setGeneratedImages(results);
    setIsGenerating(false);
  };

  const processZipDownload = async (subset?: GeneratedImage[]) => {
    const imagesToZip = subset || generatedImages;
    if (imagesToZip.length === 0) return;
    setIsDownloading(true);
    const zip = new JSZip();
    imagesToZip.forEach((img) => {
      zip.file(getDownloadFilename(img), img.url.replace(/^data:image\/(png|jpg);base64,/, ""), { base64: true });
    });
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a'); link.href = url; link.download = `generated_assets_${new Date().getTime()}.zip`; 
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } finally { setIsDownloading(false); }
  };

  const handleDownloadZip = async (subset?: GeneratedImage[]) => {
    const imagesToZip = subset || generatedImages;
    if (imagesToZip.length === 0) return;
    if (imagesToZip.length > 150) { setPendingDownloadSubset(subset); setShowDownloadWarning(true); return; }
    await processZipDownload(subset);
  };

  return {
    isGenerating, generationPhase, generationProgress, generationCount,
    generatedImages, setGeneratedImages, executeGeneration,
    isDownloading, handleDownloadZip, processZipDownload,
    showGenerationWarning, setShowGenerationWarning,
    showDownloadWarning, setShowDownloadWarning,
    pendingDownloadSubset, setPendingDownloadSubset
  };
};