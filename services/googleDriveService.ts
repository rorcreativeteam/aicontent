

import { DriveAsset, DriveFolder } from '../types';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

export const isGoogleApiInitialized = (): boolean => {
    return gapiInited;
};

export const loadGoogleScripts = (apiKey: string, clientId?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const gapi = (window as any).gapi;
        const google = (window as any).google;

        if (!gapi) {
            reject(new Error("Google API Client (gapi) not found. Check your ad-blocker or internet connection."));
            return;
        }

        // Initialize gapi client
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: apiKey,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                gapiInited = true;
                
                // Initialize Identity Services ONLY if Client ID is provided
                if (clientId && google) {
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: SCOPES,
                        callback: '', // defined at request time
                    });
                    gisInited = true;
                }

                resolve();
            } catch (err: any) {
                console.error("GAPI Init Error", err);
                const msg = err.result?.error?.message || JSON.stringify(err);
                reject(new Error(`Failed to initialize Google API: ${msg}`));
            }
        });
    });
};

export const authenticateGoogle = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject(new Error("Google Client not initialized with Client ID. Check settings."));

        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                reject(resp);
            }
            resolve(resp.access_token);
        };

        const gapi = (window as any).gapi;
        if (gapi.client.getToken() === null) {
            // Prompt the user to select a Google Account and ask for consent to share their data
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // Skip display of account chooser and consent dialog for an existing session
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
};

export const listSubfolders = async (parentFolderId: string): Promise<DriveFolder[]> => {
    const gapi = (window as any).gapi;
    if (!gapiInited || !gapi || !gapi.client || !gapi.client.drive) {
        // Attempting to call without init
        throw new Error("Google Drive API not initialized. Connect first.");
    }

    // Query for folders inside the parent
    const query = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    try {
        const response = await gapi.client.drive.files.list({
            pageSize: 100,
            fields: 'files(id, name)',
            q: query,
            orderBy: 'name'
        });

        const files = response.result.files;
        if (!files) return [];

        return files.map((f: any) => ({
            id: f.id,
            name: f.name
        }));
    } catch (err: any) {
        console.error("Drive Folder List Error:", err);
        throw new Error("Failed to list folders. Check API Key or Permissions.");
    }
};

export const listDriveFiles = async (folderId: string): Promise<DriveAsset[]> => {
    const gapi = (window as any).gapi;
    if (!gapiInited || !gapi || !gapi.client || !gapi.client.drive) {
        throw new Error("Google Drive API not initialized. Please check your API Key in Settings.");
    }

    // QUERY EXPLANATION:
    // 'trashed = false': Don't show deleted items
    // 'mimeType contains image': Only images
    // 'folderId in parents': Only files inside the specific folder
    let query = "mimeType contains 'image/' and trashed = false";
    if (folderId && folderId.trim() !== '') {
        query += ` and '${folderId}' in parents`;
    }

    try {
        const response = await gapi.client.drive.files.list({
            pageSize: 100,
            fields: 'files(id, name, thumbnailLink, webContentLink, size, mimeType, imageMediaMetadata)',
            q: query
        });

        const files = response.result.files;
        if (!files) return [];

        return files.map((f: any) => ({
            id: f.id,
            name: f.name,
            // Replace s220 to get larger thumbnail if possible, or use raw link
            // Using =s3000 to get the highest resolution possible without full download auth issues
            thumbnailLink: f.thumbnailLink ? f.thumbnailLink.replace('=s220', '=s3000') : '', 
            webContentLink: f.webContentLink,
            size: f.size ? `${(parseInt(f.size) / 1024 / 1024).toFixed(2)} MB` : 'Unknown',
            mimeType: f.mimeType,
            width: f.imageMediaMetadata?.width,
            height: f.imageMediaMetadata?.height
        }));

    } catch (err: any) {
        console.error("Drive List Error Raw:", err);
        
        let errorMsg = "Failed to fetch files from Drive.";
        if (err.result && err.result.error) {
            const code = err.result.error.code;
            const message = err.result.error.message;
            
            if (code === 403) {
                errorMsg = `Access Denied (403): ${message}. Ensure the folder is "Anyone with the link" or use Client ID Authentication.`;
            } else if (code === 404) {
                errorMsg = `Not Found (404): The Folder ID '${folderId}' does not exist or you do not have permission to view it.`;
            } else if (code === 400) {
                errorMsg = `Bad Request (400): API Key invalid or Folder ID malformed.`;
            } else {
                errorMsg = `Drive API Error (${code}): ${message}`;
            }
        }
        
        throw new Error(errorMsg);
    }
};
