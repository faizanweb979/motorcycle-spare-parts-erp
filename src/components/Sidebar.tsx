import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  Sliders, 
  Briefcase, 
  ClipboardList, 
  AlertTriangle,
  LogOut,
  DollarSign,
  Handshake,
  Sparkles
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { auth } from '../firebase';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userEmail: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userEmail }) => {
  const { parts, customers, suppliers } = useERP();

  // Counts for badge notifications
  const lowStockCount = parts.filter(p => p.stock <= p.minStock).length;
  const creditCustomersCount = customers.filter(c => c.balance > 0).length;
  const creditSuppliersCount = suppliers.filter(s => s.balance > 0).length;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'parts', label: 'Parts Master', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: ClipboardList, badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'bg-red-500/20 text-red-400 font-semibold' },
    { id: 'sales', label: 'Sales (POS)', icon: ShoppingCart },
    { id: 'purchases', label: 'Purchases', icon: Briefcase },
    { id: 'customers', label: 'Customers', icon: Users, badge: creditCustomersCount > 0 ? creditCustomersCount : undefined, badgeColor: 'bg-blue-500/20 text-blue-400 font-semibold' },
    { id: 'suppliers', label: 'Suppliers', icon: Users, badge: creditSuppliersCount > 0 ? creditSuppliersCount : undefined, badgeColor: 'bg-blue-500/20 text-blue-400 font-semibold' },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'partners', label: 'Partners Management', icon: Handshake },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'ai_assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'settings', label: 'Logs & Settings', icon: Sliders },
  ];

  return (
    <div className="w-64 bg-[#1E293B] text-slate-100 flex flex-col h-screen fixed left-0 top-0 z-20 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3 bg-slate-900/60">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/20">M</div>
        <div>
          <span className="text-white font-semibold text-base tracking-tight uppercase block">MotoPart ERP</span>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono -mt-0.5">Bismillah Autos</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all duration-150 group text-left ${
                isActive 
                  ? 'bg-blue-600/20 text-blue-400 font-semibold border-l-2 border-blue-500 pl-3' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <IconComponent className={`h-4.5 w-4.5 shrink-0 transition-transform ${
                  isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'
                }`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex flex-col gap-3">
        <div className="flex flex-col min-w-0">
          <p className="text-xs text-slate-400 truncate font-mono">Signed in as:</p>
          <p className="text-xs font-semibold text-slate-200 truncate" title={userEmail || ''}>
            {userEmail || 'Guest'}
          </p>
        </div>
        
        <button
          onClick={() => auth.signOut()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-950/40 hover:text-red-400 text-slate-300 rounded-lg text-xs font-semibold transition-colors border border-slate-700/50 hover:border-red-900/50"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
