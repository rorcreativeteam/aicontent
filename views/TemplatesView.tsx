import React from 'react';
import { ZoomIn, ZoomOut, CheckSquare, Square } from 'lucide-react';
import { Template, DriveAsset, ComponentMetadata, TemplateLayer } from '../types';
import { figmaColorToCss, isPlaceholderImage, findComponentForLayer } from '../utils/helpers';

interface TemplatesViewProps {
  templates: Template[];
  selectedTemplateIds: Set<string>;
  toggleTemplateSelection: (id: string) => void;
  setSelectedTemplateIds: (set: Set<string>) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  displayAssets: DriveAsset[];
  selectedImageIds: Set<string>;
  componentMap: Map<string, ComponentMetadata>;
  components: ComponentMetadata[];
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ templates, selectedTemplateIds, toggleTemplateSelection, setSelectedTemplateIds, zoom, setZoom, displayAssets, selectedImageIds, componentMap, components }) => {
  const selectedTemplatesList = templates.filter(t => selectedTemplateIds.has(t.id));

  const getLayerStyle = (layer: TemplateLayer) => {
    const style: React.CSSProperties = { position: 'absolute', left: layer.x, top: layer.y, width: layer.width, height: layer.height, opacity: layer.opacity ?? 1 };
    if (layer.fills && layer.fills.length > 0) {
      const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
      if (fill && fill.color) style.backgroundColor = figmaColorToCss(fill.color, fill.opacity ?? 1);
    }
    return style;
  };

  const getTextStyle = (layer: TemplateLayer) => {
    const style: React.CSSProperties = { fontSize: layer.fontSize ? `${layer.fontSize}px` : '16px', fontFamily: layer.fontFamily || 'sans-serif', fontWeight: layer.fontWeight || 400, color: '#000000', whiteSpace: 'pre-wrap', textAlign: layer.textAlignHorizontal?.toLowerCase() as any || 'left', display: 'flex', alignItems: layer.textAlignVertical === 'CENTER' ? 'center' : layer.textAlignVertical === 'BOTTOM' ? 'flex-end' : 'flex-start' };
    if (layer.fills && layer.fills.length > 0) {
      const fill = layer.fills.find((f: any) => f.visible !== false && f.type === 'SOLID');
      if (fill && fill.color) style.color = figmaColorToCss(fill.color, fill.opacity ?? 1);
    }
    return style;
  };

  return (
    <div className="flex-1 flex overflow-hidden relative">
      <div className="w-64 bg-gray-50/50 border-r border-gray-200 overflow-y-auto custom-scrollbar flex-shrink-0">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3"> <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Templates</h3> </div>
          {templates.length === 0 ? (<div className="text-xs text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">No templates loaded.</div>) : (
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
              {selectedTemplatesList.map((template) => {
                const bgStyle = (() => {
                  if (template.backgroundColor) return { backgroundColor: figmaColorToCss(template.backgroundColor) };
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
                          <div key={layer.id} style={layer.type === 'TEXT' ? getTextStyle(layer) : getLayerStyle(layer)}>
                            {vpsAsset ? (<img src={vpsAsset.thumbnailLink} alt={vpsAsset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />) : matchedComponent ? (<img src={matchedComponent.thumbnailUrl} alt={matchedComponent.name} className="w-full h-full" />) : layer.type === 'TEXT' ? (<span>{layer.characters}</span>) : ['RECTANGLE', 'FRAME', 'GROUP', 'VECTOR'].includes(layer.type) ? (<>{layer.fillImageUrl ? (<img src={layer.fillImageUrl} alt={layer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />) : null}</>) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (<div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-sm"> <Square className="w-12 h-12 mb-4 text-gray-300" /> <p>No templates selected.</p> </div>)}
        </div>
      </div>
    </div>
  );
};