import { TemplateLayer, ComponentMetadata } from '../types';

export interface GeneratedImage {
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

export function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (a, b) => a.flatMap(d => b.map(e => [...d, e])),
    [[]]
  );
}

export const extractVariantKey = (name: string): string | null => {
  if (!name) return null;
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const figmaColorToCss = (color: { r: number, g: number, b: number, a: number }, opacity: number = 1) => {
  if (!color) return 'transparent';
  const isIntegerRange = color.r > 1 || color.g > 1 || color.b > 1;
  const r = isIntegerRange ? Math.round(color.r) : Math.round(color.r * 255);
  const g = isIntegerRange ? Math.round(color.g) : Math.round(color.g * 255);
  const b = isIntegerRange ? Math.round(color.b) : Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a * opacity})`;
};

export const findComponentForLayer = (
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

export const isPlaceholderImage = (layer: TemplateLayer): boolean => {
  const name = layer.name.toLowerCase().trim();
  return name === 'hero';
};

export const getDownloadFilename = (img: GeneratedImage) => {
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