import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import POS from './components/POS';
import Barista from './components/Barista';
import Owner from './components/Owner';
import Settings from './components/Settings';
import { UserProfile, Product, Order } from './types';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Coffee, ShoppingCart, UserCheck, TrendingUp, LogOut, Settings as SettingsIcon, Menu, X } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { translations } from './translations';
import { motion, AnimatePresence } from 'motion/react';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeView, setActiveView] = useState<string>('');
  const [language, setLanguage] = useState<'en' | 'vi'>('vi');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setActiveView('');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Apply theme to body
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (user && auth.currentUser) {
      const unsubProds = onSnapshot(collection(db, 'products'), (s) => {
        setProducts(s.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      });
      const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50)), (s) => {
        setOrders(s.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      });
      
      // Set initial view based on role
      if (!activeView) {
        if (user.role === 'owner') setActiveView('owner');
        else if (user.role === 'barista') setActiveView('barista');
        else setActiveView('pos');
      }

      return () => {
        unsubProds();
        unsubOrders();
      };
    }
  }, [user, activeView]);

  if (!user) {
    return (
      <ErrorBoundary language={language}>
        <Auth onUserChange={setUser} language={language} />
      </ErrorBoundary>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'pos': return <POS user={user} language={language} />;
      case 'barista': return <Barista user={user} language={language} />;
      case 'owner': return <Owner user={user} language={language} />;
      case 'settings': return <Settings user={user} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />;
      default: return <POS user={user} language={language} />;
    }
  };

  const t = translations[language];

  return (
    <ErrorBoundary language={language}>
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300 relative">
        {/* Sidebar for navigation */}
        <AnimatePresence>
          {(isSidebarOpen || window.innerWidth >= 1024) && (
            <>
              {/* Overlay for mobile */}
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110]"
                />
              )}
              
              <motion.aside
                initial={window.innerWidth < 1024 ? { x: -300 } : false}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed lg:relative z-[120] lg:z-auto w-72 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 transition-colors duration-300 ${
                  !isSidebarOpen && 'hidden lg:flex'
                }`}
              >
                <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{t.brand}</h1>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {(user.role === 'employee' || user.role === 'barista' || user.role === 'owner') && (
                    <button
                      onClick={() => { setActiveView('pos'); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                        activeView === 'pos' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      <ShoppingCart className="w-6 h-6" />
                      <span>{t.nav.placeOrder}</span>
                    </button>
                  )}
                  {(user.role === 'barista' || user.role === 'owner') && (
                    <button
                      onClick={() => { setActiveView('barista'); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                        activeView === 'barista' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      <UserCheck className="w-6 h-6" />
                      <span>{t.nav.baristaView}</span>
                    </button>
                  )}
                  {user.role === 'owner' && (
                    <button
                      onClick={() => { setActiveView('owner'); setIsSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                        activeView === 'owner' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      <TrendingUp className="w-6 h-6" />
                      <span>{t.nav.management}</span>
                    </button>
                  )}
                </nav>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/30 dark:bg-slate-900/30">
                  <button
                    onClick={() => { setActiveView('settings'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 ${
                      activeView === 'settings' 
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm hover:ring-1 hover:ring-slate-200 dark:hover:ring-slate-700'
                    }`}
                  >
                    <SettingsIcon className="w-5 h-5" />
                    <span className="text-sm">{t.nav.settings}</span>
                  </button>
                  
                  <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl flex items-center justify-center font-bold text-sm ring-1 ring-indigo-200 dark:ring-indigo-800">
                      {user.displayName?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight">{user.displayName}</p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize tracking-wider">{user.role}</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await signOut(auth);
                        setUser(null);
                        setActiveView('');
                      } catch (error) {
                        console.error('Sign out error:', error);
                        setUser(null);
                        setActiveView('');
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all font-medium text-sm group"
                  >
                    <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>{t.nav.signOut}</span>
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Mobile Menu Toggle Button (Floating) */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`lg:hidden fixed top-6 left-4 z-[100] p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-all ${
            isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Main Content Area */}
        <main className="flex-1 relative overflow-hidden pb-24 lg:pb-0">
          {renderView()}
        </main>
      </div>
    </ErrorBoundary>
  );
}
