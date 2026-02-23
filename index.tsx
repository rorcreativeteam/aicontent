import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill process.env from window.env (injected by server)
// This ensures that libraries expecting process.env (like @google/genai) work in the browser
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || {};
  (window as any).process.env = { 
    ...((window as any).process.env || {}),
    ...((window as any).env || {}) 
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
