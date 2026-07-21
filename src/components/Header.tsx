import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Bell, 
  Clock, 
  MapPin, 
  Smartphone, 
  PlusCircle, 
  ShoppingCart, 
  PackagePlus, 
  UserPlus 
} from 'lucide-react';
import { useERP } from '../context/ERPContext';

interface HeaderProps {
  setActiveTab: (tab: string) => void;
  onOpenQuickAddPart: () => void;
  onOpenQuickAddCustomer: () => void;
  onOpenQuickAddSupplier: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  setActiveTab, 
  onOpenQuickAddPart, 
  onOpenQuickAddCustomer,
  onOpenQuickAddSupplier
}) => {
  const { settings, parts, customers, syncStatus, lastSyncTime, pendingSyncCount } = useERP();
  const [showNotifications, setShowNotifications] = useState(false);

  // Derive notifications
  const lowStockAlerts = parts.filter(p => p.stock <= p.minStock).map(p => ({
    id: `low-${p.id}`,
    title: 'Low Stock Alert',
    message: `${p.name} is down to ${p.stock} units. (Min: ${p.minStock})`,
    type: 'low_stock'
  }));

  const pendingPayments = customers.filter(c => c.balance > 20000).map(c => ({
    id: `credit-${c.id}`,
    title: 'High Ledger Outstanding',
    message: `${c.name} has Rs. ${c.balance.toLocaleString()} outstanding credit.`,
    type: 'credit'
  }));

  const allNotifications = [...lowStockAlerts, ...pendingPayments];

  // Current date in Pakistan format
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 fixed top-0 right-0 left-64 z-10 shadow-xs">
      {/* Search / Breadcrumbs */}
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1">
            <span>{settings.shopName}</span>
          </h2>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-slate-400" />
            {settings.address}
          </span>
        </div>
      </div>

      {/* Quick Actions / Indicators */}
      <div className="flex items-center gap-5">
        {/* Quick Add Buttons */}
        <div className="flex items-center gap-2 border-r border-slate-200 pr-5">
          <button 
            onClick={() => setActiveTab('sales')}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>New POS Bill</span>
          </button>
          
          <button 
            onClick={onOpenQuickAddPart}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            <span>Add Part</span>
          </button>

          <button 
            onClick={onOpenQuickAddCustomer}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Sync Status Indicator */}
        <div className="flex items-center gap-2.5 text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shadow-xs">
          <span className={`w-2.5 h-2.5 rounded-full ${
            syncStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
            syncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' :
            'bg-rose-500'
          }`} />
          <div className="flex flex-col text-[10px] leading-tight text-left">
            <span className="font-bold text-slate-700 uppercase tracking-wide">
              {syncStatus === 'online' && 'Online'}
              {syncStatus === 'syncing' && 'Syncing'}
              {syncStatus === 'offline' && 'Offline'}
            </span>
            <span className="text-[9px] text-slate-400 font-mono">
              {pendingSyncCount > 0 ? `${pendingSyncCount} pending` : lastSyncTime ? `Synced ${lastSyncTime}` : 'Synced'}
            </span>
          </div>
        </div>

        {/* Live Date Counter */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>{formattedDate}</span>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-full transition-colors relative"
          >
            <Bell className="h-5 w-5" />
            {allNotifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
              <div className="p-3 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Notifications ({allNotifications.length})</span>
                {allNotifications.length > 0 && (
                  <span className="text-[10px] text-blue-600 font-semibold uppercase">Review items</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                {allNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No active warnings or alerts. All operations smooth!
                  </div>
                ) : (
                  allNotifications.map((noti) => (
                    <div key={noti.id} className="p-3 hover:bg-slate-50/50 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${noti.type === 'low_stock' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        <span className="text-xs font-bold text-slate-800">{noti.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-normal pl-3">{noti.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
