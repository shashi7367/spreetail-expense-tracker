import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Upload, FileText, CheckCircle, AlertCircle, AlertTriangle, 
  ArrowLeft, Loader2, RefreshCw, ChevronDown, ChevronUp, HelpCircle, Download 
} from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';

const ImportPage = () => {
  const [searchParams] = useSearchParams();
  const initialGroupId = searchParams.get('group_id') || '';

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [file, setFile] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  // Progress & Import states
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL, IMPORTED, WARNING, ERROR, SKIPPED
  const [expandedRows, setExpandedRows] = useState({});
  const [isDragActive, setIsDragActive] = useState(false);

  // Load user groups list
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api.get('/api/groups/');
        setGroups(res.data);
        if (!selectedGroupId && res.data.length > 0) {
          setSelectedGroupId(res.data[0].id.toString());
        }
      } catch (err) {
        toast.error("Failed to load your groups list.");
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [selectedGroupId]);

  // Drag and Drop Event Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
      } else {
        toast.error("Only comma-separated CSV files are supported!");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const toggleRow = (rowNum) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowNum]: !prev[rowNum]
    }));
  };

  // Import handler with animated progress tracking
  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedGroupId) {
      toast.error("Please select a group to import into.");
      return;
    }
    if (!file) {
      toast.error("Please select a CSV file first.");
      return;
    }

    setImporting(true);
    setReport(null);
    setProgress(15);
    setProgressText("Reading transaction sheet stream...");
    
    // Simulate import phases for premium visual experience
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 40) {
          setProgressText("Analyzing schema headers & metadata formats...");
          return prev + 10;
        }
        if (prev < 70) {
          setProgressText("Running duplicate checks & validating negative values...");
          return prev + 8;
        }
        if (prev < 90) {
          setProgressText("Auditing user memberships and resolving foreign keys...");
          return prev + 4;
        }
        return prev;
      });
    }, 350);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('group_id', selectedGroupId);

    try {
      const res = await api.post('/api/import/csv/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      clearInterval(progressInterval);
      setProgress(100);
      setProgressText("Auditing finished! Compiling results...");
      
      setTimeout(() => {
        setReport(res.data);
        toast.success("CSV transactions parsed and audited successfully!");
      }, 550);
    } catch (err) {
      clearInterval(progressInterval);
      setProgress(0);
      setProgressText('');
      const errMsg = err.response?.data?.detail || "An error occurred during file upload.";
      toast.error(errMsg);
      setImporting(false);
    } finally {
      // Delay closing loading screen slightly to make transition smooth
      setTimeout(() => {
        setImporting(false);
      }, 600);
    }
  };

  const resetImport = () => {
    setFile(null);
    setReport(null);
    setExpandedRows({});
    setProgress(0);
    setProgressText('');
  };

  // Download JSON report file
  const handleDownloadReport = () => {
    if (!report) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `import_report_${report.import_batch_id || 'batch'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Calculate Anomalies aggregated summary table
  const computeAnomaliesSummary = (rows) => {
    if (!rows) return [];
    const summary = {};
    const descriptionMap = {
      'ANO-001': { type: 'Duplicate Row', action: 'Skipped duplicate row (ANO-001)' },
      'ANO-002': { type: 'Currency Mismatch', action: 'Converted amount using rate table (ANO-002)' },
      'ANO-003': { type: 'Settlement as Expense', action: 'Reclassified as peer Settlement (ANO-003)' },
      'ANO-004': { type: 'Missing Required Field', action: 'Rejected row (ANO-004)' },
      'ANO-005': { type: 'Future-Dated Transaction', action: 'Imported with warning (ANO-005)' },
      'ANO-006': { type: 'Membership Conflict', action: 'Auto-joined member and imported (ANO-006)' },
      'ANO-007': { type: 'Negative Amount', action: 'Rejected row (ANO-007)' },
      'USER_NOT_FOUND': { type: 'User Not Found', action: 'Rejected row (database constraint)' },
      'DATABASE_SAVE_FAILURE': { type: 'Database Save Failure', action: 'Rejected row (database exception)' }
    };

    rows.forEach(row => {
      row.anomalies.forEach(code => {
        if (!summary[code]) {
          summary[code] = {
            code: code,
            type: descriptionMap[code]?.type || 'Unknown Anomaly',
            count: 0,
            rows: [],
            action: descriptionMap[code]?.action || 'Logged'
          };
        }
        summary[code].count += 1;
        summary[code].rows.push(row.row_number);
      });
    });

    return Object.values(summary);
  };

  const anomaliesSummary = computeAnomaliesSummary(report?.rows);

  const filteredRows = report?.rows?.filter(r => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  }) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100 relative">
      <div className="mb-6">
        <Link to="/groups" className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold">
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Upload className="w-8 h-8 text-violet-500" />
            Bulk Import CSV
          </h1>
          <p className="text-slate-400 mt-1">Upload, audit, and auto-convert currency or auto-join members with transaction sheet processing.</p>
        </div>
      </div>

      {/* Progress & Upload Loader Overlay */}
      {importing && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center shadow-2xl min-h-[400px]">
          <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Processing CSV Import Batch</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-xs">{progressText}</p>
          
          <div className="w-full max-w-md bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div 
              className="bg-violet-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-xs font-mono text-violet-400 font-bold mt-2">{progress}%</span>
        </div>
      )}

      {/* File Upload Zone & Panel */}
      {!importing && !report && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Uploader Form */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-855 rounded-xl p-8 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 pb-4 border-b border-slate-850">
              <FileText className="w-5 h-5 text-violet-500" />
              Upload Transaction Sheet
            </h3>

            <form onSubmit={handleImport} className="space-y-6">
              {/* Select Group */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-2">
                  Destination Expense Group
                </label>
                {loadingGroups ? (
                  <div className="flex items-center gap-2 text-slate-500 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    <span>Loading groups...</span>
                  </div>
                ) : (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                  >
                    <option value="" disabled>-- Select a Group --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.base_currency})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Drag and Drop Zone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-450 mb-2">
                  Select CSV File
                </label>
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all ${
                    isDragActive 
                      ? 'border-violet-500 bg-violet-950/20 shadow-inner' 
                      : 'border-slate-800 hover:border-violet-500/50 bg-slate-950/30 hover:bg-slate-950/40'
                  }`}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className={`w-12 h-12 mb-4 transition-colors ${isDragActive ? 'text-violet-400' : 'text-slate-500'}`} />
                  {file ? (
                    <div>
                      <p className="text-white font-medium text-sm">{file.name}</p>
                      <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-300 text-sm font-medium">Drag & drop your CSV file here, or click to browse</p>
                      <p className="text-slate-500 text-xs mt-1.5">Only comma-separated values (.csv) format is supported</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-850 flex gap-4">
                <button
                  type="submit"
                  disabled={!file || !selectedGroupId}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 disabled:shadow-none transition-all duration-200"
                >
                  <CheckCircle className="w-5 h-5" />
                  Import Transactions
                </button>
              </div>
            </form>
          </div>

          {/* Format Helper Card */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl space-y-6">
            <h4 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-850 pb-3">
              <HelpCircle className="w-5 h-5 text-violet-500" />
              CSV Format Specifications
            </h4>
            <div className="space-y-4 text-xs text-slate-400">
              <p>Your CSV file should contain the following headers (case-insensitive):</p>
              <div className="bg-slate-950 p-3 rounded-lg font-mono text-slate-300 space-y-1 overflow-x-auto">
                <p className="text-violet-400">payer_email,amount,date,currency,description,participants</p>
                <p className="text-slate-500">alice@eg.com,1200,2026-06-12,INR,Dinner split,bob@eg.com;charlie@eg.com</p>
              </div>
              <ul className="list-disc pl-4 space-y-2 text-slate-400">
                <li><strong className="text-slate-300">payer_email</strong>: Email address of the paying member. (Required)</li>
                <li><strong className="text-slate-300">amount</strong>: Positive number representing expense value. (Required)</li>
                <li><strong className="text-slate-300">date</strong>: Date of transaction (YYYY-MM-DD or DD/MM/YYYY). (Required)</li>
                <li><strong className="text-slate-300">currency</strong>: Transaction currency. If mismatch, converted using base rate (USD: 83.5, EUR: 90.2).</li>
                <li><strong className="text-slate-300">description</strong>: Text detailing transaction. Descriptions containing settlement keywords (e.g. `settled`, `paid back`) reclassify as Settlements on-the-fly.</li>
                <li><strong className="text-slate-300">participants</strong>: Semicolon-separated list of participant emails. If left blank, splits equally among all group members.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Import Report Dashboard */}
      {!importing && report && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Rows</p>
              <p className="text-3xl font-extrabold text-white mt-2 font-mono">{report.total_rows}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center border-l-4 border-l-emerald-500">
              <p className="text-xs font-semibold text-emerald-450 uppercase tracking-wider">Imported</p>
              <p className="text-3xl font-extrabold text-emerald-450 mt-2 font-mono">{report.imported_count}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center border-l-4 border-l-slate-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Skipped</p>
              <p className="text-3xl font-extrabold text-slate-350 mt-2 font-mono">{report.skipped_count}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center border-l-4 border-l-amber-500">
              <p className="text-xs font-semibold text-amber-450 uppercase tracking-wider">Warnings</p>
              <p className="text-3xl font-extrabold text-amber-450 mt-2 font-mono">{report.warnings_count}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center border-l-4 border-l-rose-500 col-span-2 md:col-span-1">
              <p className="text-xs font-semibold text-rose-450 uppercase tracking-wider">Failed / Errors</p>
              <p className="text-3xl font-extrabold text-rose-500 mt-2 font-mono">{report.failed_count}</p>
            </div>
          </div>

          {/* Aggregated Anomalies Summary Table */}
          {anomaliesSummary.length > 0 && (
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4 border-b border-slate-850 pb-3">
                Aggregated Anomalies Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-center">Count</th>
                      <th className="py-3 px-4">Triggered Rows</th>
                      <th className="py-3 px-4">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {anomaliesSummary.map((anom, idx) => (
                      <tr key={idx} className="hover:bg-slate-950/20">
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">{anom.code}</td>
                        <td className="py-3.5 px-4 text-white font-semibold">{anom.type}</td>
                        <td className="py-3.5 px-4 text-center text-slate-350 font-mono font-bold bg-slate-950/40">{anom.count}</td>
                        <td className="py-3.5 px-4 text-slate-450 font-mono text-xs">{anom.rows.join(', ')}</td>
                        <td className="py-3.5 px-4 text-slate-300 text-xs italic">{anom.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Trail List with Color Coding */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-5 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Import Audit Trail</h3>
                <p className="text-xs text-slate-450 mt-0.5">Audit log for batch <span className="font-mono text-violet-400">{report.import_batch_id}</span></p>
              </div>

              {/* Action buttons and Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleDownloadReport}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-600/20 transition-all"
                  title="Download full JSON report"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Report
                </button>
                <button
                  onClick={resetImport}
                  className="bg-slate-950 hover:bg-slate-900 text-slate-450 border border-slate-850 hover:border-slate-800 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Import Another File
                </button>
              </div>
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 mb-6 bg-slate-950/60 p-1 rounded-lg w-max border border-slate-850">
              {['ALL', 'IMPORTED', 'WARNING', 'SKIPPED', 'ERROR'].map(statusType => {
                let activeClass = 'bg-slate-800 text-white font-bold shadow';
                let idleClass = 'text-slate-400 hover:text-white';
                
                return (
                  <button
                    key={statusType}
                    onClick={() => setFilter(statusType)}
                    className={`text-xs py-1.5 px-3.5 rounded-md cursor-pointer transition-all ${filter === statusType ? activeClass : idleClass}`}
                  >
                    {statusType}
                  </button>
                );
              })}
            </div>

            {/* Table/List Grid */}
            {filteredRows.length === 0 ? (
              <p className="text-slate-450 text-center py-12">No transaction rows match the active status filter.</p>
            ) : (
              <div className="space-y-3.5">
                {filteredRows.map((r) => {
                  const isExpanded = !!expandedRows[r.row_number];
                  let colorCodeBorder = '';
                  let statusBadgeClass = '';
                  let icon = null;
                  
                  // Color-coded rows: green = imported/success, yellow = warning, red = error, gray = skipped
                  switch (r.status) {
                    case 'IMPORTED':
                      colorCodeBorder = 'border-l-emerald-500 hover:border-emerald-400 bg-emerald-950/5';
                      statusBadgeClass = 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/30';
                      icon = <CheckCircle className="w-4 h-4 text-emerald-450" />;
                      break;
                    case 'WARNING':
                      colorCodeBorder = 'border-l-amber-500 hover:border-amber-400 bg-amber-950/5';
                      statusBadgeClass = 'bg-amber-950/40 text-amber-450 border border-amber-900/30';
                      icon = <AlertTriangle className="w-4 h-4 text-amber-450" />;
                      break;
                    case 'SKIPPED':
                      colorCodeBorder = 'border-l-slate-500 hover:border-slate-400 bg-slate-955/5';
                      statusBadgeClass = 'bg-slate-950/40 text-slate-400 border border-slate-850/60';
                      icon = <AlertCircle className="w-4 h-4 text-slate-500" />;
                      break;
                    case 'ERROR':
                      colorCodeBorder = 'border-l-rose-500 hover:border-rose-450 bg-rose-950/5';
                      statusBadgeClass = 'bg-rose-950/40 text-rose-450 border border-rose-900/30';
                      icon = <AlertCircle className="w-4 h-4 text-rose-450" />;
                      break;
                    default:
                      colorCodeBorder = 'border-l-slate-700 bg-slate-950/10';
                      statusBadgeClass = 'bg-slate-850 text-slate-400';
                  }

                  return (
                    <div 
                      key={r.row_number} 
                      className={`border border-slate-850 border-l-4 rounded-xl overflow-hidden transition-all ${colorCodeBorder}`}
                    >
                      {/* Accordion Row Header */}
                      <div 
                        onClick={() => toggleRow(r.row_number)}
                        className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-slate-500 font-bold bg-slate-900 px-2 py-1 rounded">Row {r.row_number}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1.5 ${statusBadgeClass}`}>
                            {icon}
                            {r.status}
                          </span>
                          <span className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md md:max-w-lg">
                            {r.original_data.description || <em className="text-slate-650 font-normal">No description</em>}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm text-slate-300">
                            {r.original_data.amount ? `₹${parseFloat(r.original_data.amount).toFixed(2)}` : '-'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {/* Accordion Row Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-850/60 bg-slate-950/50 text-sm space-y-4 animate-in slide-in-from-top-1 duration-150">
                          {/* Diagnostics Log */}
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Action Log / Diagnostics</h5>
                            <p className="text-slate-350 leading-relaxed font-semibold bg-slate-900/60 p-3 rounded border border-slate-850/50">
                              {r.action_taken}
                            </p>
                          </div>

                          {/* Anomalies Codes */}
                          {r.anomalies.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Anomaly Codes Detected</h5>
                              <div className="flex flex-wrap gap-2">
                                {r.anomalies.map(code => (
                                  <span key={code} className="text-xs font-bold font-mono px-2 py-1 bg-amber-950/30 text-amber-400 border border-amber-900/40 rounded">
                                    {code}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Failure Errors */}
                          {r.errors.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Parsing Errors</h5>
                              <ul className="list-disc pl-5 text-rose-450 text-xs space-y-1">
                                {r.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* CSV Row Fields */}
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Original CSV Values</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850">
                                <span className="block text-slate-500 font-semibold mb-0.5">Payer Email</span>
                                <span className="font-mono text-slate-300 truncate block" title={r.original_data.payer_email}>{r.original_data.payer_email || '-'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850">
                                <span className="block text-slate-500 font-semibold mb-0.5">Amount</span>
                                <span className="font-mono text-slate-300 block">{r.original_data.amount || '-'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850">
                                <span className="block text-slate-500 font-semibold mb-0.5">Date</span>
                                <span className="font-mono text-slate-300 block">{r.original_data.date || '-'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850">
                                <span className="block text-slate-500 font-semibold mb-0.5">Currency</span>
                                <span className="font-mono text-slate-300 block">{r.original_data.currency || '-'}</span>
                              </div>
                              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-850 col-span-2">
                                <span className="block text-slate-500 font-semibold mb-0.5">Participants / Splits</span>
                                <span className="font-mono text-slate-300 truncate block" title={r.original_data.participants}>{r.original_data.participants || '(All group members)'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPage;
