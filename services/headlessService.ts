
import { CloudConfig, HeadlessManifest } from '../types';

export const getCloudConfig = (): CloudConfig => {
  return {
    provider: (localStorage.getItem('cloud_provider') as any) || 'digital_ocean',
    bucketName: localStorage.getItem('cloud_bucket') || '',
    region: localStorage.getItem('cloud_region') || 'nyc3',
    accessKeyId: localStorage.getItem('cloud_access_key') || '',
    secretAccessKey: localStorage.getItem('cloud_secret_key') || '',
    endpoint: localStorage.getItem('cloud_endpoint') || '',
    // SQL Fields
    sqlHost: localStorage.getItem('cloud_sql_host') || '',
    sqlDatabase: localStorage.getItem('cloud_sql_db') || '',
    sqlUser: localStorage.getItem('cloud_sql_user') || '',
    sqlPassword: localStorage.getItem('cloud_sql_pass') || ''
  };
};

export const saveCloudConfig = (config: CloudConfig) => {
  localStorage.setItem('cloud_provider', config.provider);
  localStorage.setItem('cloud_bucket', config.bucketName);
  localStorage.setItem('cloud_region', config.region);
  localStorage.setItem('cloud_access_key', config.accessKeyId);
  localStorage.setItem('cloud_secret_key', config.secretAccessKey);
  localStorage.setItem('cloud_endpoint', config.endpoint || '');
  
  // Save SQL fields
  localStorage.setItem('cloud_sql_host', config.sqlHost || '');
  localStorage.setItem('cloud_sql_db', config.sqlDatabase || '');
  localStorage.setItem('cloud_sql_user', config.sqlUser || '');
  localStorage.setItem('cloud_sql_pass', config.sqlPassword || '');
};

export const uploadToCloud = async (manifest: HeadlessManifest, config: CloudConfig): Promise<boolean> => {
  // SIMULATION
  
  // Handle SQL Provider
  if (config.provider === 'google_sql') {
      const host = config.sqlHost || 'localhost';
      const db = config.sqlDatabase || 'postgres';
      const user = config.sqlUser || 'admin';
      
      console.log(`[GOOGLE SQL] Connecting to ${host}/${db} as ${user}...`);
      
      // Artificial Latency for connection
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log(`[GOOGLE SQL] Connection established.`);
      console.log(`[GOOGLE SQL] Preparing Batch Insert Transaction...`);
      
      const statement = `
        INSERT INTO components (id, name, width, height, updated_at, properties_json)
        VALUES 
        ${Object.values(manifest.components).slice(0, 3).map(c => `('${c.id}', '${c.name}', ${c.width}, ${c.height}, '${c.updatedAt}', '{...}')`).join(',\n        ')}
        ... and ${manifest.totalComponents - 3} more records;
      `;
      
      console.log(`[GOOGLE SQL] Executing Query: \n${statement}`);
      
      // Artificial Latency for query execution
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      console.log(`[GOOGLE SQL] Transaction Committed Successfully. ${manifest.totalComponents} rows affected.`);
      return true;
  }
  
  // Handle Storage Provider (Existing Logic)
  const isGoogle = config.provider === 'google_cloud';
  
  // Use defaults if missing for simulation purposes
  const finalBucket = config.bucketName || 'demo-design-system';
  const finalKey = config.accessKeyId || 'DEMO-ACCESS-KEY-123';
  
  console.log(`[${isGoogle ? 'GOOGLE CLOUD' : 'DIGITAL OCEAN'}] Connecting to bucket: ${finalBucket}...`);
  console.log(`[${isGoogle ? 'GCS' : 'SPACES'}] Authenticating with Key: ${finalKey.substring(0, 5)}...`);
  
  // Artificial Latency
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Check if we are in pure simulation mode (missing user provided creds)
  if (!config.bucketName || !config.accessKeyId) {
      console.info("NOTE: Running in Simulation Mode with default bucket/keys because some settings were empty.");
  }

  // NOTE: In this simulation, we proceed even if Secret Key is missing if an ID is present,
  // acknowledging the user might only have the ID available for demo purposes.
  if (!config.secretAccessKey) {
      console.warn("WARNING: No Secret Access Key provided. Proceeding in Simulation Mode.");
  }

  const endpoint = isGoogle 
    ? `https://storage.googleapis.com/${finalBucket}/system.json`
    : `https://${finalBucket}.${config.region}.digitaloceanspaces.com/system.json`;

  console.log(`[UPLOAD] Writing manifest to ${endpoint}`);
  console.log("Payload Summary:", {
      total: manifest.totalComponents,
      templates: manifest.templates?.length || 0,
      version: manifest.version,
      timestamp: manifest.generatedAt
  });

  return true;
};
