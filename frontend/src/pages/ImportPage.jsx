import React from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

const ImportPage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Upload className="w-8 h-8 text-violet-500" />
            Bulk Import CSV
          </h1>
          <p className="text-slate-400 mt-1">Upload and audit CSV bulk transactions sheets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
          <Upload className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white">Upload CSV File</h3>
          <p className="text-slate-400 mt-2 max-w-sm mx-auto mb-6">Select a comma-separated values file (.csv) containing columns for amount, currency, splits, and description.</p>
          <button className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-6 rounded-lg cursor-pointer transition-all">
            Choose File
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-violet-500" />
            Recent Batches
          </h3>
          <p className="text-slate-400 text-center py-8">No import logs found.</p>
        </div>
      </div>
    </div>
  );
};

export default ImportPage;
