import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { LayoutDashboard, Wallet, ArrowUpRight, ArrowDownLeft, Users, Loader2, ArrowRight } from 'lucide-react';

const DashboardPage = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await api.get('/api/groups/');
        setGroups(res.data);
      } catch (err) {
        toast.error("Failed to load dashboard groups.");
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  // Compute aggregated summaries across all user groups
  const totalBalance = groups.reduce((acc, g) => acc + g.user_balance, 0);
  const totalYouAreOwed = groups.filter(g => g.user_balance > 0).reduce((acc, g) => acc + g.user_balance, 0);
  const totalYouOwe = Math.abs(groups.filter(g => g.user_balance < 0).reduce((acc, g) => acc + g.user_balance, 0));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-2" />
        <p className="text-sm text-slate-400">Loading your summary...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-violet-500" />
          Dashboard
        </h1>
        <p className="text-slate-400 mt-1">Real-time overview of your shared expense ledgers across all joined groups.</p>
      </div>

      {/* Aggregated Balance Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-6 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-450">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">Net Balance</p>
            <h3 className={`text-2xl font-bold mt-1 ${totalBalance > 0 ? 'text-emerald-400' : totalBalance < 0 ? 'text-rose-400' : 'text-white'}`}>
              {totalBalance >= 0 ? '+' : ''}₹{totalBalance.toFixed(2)}
            </h3>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-6 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">You Are Owed</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">₹{totalYouAreOwed.toFixed(2)}</h3>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-6 flex items-center gap-4 shadow-xl">
          <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase">You Owe</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">₹{totalYouOwe.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Your Groups</h2>
      </div>

      {groups.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-650 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">No active groups</h3>
          <p className="text-slate-400 mt-2 max-w-sm mx-auto mb-6">Create a group or join an existing one by sharing a Group ID to start tracking expenses.</p>
          <Link to="/groups" className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-6 rounded-lg transition-all shadow-lg shadow-violet-600/20">
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="group bg-slate-900/50 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 rounded-xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-4">
                  <h4 className="font-bold text-white text-lg group-hover:text-violet-400 transition-colors">
                    {g.name}
                  </h4>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
                    ID: {g.id}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-slate-400 mt-3">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>{g.member_count} member{g.member_count !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <div className="border-t border-slate-850/60 mt-6 pt-4 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Your Balance</span>
                <span className={`text-sm font-bold ${g.user_balance > 0 ? 'text-emerald-400' : g.user_balance < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {g.user_balance > 0 ? '+' : ''}₹{g.user_balance.toFixed(2)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
