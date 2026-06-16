import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, Outlet, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import api from './api/axios';

// Import Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ImportPage from './pages/ImportPage';
import ReceiptScannerPage from './pages/ReceiptScannerPage';
import AnalyticsPage from './pages/AnalyticsPage';

// Import Icons
import { LayoutDashboard, Users, Upload, LogOut, Wallet, Bell, Scan, BarChart3 } from 'lucide-react';

// Common Layout with Header Navigation
const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);

  const fetchNotifications = async (isPoll = false) => {
    try {
      const res = await api.get('/api/notifications/');
      const list = res.data;
      setNotifications(list);
      
      const unreadCount = list.filter(n => !n.is_read).length;
      if (isPoll && unreadCount > prevUnreadCount) {
        // Find newest unread notification and toast it
        const diff = unreadCount - prevUnreadCount;
        const unreadList = list.filter(n => !n.is_read);
        const newItems = unreadList.slice(0, diff);
        
        newItems.forEach(n => {
          toast(n.message, {
            icon: '🔔',
            style: {
              background: '#0f172a',
              color: '#cbd5e1',
              border: '1px solid #4f46e5',
            }
          });
        });
      }
      setPrevUnreadCount(unreadCount);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const timer = setInterval(() => {
      // Direct call fetching list and updating unread state
      api.get('/api/notifications/')
        .then(res => {
          const list = res.data;
          setNotifications(list);
          const unreadCount = list.filter(n => !n.is_read).length;
          
          setPrevUnreadCount(prev => {
            if (unreadCount > prev) {
              const diff = unreadCount - prev;
              const unreadList = list.filter(n => !n.is_read);
              const newItems = unreadList.slice(0, diff);
              
              newItems.forEach(n => {
                toast(n.message, {
                  icon: '🔔',
                  style: {
                    background: '#1e1b4b',
                    color: '#e2e8f0',
                    border: '1px solid #4f46e5',
                  }
                });
              });
            }
            return unreadCount;
          });
        })
        .catch(() => {});
    }, 15000);

    return () => clearInterval(timer);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/api/notifications/mark-all-read/');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setPrevUnreadCount(0);
      toast.success("All alerts cleared");
    } catch (err) {
      toast.error("Failed to clear alerts.");
    }
  };

  const handleMarkSingleRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await api.post(`/api/notifications/${id}/mark-read/`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setPrevUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark alert as read", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
      {/* Navbar with glassmorphic style */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-black">
                <Wallet className="w-5 h-5" />
              </div>
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Spreetail Expense Tracker
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-350 hover:text-white hover:bg-slate-850 transition-colors">
                <LayoutDashboard className="w-4 h-4 text-violet-450" />
                Dashboard
              </Link>
              <Link to="/groups" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-350 hover:text-white hover:bg-slate-850 transition-colors">
                <Users className="w-4 h-4 text-violet-450" />
                Groups
              </Link>
              <Link to="/scanner" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-350 hover:text-white hover:bg-slate-850 transition-colors">
                <Scan className="w-4 h-4 text-violet-450" />
                Receipt Scanner
              </Link>
              <Link to="/import" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-350 hover:text-white hover:bg-slate-850 transition-colors">
                <Upload className="w-4 h-4 text-violet-450" />
                Import CSV
              </Link>
              <Link to="/analytics" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-350 hover:text-white hover:bg-slate-850 transition-colors">
                <BarChart3 className="w-4 h-4 text-violet-450" />
                Analytics
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Real-time Notification bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4 text-violet-400" />
                  {prevUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-650 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                      {prevUnreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                      <h5 className="font-bold text-white text-sm">Alerts</h5>
                      {prevUnreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-violet-400 hover:text-violet-350 font-medium cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No notifications yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkSingleRead(n.id, n.is_read)}
                            className={`p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                              n.is_read
                                ? 'bg-slate-900/60 border-slate-850 text-slate-450 hover:bg-slate-850/20'
                                : 'bg-slate-850/60 border-violet-900/40 text-slate-200 hover:bg-slate-850 hover:border-violet-800/60'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className={`text-xs font-semibold ${!n.is_read ? 'text-violet-300' : 'text-slate-400'}`}>
                                {n.title}
                              </span>
                              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1 shrink-0" />}
                            </div>
                            <p className="text-xxs text-slate-400 mt-1">{n.message}</p>
                            <span className="text-[9px] text-slate-500 block mt-1">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">{user?.username}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-850 hover:bg-rose-950/30 text-slate-400 hover:text-rose-450 border border-slate-800 hover:border-rose-900/50 cursor-pointer transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Toast Notification Provider */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0f172a',
              color: '#cbd5e1',
              border: '1px solid #1e293b',
            },
          }}
        />

        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Main Routes */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
            <Route path="/groups/:id" element={<ProtectedRoute><GroupDetailPage /></ProtectedRoute>} />
            <Route path="/scanner" element={<ProtectedRoute><ReceiptScannerPage /></ProtectedRoute>} />
            <Route path="/import" element={<ProtectedRoute><ImportPage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            
            {/* Redirect root and unmatched to Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
