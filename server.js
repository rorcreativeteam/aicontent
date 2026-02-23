import express from 'express';
import path from 'path';
import https from 'https';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 1. Load Environment Variables
dotenv.config();

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

// Helper to safely read env vars
const getCleanEnv = (key) => {
    const val = process.env[key];
    return val ? val.trim() : '';
};

// --- DEPLOYMENT DEBUGGING LOGS ---
console.log("--- SERVER STARTING ---");
console.log(`Port: ${port}`);
console.log("Environment Variable Status (Process.env):");
console.log(`- FIGMA_ACCESS_TOKEN: ${getCleanEnv('FIGMA_ACCESS_TOKEN') ? "✅ Loaded" : "❌ MISSING"}`);
console.log(`- GOOGLE_DRIVE_API_KEY: ${getCleanEnv('GOOGLE_DRIVE_API_KEY') ? "✅ Loaded" : "❌ MISSING"}`);
console.log(`- API_KEY (Gemini): ${getCleanEnv('API_KEY') ? "✅ Loaded" : "❌ MISSING"}`);
console.log(`- FIGMA_FILE_KEY: ${getCleanEnv('FIGMA_FILE_KEY') ? "✅ Loaded" : "❌ MISSING"}`);
console.log("-----------------------");

// PRIORITY 1: Figma API Proxy
app.use('/api/figma-proxy', (req, res) => {
    const figmaToken = getCleanEnv('FIGMA_ACCESS_TOKEN');
    
    if (!figmaToken) {
        console.error("❌ Proxy Error: FIGMA_ACCESS_TOKEN is missing on server.");
        return res.status(500).json({ error: 'Server configuration error: Missing Figma Token.' });
    }

    const endpoint = req.query.endpoint; 
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint parameter' });

    const figmaUrl = `https://api.figma.com/v1${endpoint}`;

    const proxyReq = https.request(figmaUrl, {
        method: req.method,
        headers: {
            'X-Figma-Token': figmaToken,
            'Content-Type': 'application/json'
        }
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error("Figma Proxy Network Error:", e);
        res.status(502).json({ error: 'Failed to reach Figma API' });
    });

    req.pipe(proxyReq, { end: true });
});

// PRIORITY 2: Serve Static Assets
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// PRIORITY 3: Handle React Routing with ROBUST ENV INJECTION
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');

  fs.readFile(indexPath, 'utf8', (err, htmlData) => {
    if (err) {
      console.error('Error reading index.html file', err);
      return res.status(500).send('Error loading application.');
    }

    // Prepare Environment Object
    const env = {
      GOOGLE_DRIVE_API_KEY: getCleanEnv('GOOGLE_DRIVE_API_KEY'),
      GOOGLE_DRIVE_CLIENT_ID: getCleanEnv('GOOGLE_DRIVE_CLIENT_ID'),
      GOOGLE_DRIVE_FOLDER_ID: getCleanEnv('GOOGLE_DRIVE_FOLDER_ID'),
      GOOGLE_DRIVE_PARENT_ID: getCleanEnv('GOOGLE_DRIVE_PARENT_ID'),
      API_KEY: getCleanEnv('API_KEY'),
      FIGMA_FILE_KEY: getCleanEnv('FIGMA_FILE_KEY'),
      FIGMA_ACCESS_TOKEN: getCleanEnv('FIGMA_ACCESS_TOKEN')
    };

    // Create the script string with JSON sanitization
    // We escape < to \u003c to prevent malicious script tag closing injection
    const safeEnv = JSON.stringify(env).replace(/</g, '\\u003c');
    const envScript = `<script>window.env = ${safeEnv}; console.log("[Server Injection] Env injected into window.env");</script>`;

    let injectedHtml = htmlData;
    
    // STRATEGY 1: Inject into <head> (Regex handles <head class="..."> etc)
    if (/<head\b[^>]*>/i.test(htmlData)) {
        injectedHtml = htmlData.replace(/(<head\b[^>]*>)/i, `$1${envScript}`);
        console.log("[Server] Strategy 1: Injected env into <head>");
    } 
    // STRATEGY 2: Inject into <body>
    else if (/<body\b[^>]*>/i.test(htmlData)) {
        injectedHtml = htmlData.replace(/(<body\b[^>]*>)/i, `$1${envScript}`);
        console.log("[Server] Strategy 2: Injected env into <body>");
    }
    // STRATEGY 3: Inject before <div id="root">
    else if (/<div\b[^>]*id=["']root["'][^>]*>/i.test(htmlData)) {
        injectedHtml = htmlData.replace(/(<div\b[^>]*id=["']root["'][^>]*>)/i, `${envScript}$1`);
        console.log("[Server] Strategy 3: Injected env before #root");
    }
    // STRATEGY 4: Inject after <!DOCTYPE html> (Nuclear fallback)
    else if (/<!doctype\s+html>/i.test(htmlData)) {
         injectedHtml = htmlData.replace(/(<!doctype\s+html>)/i, `$1${envScript}`);
         console.log("[Server] Strategy 4: Injected env after Doctype");
    }
    else {
        console.error("[Server] CRITICAL: Could not find ANY insertion point. Appending to start.");
        injectedHtml = envScript + htmlData;
    }

    // Prevent caching of index.html so updates are immediate
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    
    res.send(injectedHtml);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});