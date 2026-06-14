import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-violet-500" />
            Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Welcome back, {user?.first_name || user?.username || 'User'}! Track your balances and group payments.</p>
        </div>
      </div>

      {/* Grid of metrics cards for wow factor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">Total Balance</p>
            <h3 className="text-2xl font-bold text-white mt-1">₹0.00</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">You Are Owed</p>
            <h3 className="text-2xl font-bold text-white mt-1">₹0.00</h3>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">You Owe</p>
            <h3 className="text-2xl font-bold text-white mt-1">₹0.00</h3>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <p className="text-slate-400">No recent transactions or activity found. Get started by creating or joining a group!</p>
      </div>
    </div>
  );
};

export default DashboardPage;
