import React from 'react';
import { Users, Plus } from 'lucide-react';

const GroupsPage = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-violet-500" />
            Groups
          </h1>
          <p className="text-slate-400 mt-1">Manage your shared expense groups.</p>
        </div>
        
        <button className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 transition-all duration-200">
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white">No Groups Found</h3>
        <p className="text-slate-400 mt-2 max-w-md mx-auto">Create a group to start splitting bills and expenses with friends or roommates.</p>
      </div>
    </div>
  );
};

export default GroupsPage;
