import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, Receipt, Plus } from 'lucide-react';

const GroupDetailPage = () => {
  const { id } = useParams();

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="mb-6">
        <Link to="/groups" className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Group #{id}
          </h1>
          <p className="text-slate-400 mt-1">Detailed transaction history, splits, and current balances.</p>
        </div>

        <button className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 transition-all duration-200">
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expenses List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-violet-500" />
            Expenses
          </h3>
          <p className="text-slate-400 text-center py-8">No expenses logged yet in this group.</p>
        </div>

        {/* Member list & Balances */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-violet-500" />
            Members & Balances
          </h3>
          <p className="text-slate-400 text-center py-8">No members found.</p>
        </div>
      </div>
    </div>
  );
};

export default GroupDetailPage;
