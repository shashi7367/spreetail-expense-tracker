import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Scan, Upload, FileText, ArrowRight, Save, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';

const CATEGORIES = [
  { value: 'FOOD', label: 'Food & Dining' },
  { value: 'TRAVEL', label: 'Travel & Transport' },
  { value: 'STAY', label: 'Accommodation' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'OTHER', label: 'Other' }
];

const ReceiptScannerPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [selectedPayer, setSelectedPayer] = useState('');

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  
  // Scanned Fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [expenseDate, setExpenseDate] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  
  const [saving, setSaving] = useState(false);

  // Load user groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api.get('/api/groups/');
        setGroups(res.data);
        if (res.data.length > 0) {
          setSelectedGroup(res.data[0].id.toString());
        }
      } catch (err) {
        toast.error("Failed to load your groups.");
      }
    };
    fetchGroups();
  }, []);

  // Load members whenever selected group changes
  useEffect(() => {
    if (!selectedGroup) return;
    const fetchMembers = async () => {
      try {
        const res = await api.get(`/api/groups/${selectedGroup}/`);
        setGroupMembers(res.data.members || []);
        // Default payer to logged in user if member, otherwise first member
        const me = res.data.members.find(m => m.id === JSON.parse(localStorage.getItem('user'))?.id);
        if (me) {
          setSelectedPayer(me.id.toString());
        } else if (res.data.members.length > 0) {
          setSelectedPayer(res.data.members[0].id.toString());
        }
      } catch (err) {
        console.error("Failed to load group members", err);
      }
    };
    fetchMembers();
  }, [selectedGroup]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setScannedResult(null);
    triggerScan(selectedFile);
  };

  const triggerScan = async (selectedFile) => {
    setScanning(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    // Run simulated OCR delay of 2.2 seconds for realistic Premium scanning animation feel
    await new Promise(r => setTimeout(r, 2200));

    try {
      const res = await api.post('/api/ocr/scan/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const data = res.data;
      setScannedResult(data);
      setDescription(data.description || `Receipt scan - ${data.merchant}`);
      setAmount(data.amount?.toString() || '');
      setCategory(data.category || 'OTHER');
      setExpenseDate(data.date || new Date().toISOString().split('T')[0]);
      toast.success("Receipt scanned successfully!");
    } catch (err) {
      toast.error("Failed to extract data from receipt.");
    } finally {
      setScanning(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      processFile(droppedFile);
    } else {
      toast.error("Please drop a valid image file.");
    }
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!selectedGroup) {
      toast.error("Please select a group first.");
      return;
    }
    if (!description || !amount || !expenseDate) {
      toast.error("Please fill in all transaction fields.");
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/expenses/', {
        group: parseInt(selectedGroup),
        paid_by_id: parseInt(selectedPayer),
        amount: parseFloat(amount),
        description,
        category,
        expense_date: expenseDate,
        import_source: 'MANUAL'
      });
      toast.success("Expense logged to group successfully!");
      // Reset scanner
      setFile(null);
      setPreviewUrl('');
      setScannedResult(null);
      setDescription('');
      setAmount('');
      setCategory('OTHER');
      setExpenseDate('');
      
      // Redirect to the group detail page
      navigate(`/groups/${selectedGroup}`);
    } catch (err) {
      const errMsg = err.response?.data?.detail || "Failed to log expense.";
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Scan className="w-8 h-8 text-violet-500" />
          Receipt Scanner (OCR)
        </h1>
        <p className="text-slate-400 mt-1">Upload a billing invoice or receipt image to instantly extract transaction fields using AI.</p>
      </div>

      {!file ? (
        /* Upload Area */
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-800 hover:border-violet-650 bg-slate-900/35 hover:bg-slate-900/60 rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center group shadow-xl"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-violet-600/10 text-violet-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-violet-600/20 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Drag and drop your receipt here</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">Supports JPG, PNG, WebP. Heuristic AI parses billing total, category, and date.</p>
          
          <button className="inline-flex items-center gap-2 bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-800 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
            Choose File
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Split Preview / Form Screen */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left panel: File Preview + Scanning overlay */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            {scanning ? (
              <div className="absolute inset-0 z-10 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-4" />
                <p className="text-sm text-slate-350 font-semibold tracking-wide uppercase">Reading receipt metadata...</p>
                <p className="text-xs text-slate-500 mt-1">Extracting merchant, totals, and splits</p>
                {/* Laser animation */}
                <div className="absolute left-0 right-0 h-1 bg-violet-500/80 shadow-[0_0_15px_#8b5cf6] animate-bounce w-full top-1/4" />
              </div>
            ) : null}

            <img
              src={previewUrl}
              alt="Receipt Preview"
              className="max-h-[450px] object-contain rounded-lg shadow-lg"
            />
            
            {!scanning && scannedResult && (
              <div className="mt-6 w-full border border-slate-800/80 bg-slate-950/45 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-violet-400 mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Raw Text Snippet Detected</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-450 whitespace-pre-wrap leading-relaxed">
                  {scannedResult.extracted_text_snippet}
                </pre>
              </div>
            )}
            
            <button
              onClick={() => { setFile(null); setPreviewUrl(''); setScannedResult(null); }}
              className="mt-4 text-xs text-slate-500 hover:text-rose-400 font-semibold transition-colors cursor-pointer"
            >
              Clear and upload another
            </button>
          </div>

          {/* Right panel: Scanned Result fields form */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-850 pb-3">
              <FileText className="w-5 h-5 text-violet-400" />
              Verify Expense Ledger
            </h3>

            <form onSubmit={handleSaveExpense} className="flex flex-col gap-5">
              {/* Group Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Assign to Group</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-600 rounded-lg px-3 py-2.5 text-sm font-medium text-white outline-none"
                  required
                >
                  <option value="" disabled>Select group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Paid By Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Paid By</label>
                <select
                  value={selectedPayer}
                  onChange={(e) => setSelectedPayer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-600 rounded-lg px-3 py-2.5 text-sm font-medium text-white outline-none"
                  required
                >
                  <option value="" disabled>Select payer...</option>
                  {groupMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.username} ({m.email})</option>
                  ))}
                </select>
              </div>

              {/* Description field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Merchant / Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none"
                  placeholder="e.g. Starbucks Coffee"
                  disabled={scanning}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total amount */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-600 rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                    placeholder="0.00"
                    disabled={scanning}
                    required
                  />
                </div>

                {/* Expense category */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-violet-600 rounded-lg px-3 py-2.5 text-sm font-medium text-white outline-none"
                    disabled={scanning}
                    required
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Expense date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-600 rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                  disabled={scanning}
                  required
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={scanning || saving || !selectedGroup}
                className="mt-4 w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800/50 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving Ledger...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save and File Expense
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScannerPage;
