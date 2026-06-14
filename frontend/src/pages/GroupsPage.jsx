import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { Users, Plus, Loader2, ArrowRight, X } from 'lucide-react';

const GroupsPage = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('INR');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/api/groups/');
      setGroups(res.data);
    } catch (err) {
      toast.error("Failed to load groups list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error("Group name cannot be empty.");
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/groups/', {
        name: newGroupName,
        base_currency: newGroupCurrency,
      });
      toast.success(`Group "${newGroupName}" created!`);
      setNewGroupName('');
      setShowCreateModal(false);
      fetchGroups();
    } catch (err) {
      toast.error("Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinGroupId.trim()) {
      toast.error("Please enter a Group ID.");
      return;
    }
    setJoining(true);
    try {
      await api.post(`/api/groups/${joinGroupId.trim()}/join/`);
      toast.success("Joined group successfully!");
      setJoinGroupId('');
      fetchGroups();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || "Failed to join group. Check the ID.";
      toast.error(errorMsg);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 text-violet-500 animate-spin mb-2" />
        <p className="text-sm text-slate-400">Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto text-slate-100 relative">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-violet-500" />
            Groups
          </h1>
          <p className="text-slate-400 mt-1">Manage, join, and create shared bill groups.</p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Columns: Group List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-white mb-2">My Groups ({groups.length})</h2>
          
          {groups.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-slate-650 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white">No Groups</h3>
              <p className="text-slate-400 mt-2">You aren't a member of any group yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map((g) => (
                <div key={g.id} className="bg-slate-900/50 border border-slate-850 hover:border-slate-750 rounded-xl p-5 flex flex-col justify-between hover:shadow-lg transition-all">
                  <div>
                    <h3 className="font-bold text-white text-base">{g.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{g.member_count} members</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-850/60 mt-4 pt-3 flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-semibold uppercase">ID: {g.id}</span>
                    <Link to={`/groups/${g.id}`} className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1">
                      View details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Join Group Panel */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-6 h-fit shadow-xl">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-500" />
            Join Existing Group
          </h2>
          <p className="text-xs text-slate-400 mb-6">Enter a Group ID provided by a friend or administrator to join their ledger sheet.</p>
          
          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Group ID Number</label>
              <input
                type="text"
                required
                value={joinGroupId}
                onChange={(e) => setJoinGroupId(e.target.value)}
                placeholder="e.g. 4"
                className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={joining}
              className="w-full bg-slate-850 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer border border-slate-800 transition-colors disabled:opacity-50"
            >
              {joining && <Loader2 className="w-4 h-4 animate-spin" />}
              Join Group
            </button>
          </form>
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Create New Group</h3>
              
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Group Name *</label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Goa Trip 2026"
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Base Currency</label>
                  <select
                    value={newGroupCurrency}
                    onChange={(e) => setNewGroupCurrency(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-850">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold py-2 px-4 rounded-lg text-center cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 transition-all duration-200"
                  >
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create
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

export default GroupsPage;
