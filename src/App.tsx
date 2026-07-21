import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  User 
} from 'firebase/auth';
import { auth, loginWithGoogle } from './firebase';
import { ERPProvider } from './context/ERPContext';

// Components
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PartsMaster } from './components/PartsMaster';
import { Inventory } from './components/Inventory';
import { SalesPOS } from './components/SalesPOS';
import { Purchases } from './components/Purchases';
import { Ledger } from './components/Ledger';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Expenses } from './components/Expenses';
import { Partners } from './components/Partners';

// Lazy load AI Assistant
const AIAssistant = React.lazy(() => import('./components/AIAssistant').then(m => ({ default: m.AIAssistant })));

// Icons for login screen
import { KeyRound, Mail, UserPlus, LogIn, Sparkles, Settings as SettingsIcon } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('dashboard');

  // Global triggers to link Quick Add actions from Header to subcomponents
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [showAddPartForm, setShowAddPartForm] = useState(false);
  const [showAddCustomerForm, setShowAddCustomerForm] = useState(false);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Handle Login/Registration
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSubmitLoading(true);

    if (!email.trim() || !password.trim()) {
      setAuthError('Email and Password cannot be blank.');
      setSubmitLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('Invalid email credentials or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email address already exists.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password must be at least 6 characters long.');
      } else {
        setAuthError(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setSubmitLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Google Sign-In failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-4 h-screen">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono tracking-widest uppercase">Connecting to Secure ERP Core...</p>
      </div>
    );
  }

  // If NOT logged in, render pristine login card
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Modern grid backgrounds / ambient light overlays */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative z-10 overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-slate-950 border-b border-slate-800 flex flex-col items-center gap-1.5 text-center">
            <div className="h-11 w-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20">
              <span className="text-white font-black text-2xl">M</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight mt-1.5">Motorcycle Spare Parts ERP</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Bismillah Autos & Spare Parts</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authError && (
                <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium leading-relaxed">
                  {authError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Registered Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., dealer@bismillahautos.com"
                    className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white py-2.5 rounded-lg text-xs transition-colors shadow-md shadow-blue-600/10 flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                {submitLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : isSignUp ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Create ERP Account</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign In to Terminal</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative flex py-4 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-wider">or continue with</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-800 font-bold text-white py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Sign In with Google</span>
            </button>

            <div className="mt-5 pt-4 border-t border-slate-800/60 text-center">
              <button
                onClick={() => {
                  setAuthError('');
                  setIsSignUp(!isSignUp);
                }}
                className="text-xs text-blue-500 hover:text-blue-400 font-semibold"
              >
                {isSignUp ? 'Already have an ERP account? Sign In' : "Don't have an account? Sign Up Now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IF LOGGED IN, wrap layout with Context Provider
  return (
    <ERPProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userEmail={user.email} 
        />
        
        <Header 
          setActiveTab={setActiveTab}
          onOpenQuickAddPart={() => {
            setActiveTab('parts');
            setShowAddPartForm(true);
          }}
          onOpenQuickAddCustomer={() => {
            setActiveTab('customers');
            setShowAddCustomerForm(true);
          }}
          onOpenQuickAddSupplier={() => {
            setActiveTab('suppliers');
          }}
        />

        {/* Content Box with strict margins to offset sidebar & fixed header */}
        <main className="pl-64 pt-16 min-h-screen">
          <div className="p-8 max-w-[1600px] mx-auto">
            {activeTab === 'dashboard' && (
              <Dashboard 
                setActiveTab={setActiveTab} 
                onSelectPart={(part) => {
                  setSelectedPartId(part.id);
                  setActiveTab('parts');
                }}
              />
            )}
            
            {activeTab === 'parts' && (
              <PartsMaster 
                selectedPartId={selectedPartId}
                setSelectedPartId={setSelectedPartId}
                showAddFormGlobally={showAddPartForm}
                setShowAddFormGlobally={setShowAddPartForm}
              />
            )}

            {activeTab === 'inventory' && (
              <Inventory />
            )}

            {activeTab === 'sales' && (
              <SalesPOS />
            )}

            {activeTab === 'purchases' && (
              <Purchases />
            )}

            {activeTab === 'customers' && (
              <Ledger 
                type="customers" 
                showAddFormGlobally={showAddCustomerForm}
                setShowAddFormGlobally={setShowAddCustomerForm}
              />
            )}

            {activeTab === 'suppliers' && (
              <Ledger 
                type="suppliers" 
                showAddFormGlobally={false}
                setShowAddFormGlobally={() => {}}
              />
            )}

            {activeTab === 'expenses' && (
              <Expenses />
            )}

            {activeTab === 'partners' && (
              <Partners />
            )}

            {activeTab === 'reports' && (
              <Reports />
            )}

            {activeTab === 'ai_assistant' && (
              <React.Suspense fallback={
                <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-4">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-mono tracking-widest uppercase">Lazy loading AI Advisory Module...</p>
                </div>
              }>
                <AIAssistant />
              </React.Suspense>
            )}

            {activeTab === 'settings' && (
              <Settings />
            )}
          </div>
        </main>
      </div>
    </ERPProvider>
  );
}
