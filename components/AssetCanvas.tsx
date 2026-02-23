import React from 'react';
import { HeadlessManifest } from '../types';

interface JsonViewerProps {
  data: HeadlessManifest | null;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  if (!data) {
    return (
        <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
            No generated manifest found. Run a sync first.
        </div>
    );
  }

  return (
    <div className="flex-1 bg-[#1e1e1e] overflow-auto custom-scrollbar p-6">
       <h3 className="text-gray-400 text-xs font-mono mb-4 uppercase tracking-wider">
          System.json Preview (Read-Only)
       </h3>
       <pre className="font-mono text-xs text-blue-300 leading-relaxed">
          <code>
            {JSON.stringify(data, null, 2)}
          </code>
       </pre>
    </div>
  );
};

export default JsonViewer;
