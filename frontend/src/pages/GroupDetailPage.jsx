import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Users, Receipt, Plus, Loader2, Trash2, CheckCircle, Upload } from 'lucide-react';

const GroupDetailPage = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(true);
  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [settlingId, setSettlingId] = useState(null);

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'OTHER',
    expense_date: new Date().toISOString().split('T')[0],
  });

  const fetchGroupDetails = async () => {
    try {
      const res = await api.get(`/api/groups/${id}/`);
      setGroup(res.data);
    } catch (err) {
      toast.error("Failed to load group details.");
    } finally {
      setLoadingGroup(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await api.get(`/api/expenses/?group_id=${id}`);
      setExpenses(res.data);
    } catch (err) {
      toast.error("Failed to load expenses.");
    } finally {
      setLoadingExpenses(false);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await api.get(`/api/groups/${id}/balances/`);
      setBalances(res.data);
    } catch (err) {
      toast.error("Failed to load balances sheet.");
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
    fetchExpenses();
    fetchBalances();
  }, [id]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.description.trim() || !expenseForm.amount) {
      toast.error("Please enter a description and amount.");
      return;
    }
    setAddingExpense(true);
    try {
      await api.post('/api/expenses/', {
        group: parseInt(id),
        amount: expenseForm.amount,
        description: expenseForm.description,
        category: expenseForm.category,
        expense_date: expenseForm.expense_date,
      });
      toast.success("Expense added and split equally!");
      setExpenseForm({
        description: '',
        amount: '',
        category: 'OTHER',
        expense_date: new Date().toISOString().split('T')[0],
      });
      setShowAddExpense(false);
      fetchExpenses();
      fetchBalances();
    } catch (err) {
      toast.error("Failed to add expense.");
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense? It will be soft-deleted.")) return;
    try {
      await api.delete(`/api/expenses/${expenseId}/`);
      toast.success("Expense soft-deleted.");
      fetchExpenses();
      fetchBalances();
    } catch (err) {
      toast.error("Failed to delete expense.");
    }
  };

  const handleMarkAsSettled = async (balanceRow) => {
    const debtorId = balanceRow.debtor.id;
    const creditorId = balanceRow.creditor.id;
    const amount = balanceRow.amount;
    
    setSettlingId(`${debtorId}-${creditorId}`);
    try {
      await api.post(`/api/groups/${id}/settle/`, {
        paid_by: debtorId,
        paid_to: creditorId,
        amount: amount,
      });
      toast.success(`Settlement recorded: ${balanceRow.debtor.username} paid ₹${amount.toFixed(2)} to ${balanceRow.creditor.username}`);
      fetchExpenses();
      fetchBalances();
    } catch (err) {
      toast.error("Failed to record settlement.");
    } finally {
      setSettlingId(null);
    }
  };

  if (loadingGroup) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-2" />
        <p className="text-sm text-slate-400">Loading group details...</p>
      </div>
    );
  }

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
            {group?.name}
          </h1>
          <p className="text-slate-400 mt-1">
            Group ID: <span className="font-mono text-violet-400 font-semibold">{id}</span> | Base Currency: {group?.base_currency}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to={`/import?group_id=${id}`}
            className="bg-slate-850 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 cursor-pointer border border-slate-850 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Link>
          <button
            onClick={() => setShowAddExpense(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Expenses List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6 border-b border-slate-850 pb-4">
              <Receipt className="w-5 h-5 text-violet-500" />
              Expenses History ({expenses.length})
            </h3>

            {loadingExpenses ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
              </div>
            ) : expenses.length === 0 ? (
              <p className="text-slate-400 text-center py-12">No active expenses logged in this group. Click Add Expense to create one!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-xs text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Paid By</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-right">My Share</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {expenses.map((e) => {
                      const mySplit = e.splits.find(s => s.user.username === currentUser.username);
                      return (
                        <tr key={e.id} className="hover:bg-slate-950/30">
                          <td className="py-3 px-4 text-slate-400 font-mono text-xs">{e.expense_date}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-white">{e.description}</span>
                            <span className="block text-xs text-slate-500 mt-0.5">{e.category}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-350">{e.paid_by.username === currentUser.username ? 'You' : e.paid_by.username}</td>
                          <td className="py-3 px-4 text-right text-white font-mono">₹{e.amount}</td>
                          <td className="py-3 px-4 text-right text-violet-300 font-mono">
                            {mySplit ? `₹${parseFloat(mySplit.share_amount).toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              className="p-1.5 rounded bg-slate-850 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/30 cursor-pointer transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Members & Balance Sheets */}
        <div className="space-y-6">
          {/* Members list */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-md">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-850 pb-3">
              <Users className="w-4 h-4 text-violet-500" />
              Members List ({group?.members?.length || 0})
            </h3>
            
            <ul className="space-y-3">
              {group?.members?.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-white">{m.username} {m.username === currentUser.username ? '(You)' : ''}</p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Balance sheet */}
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-6 shadow-md">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-850 pb-3">
              <CheckCircle className="w-4 h-4 text-violet-500" />
              Simplified Balances
            </h3>

            {loadingBalances ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
              </div>
            ) : balances.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">All debts are fully settled! 🍻</p>
            ) : (
              <ul className="space-y-4">
                {balances.map((b, idx) => {
                  const key = `${b.debtor.id}-${b.creditor.id}`;
                  const isUserInvolved = b.debtor.id === currentUser.id || b.creditor.id === currentUser.id;
                  
                  return (
                    <li key={idx} className="bg-slate-950/40 border border-slate-850/60 rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
                        <span>
                          <span className="font-semibold text-white">{b.debtor.username === currentUser.username ? 'You' : b.debtor.username}</span>
                          <span className="text-slate-400 text-xs"> owes </span>
                          <span className="font-semibold text-white">{b.creditor.username === currentUser.username ? 'You' : b.creditor.username}</span>
                        </span>
                        <span className="font-mono font-bold text-violet-400">₹{b.amount.toFixed(2)}</span>
                      </div>
                      
                      {isUserInvolved && (
                        <button
                          onClick={() => handleMarkAsSettled(b)}
                          disabled={settlingId === key}
                          className="w-full bg-slate-850 hover:bg-emerald-950/20 text-slate-350 hover:text-emerald-450 border border-slate-800 hover:border-emerald-900/35 py-1 px-3 rounded text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {settlingId === key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                          Mark as Settled
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setShowAddExpense(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Add Group Expense</h3>
              
              <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    placeholder="e.g. WiFi Bill"
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      placeholder="e.g. 90.00"
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={expenseForm.expense_date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="OTHER">Other</option>
                    <option value="FOOD">Food & Dining</option>
                    <option value="TRAVEL">Travel & Transport</option>
                    <option value="STAY">Accommodation</option>
                    <option value="ENTERTAINMENT">Entertainment</option>
                    <option value="UTILITIES">Utilities</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setShowAddExpense(false)}
                    className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold py-2 px-4 rounded-lg text-center cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingExpense}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 transition-all duration-200"
                  >
                    {addingExpense && <Loader2 className="w-4 h-4 animate-spin" />}
                    Split Equally
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Close Icon component
const X = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

export default GroupDetailPage;
