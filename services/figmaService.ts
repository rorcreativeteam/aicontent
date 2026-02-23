import { ComponentMetadata, FigmaConfig, FigmaPage, FigmaFile, Template, TemplateLayer, ComponentTextLayer, HeadlessManifest, DriveAsset } from '../types';

// PROXY_URL is only used for direct client-side calls (local dev with manual token)
const PROXY_URL = 'https://corsproxy.io/?'; 
const BASE_URL = 'https://api.figma.com/v1';
const HARDCODED_PROJECT_ID = '518543293';

// NEW STATIC ENDPOINTS
const getStaticManifestUrl = (fileId: string) => `https://sfo3.digitaloceanspaces.com/aimedia-json/manifests/${fileId}.json`;
const STATIC_IMAGES_URL = 'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-294823dc-1cb3-4d21-8544-5a627fcc174e/default/fetch-images';
const STATIC_PROJECTS_URL = 'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-294823dc-1cb3-4d21-8544-5a627fcc174e/default/fetch-figma-projectid';
const STATIC_IMAGE_FOLDERS_URL = 'https://faas-sfo3-7872a1dd.doserverless.co/api/v1/web/fn-294823dc-1cb3-4d21-8544-5a627fcc174e/default/fetch-images-folderid';

// Simplified Env Getter
export const getEnv = (key: string): string => {
    try {
        if (typeof window !== 'undefined' && (window as any).env && (window as any).env[key]) {
            return (window as any).env[key];
        }
    } catch (e) {}

    try {
        // @ts-ignore
        if (import.meta && import.meta.env) {
            // @ts-ignore
            return import.meta.env[key] || import.meta.env[`VITE_${key}`] || '';
        }
    } catch (e) {}
    
    return '';
};

export const getFigmaConfig = (): FigmaConfig => {
  const pagesStored = localStorage.getItem('figma_selected_pages');
  
  // Priority: Env (Production) > LocalStorage (Manual Override) > Empty
  const token = getEnv('FIGMA_ACCESS_TOKEN') || localStorage.getItem('figma_pat');
  const fileKey = getEnv('FIGMA_FILE_KEY') || localStorage.getItem('figma_file_key');

  return {
    personalAccessToken: token || '', 
    projectId: HARDCODED_PROJECT_ID,
    fileKey: fileKey || '',
    selectedPageIds: pagesStored ? JSON.parse(pagesStored) : []
  };
};

export const saveFigmaConfig = (config: FigmaConfig) => {
  if (config.personalAccessToken) localStorage.setItem('figma_pat', config.personalAccessToken);
  if (config.fileKey) localStorage.setItem('figma_file_key', config.fileKey);
  localStorage.removeItem('figma_project_id');
  localStorage.setItem('figma_selected_pages', JSON.stringify(config.selectedPageIds));
};

// --- HELPER: RECURSIVE FOLDER PARSING ---
const processRecursive = (node: any, parentPath: string, results: DriveAsset[], indexRef: { count: number }) => {
    if (!node) return;

    const rawName = node.folderName || node.name || 'Untitled';
    const cleanName = rawName.trim();
    
    const pathFromApi = node.fullPath ? node.fullPath.replace(/\/$/, '') : null;
    const fullPath = pathFromApi || (parentPath ? `${parentPath}/${cleanName}` : cleanName);
    
    if (node.images && Array.isArray(node.images)) {
        node.images.forEach((url: string) => {
             if (typeof url !== 'string') return;
             const fileName = url.split('/').pop() || `Image_${indexRef.count}`;
             results.push({
                id: `static_img_${indexRef.count}`,
                name: decodeURIComponent(fileName),
                thumbnailLink: url,
                webContentLink: url,
                mimeType: 'image/jpeg',
                size: 'Unknown',
                folder: cleanName 
             });
             indexRef.count++;
        });
    }

    if (node.subFolders && Array.isArray(node.subFolders)) {
        node.subFolders.forEach((child: any) => {
            processRecursive(child, fullPath, results, indexRef);
        });
    }
};

// --- NEW STATIC FETCHERS ---

export const fetchFigmaProjects = async (): Promise<{id: string, name: string}[]> => {
    try {
        const url = `${STATIC_PROJECTS_URL}?t=${Date.now()}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
        return await res.json();
    } catch (e: any) {
        console.error("Static Projects Error:", e);
        throw e;
    }
};

export const fetchImageFolders = async (): Promise<string[]> => {
    try {
        const url = `${STATIC_IMAGE_FOLDERS_URL}?t=${Date.now()}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`Failed to fetch image folders: ${res.statusText}`);
        const data = await res.json();
        
        if (data.success && data.folders) {
            return data.folders;
        }
        return [];
    } catch (e: any) {
        console.error("Static Image Folders Error:", e);
        throw e;
    }
};

export const fetchStaticManifest = async (): Promise<HeadlessManifest> => {
    const fileId = getFigmaConfig().fileKey;

    if (!fileId) {
        throw new Error("Missing Figma File ID. Please enter it in the Configuration panel.");
    }

    try {
        const url = `${getStaticManifestUrl(fileId)}?t=${Date.now()}`;
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`Manifest not found. Verify your Figma File ID is correct.`);
        }
        return await res.json();
    } catch (e: any) {
        console.error("Static Manifest Error:", e);
        throw e;
    }
};

export const fetchStaticImages = async (): Promise<{ assets: DriveAsset[], raw: any }> => {
    const imageFolder = getEnv('IMAGE_FOLDER_KEY') || localStorage.getItem('image_folder_key');

    if (!imageFolder) {
        throw new Error("Missing Image Folder Name. Please enter it in the Configuration panel.");
    }

    try {
        const url = `${STATIC_IMAGES_URL}?t=${Date.now()}`;
        
        console.log(`[StaticAPI] Fetching URL: ${url} with folder: ${imageFolder}`);
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folder: imageFolder }) 
        });

        if (!res.ok) throw new Error(`Failed to fetch images: ${res.statusText}`);
        const data = await res.json();
        
        const allAssets: DriveAsset[] = [];
        const indexRef = { count: 0 };

        if (data.images && Array.isArray(data.images)) {
             data.images.forEach((url: string) => {
                 if (typeof url !== 'string') return;
                 const fileName = url.split('/').pop() || `Image_${indexRef.count}`;
                 allAssets.push({
                    id: `static_img_${indexRef.count}`,
                    name: decodeURIComponent(fileName),
                    thumbnailLink: url,
                    webContentLink: url,
                    mimeType: 'image/jpeg',
                    size: 'Unknown',
                    folder: 'Root' 
                 });
                 indexRef.count++;
            });
        }

        if (data.subFolders && Array.isArray(data.subFolders)) {
            data.subFolders.forEach((child: any) => {
                processRecursive(child, '', allAssets, indexRef);
            });
        }
        else if (data.folders && Array.isArray(data.folders)) {
             data.folders.forEach((child: any) => {
                processRecursive(child, '', allAssets, indexRef);
            });
        }
        
        return { assets: allAssets, raw: data };
    } catch (e: any) {
        console.error("Static Images Error:", e);
        throw e;
    }
};

// --- EXISTING LEGACY FETCHERS ---
const figmaFetch = async (endpoint: string, token: string) => {
  let url = '';
  let headers: Record<string, string> = {};

  if (token) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const targetUrl = `${BASE_URL}${endpoint}${separator}t=${Date.now()}`;
      url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
      headers['X-Figma-Token'] = token;
  } else {
      const separator = endpoint.includes('?') ? '&' : '?';
      url = `/api/figma-proxy?endpoint=${encodeURIComponent(endpoint + separator + 't=' + Date.now())}`;
  }
  
  try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Figma API Error (${res.status})`);
      return res.json();
  } catch (e: any) {
      console.error("Figma Network/Proxy Error:", e);
      throw new Error(`Network Error: ${e.message}`);
  }
};

export const getProjectFiles = async (projectId: string, token: string): Promise<FigmaFile[]> => {
  try {
    const data = await figmaFetch(`/projects/${projectId}/files`, token);
    return data.files || [];
  } catch (e) { return []; }
};

export const getFigmaPages = async (config: Pick<FigmaConfig, 'personalAccessToken' | 'fileKey'>): Promise<FigmaPage[]> => { return []; };
export const scanFigmaLibrary = async (config: FigmaConfig): Promise<ComponentMetadata[]> => { return []; };
export const fetchTemplates = async (config: FigmaConfig): Promise<Template[]> => { return []; };