
export type CloudProvider = 'digital_ocean' | 'google_cloud' | 'google_sql';

export interface CloudConfig {
  provider: CloudProvider;
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // Specific for Digital Ocean
  // SQL Specific
  sqlHost?: string;
  sqlDatabase?: string;
  sqlUser?: string;
  sqlPassword?: string;
}

export interface FigmaConfig {
  personalAccessToken: string;
  projectId: string;
  fileKey: string;
  selectedPageIds: string[]; // Added for page filtering
}

export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
  folderId: string;
}

export interface DriveAsset {
  id: string;
  name: string;
  thumbnailLink: string;
  webContentLink: string;
  size?: string;
  mimeType: string;
  width?: number;
  height?: number;
  folder?: string; // Added to support folder grouping
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

export interface ComponentTextLayer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: {r: number, g: number, b: number, a: number};
  textAlignHorizontal: string;
  textAlignVertical: string;
}

// The raw object structure we save to the cloud
export interface HeadlessManifest {
  generatedAt: string;
  version: string;
  sourceFile: string;
  totalComponents: number;
  components: Record<string, ComponentMetadata>;
  templates?: Template[];
}

export interface ComponentMetadata {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  width: number;
  height: number;
  thumbnailUrl: string;
  properties: any; // Raw Figma properties
  pageName?: string; // Added for context
  componentSetName?: string; // Added for grouping variants
  textContent?: string; // Added for content analysis
  textLayers?: ComponentTextLayer[]; // Added for visual replacement
}

export interface SyncLog {
  timestamp: Date;
  status: 'success' | 'error';
  message: string;
  itemsProcessed: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
}

export interface FigmaPage {
  id: string;
  name: string;
  category: string; // Added to match usage but not strictly in schema
}

// Rendered View Types
export interface TemplateLayer {
  id: string;
  name: string;
  type: 'COMPONENT' | 'INSTANCE' | 'TEXT' | 'RECTANGLE' | 'FRAME' | 'GROUP' | string;
  x: number;
  y: number;
  width: number;
  height: number;
  characters?: string; // For text nodes
  fills?: any[];
  opacity?: number;
  componentId?: string; // Link to master component
  fillImageUrl?: string; // Added to support static images in templates
  // Typography properties
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
  letterSpacing?: number;
  lineHeightPx?: number;
  imageRef?: string; // From new manifest
}

export interface Template {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: TemplateLayer[];
  fills?: any[]; // To support background colors on the template frame
  backgroundColor?: { r: number, g: number, b: number, a: number, hex?: string }; // Added for new manifest
}
