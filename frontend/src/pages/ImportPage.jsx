import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Upload, FileText, CheckCircle, AlertCircle, AlertTriangle, 
  ArrowLeft, Loader2, RefreshCw, ChevronDown, ChevronUp, HelpCircle 
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
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState('ALL'); // ALL, IMPORTED, WARNING, ERROR, SKIPPED
  const [expandedRows, setExpandedRows] = useState({});

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api.get('/api/groups/');
        setGroups(res.data);
        // Pre-select group if not set and groups exist
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('group_id', selectedGroupId);

    try {
      const res = await api.post('/api/import/csv/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setReport(res.data);
      toast.success("CSV transactions parsed and audited successfully!");
    } catch (err) {
      const errMsg = err.response?.data?.detail || "An error occurred during file upload.";
      toast.error(errMsg);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setReport(null);
    setExpandedRows({});
  };

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

      {!report ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Uploader Form */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-850 rounded-xl p-8 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 pb-4 border-b border-slate-850">
              <FileText className="w-5 h-5 text-violet-500" />
              Upload Transaction Sheet
            </h3>

            <form onSubmit={handleImport} className="space-y-6">
              {/* Select Group */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
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
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="" disabled>-- Select a Group --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.base_currency})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Select CSV File
                </label>
                <div className="relative border-2 border-dashed border-slate-800 hover:border-violet-500/50 bg-slate-950/30 hover:bg-slate-950/50 transition-all rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-12 h-12 text-slate-500 mb-4" />
                  {file ? (
                    <div>
                      <p className="text-white font-medium text-sm">{file.name}</p>
                      <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-350 text-sm font-medium">Drag & drop your CSV file here, or click to browse</p>
                      <p className="text-slate-500 text-xs mt-1.5">Only comma-separated values (.csv) format is supported</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-850 flex gap-4">
                <button
                  type="submit"
                  disabled={importing || !file || !selectedGroupId}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 disabled:shadow-none transition-all duration-200"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Parsing Anomalies & Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Upload & Process Sheet
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Guidelines/Manual details */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl space-y-6">
            <h4 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-850 pb-3">
              <HelpCircle className="w-5 h-5 text-violet-500" />
              CSV Format Specifications
            </h4>
            <div className="space-y-4 text-xs text-slate-450">
              <p>Your CSV file should contain the following headers (case-insensitive):</p>
              <div className="bg-slate-950 p-3 rounded-lg font-mono text-slate-300 space-y-1 overflow-x-auto">
                <p className="text-violet-400">payer_email,amount,date,currency,description,participants</p>
                <p className="text-slate-500">alice@eg.com,1200,2026-06-12,INR,Dinner split,bob@eg.com;charlie@eg.com</p>
              </div>
              <ul className="list-disc pl-4 space-y-2 text-slate-400">
                <li><strong className="text-slate-350">payer_email</strong>: Email address of the paying member. (Required)</li>
                <li><strong className="text-slate-350">amount</strong>: Positive number representing expense value. (Required)</li>
                <li><strong className="text-slate-350">date</strong>: Date of transaction (YYYY-MM-DD or DD/MM/YYYY). (Required)</li>
                <li><strong className="text-slate-350">currency</strong>: Transaction currency. If mismatch, converted using base rate (USD: 83.5, EUR: 90.2).</li>
                <li><strong className="text-slate-350">description</strong>: Text detailing transaction. Descriptions containing settlement keywords (e.g. `settled`, `paid back`) reclassify as Settlements on-the-fly.</li>
                <li><strong className="text-slate-350">participants</strong>: Semicolon-separated list of participant emails. If left blank, splits equally among all group members.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Report Dashboard */
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Top summary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Rows</p>
              <p className="text-3xl font-extrabold text-white mt-2 font-mono">{report.total_rows}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center">
              <p className="text-xs font-semibold text-emerald-450 uppercase tracking-wider">Imported</p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">{report.imported_count}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center">
              <p className="text-xs font-semibold text-amber-450 uppercase tracking-wider">Warnings</p>
              <p className="text-3xl font-extrabold text-amber-450 mt-2 font-mono">{report.warnings_count}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Skipped</p>
              <p className="text-3xl font-extrabold text-slate-400 mt-2 font-mono">{report.skipped_count}</p>
            </div>
            <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-lg text-center col-span-2 md:col-span-1">
              <p className="text-xs font-semibold text-rose-450 uppercase tracking-wider">Failed / Errors</p>
              <p className="text-3xl font-extrabold text-rose-500 mt-2 font-mono">{report.failed_count}</p>
            </div>
          </div>

          {/* Audit report table logs */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-5 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Import Audit Trail</h3>
                <p className="text-xs text-slate-400 mt-0.5">Audit log for batch <span className="font-mono text-violet-400">{report.import_batch_id}</span></p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {['ALL', 'IMPORTED', 'WARNING', 'SKIPPED', 'ERROR'].map(statusType => {
                  let activeClass = 'bg-violet-600 text-white';
                  let idleClass = 'bg-slate-850 hover:bg-slate-800 text-slate-350 border border-slate-800';
                  
                  return (
                    <button
                      key={statusType}
                      onClick={() => setFilter(statusType)}
                      className={`text-xs font-semibold py-1.5 px-3.5 rounded-lg cursor-pointer transition-all ${filter === statusType ? activeClass : idleClass}`}
                    >
                      {statusType}
                    </button>
                  );
                })}
                <button
                  onClick={resetImport}
                  className="bg-slate-950 hover:bg-slate-900 text-slate-400 border border-slate-850 hover:border-slate-800 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ml-2 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Import Another File
                </button>
              </div>
            </div>

            {/* List */}
            {filteredRows.length === 0 ? (
              <p className="text-slate-400 text-center py-12">No transaction rows match the active status filter.</p>
            ) : (
              <div className="space-y-4">
                {filteredRows.map((r) => {
                  const isExpanded = !!expandedRows[r.row_number];
                  let statusBadgeClass = '';
                  let icon = null;
                  
                  switch (r.status) {
                    case 'IMPORTED':
                      statusBadgeClass = 'bg-emerald-950/40 text-emerald-450 border border-emerald-900/30';
                      icon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
                      break;
                    case 'WARNING':
                      statusBadgeClass = 'bg-amber-950/40 text-amber-450 border border-amber-900/30';
                      icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                      break;
                    case 'SKIPPED':
                      statusBadgeClass = 'bg-slate-950/40 text-slate-400 border border-slate-850/60';
                      icon = <AlertCircle className="w-4 h-4 text-slate-500" />;
                      break;
                    case 'ERROR':
                      statusBadgeClass = 'bg-rose-950/40 text-rose-450 border border-rose-900/30';
                      icon = <AlertCircle className="w-4 h-4 text-rose-450" />;
                      break;
                    default:
                      statusBadgeClass = 'bg-slate-850 text-slate-400';
                  }

                  return (
                    <div key={r.row_number} className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/20 hover:border-slate-800 transition-colors">
                      {/* Accordion Trigger Header */}
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
                          <span className="text-sm font-semibold text-white truncate max-w-sm sm:max-w-md md:max-w-lg">
                            {r.original_data.description || <em className="text-slate-650 font-normal">No description</em>}
                          </span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm text-slate-350">
                            {r.original_data.amount ? `₹${parseFloat(r.original_data.amount).toFixed(2)}` : '-'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>

                      {/* Accordion Content Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-850 bg-slate-950/40 text-sm space-y-4 animate-in slide-in-from-top-1 duration-150">
                          {/* Log description */}
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Action Log / Diagnostics</h5>
                            <p className="text-slate-300 leading-relaxed font-semibold bg-slate-900/40 p-3 rounded border border-slate-850/50">
                              {r.action_taken}
                            </p>
                          </div>

                          {/* Anomalies listed */}
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

                          {/* Errors listed */}
                          {r.errors.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Parsing Errors</h5>
                              <ul className="list-disc pl-5 text-rose-400 text-xs space-y-1">
                                {r.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* Raw Data grid */}
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
