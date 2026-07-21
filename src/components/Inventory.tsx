import React, { useState, useMemo } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  PlusCircle, 
  MinusCircle, 
  TrendingUp, 
  Search, 
  CheckCircle2, 
  Settings, 
  RefreshCw,
  Plus,
  Minus,
  ClipboardList
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Part, Adjustment } from '../types';

export const Inventory: React.FC = () => {
  const { parts, adjustments, addAdjustment, settings } = useERP();

  // Filter and search
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState<'All' | 'Low' | 'Normal'>('All');

  // Adjustment form state
  const [isAdjOpen, setIsAdjOpen] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [adjType, setAdjType] = useState<'adjustment_add' | 'adjustment_sub'>('adjustment_add');
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [formError, setFormError] = useState('');

  // 1. DYNAMIC METRICS
  const stockMetrics = useMemo(() => {
    const totalQty = parts.reduce((sum, p) => sum + p.stock, 0);
    const lowQtyCount = parts.filter(p => p.stock <= p.minStock).length;
    const totalAssetVal = parts.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0);
    const totalRetailVal = parts.reduce((sum, p) => sum + (p.retailPrice * p.stock), 0);

    return {
      totalQty,
      lowQtyCount,
      totalAssetVal,
      totalRetailVal,
      projectedProfit: totalRetailVal - totalAssetVal
    };
  }, [parts]);

  // Filters logic
  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.partNumber.toLowerCase().includes(search.toLowerCase()) || 
        p.brand.toLowerCase().includes(search.toLowerCase());

      const isLow = p.stock <= p.minStock;
      const matchesStatus = 
        stockStatus === 'All' || 
        (stockStatus === 'Low' && isLow) || 
        (stockStatus === 'Normal' && !isLow);

      return matchesSearch && matchesStatus;
    });
  }, [parts, search, stockStatus]);

  // Recent Adjustments
  const recentAdjustments = useMemo(() => {
    return adjustments.slice(0, 15);
  }, [adjustments]);

  // Handle Adjustment submission
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPartId) {
      setFormError('Please select a spare part.');
      return;
    }

    if (adjQty <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }

    if (!adjReason.trim()) {
      setFormError('Please state a valid business reason for adjustment.');
      return;
    }

    const selectedPart = parts.find(p => p.id === selectedPartId);
    if (!selectedPart) return;

    if (adjType === 'adjustment_sub' && selectedPart.stock < adjQty) {
      setFormError(`Insufficient stock! Cannot deduct ${adjQty} units from current stock of ${selectedPart.stock}.`);
      return;
    }

    try {
      await addAdjustment({
        partId: selectedPart.id,
        partName: selectedPart.name,
        type: adjType,
        quantity: adjQty,
        price: selectedPart.purchasePrice,
        referenceId: 'MANUAL_ADJ',
        reason: adjReason
      });
      
      // Reset form
      setIsAdjOpen(false);
      setSelectedPartId('');
      setAdjQty(0);
      setAdjReason('');
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. STOCK STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Warehouse Stock</span>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-0.5">{stockMetrics.totalQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">units</span></h3>
            <span className="text-[10px] text-slate-400 font-mono">Across {parts.length} spare parts</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-slate-700">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Low Stock Warnings</span>
            <h3 className={`text-2xl font-black font-mono mt-0.5 ${stockMetrics.lowQtyCount > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{stockMetrics.lowQtyCount} <span className="text-xs font-normal text-slate-500">parts</span></h3>
            <span className="text-[10px] text-slate-400 font-mono">Requires immediate reorder</span>
          </div>
          <div className={`p-3 rounded-xl ${stockMetrics.lowQtyCount > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Asset Value</span>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-0.5">{settings.currency} {stockMetrics.totalAssetVal.toLocaleString()}</h3>
            <span className="text-[10px] text-slate-400 font-mono">Wholesale asset evaluation</span>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-500">
            <Package className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Expected Stock Margin</span>
            <h3 className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{settings.currency} {stockMetrics.projectedProfit.toLocaleString()}</h3>
            <span className="text-[10px] text-slate-400 font-mono">Projected net retail profit</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. DUAL COLUMNS SECTION */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* INVENTORY TABLE PANEL */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-bold text-slate-800">Warehouse Stock Ledger</h3>
              <span className="text-[10px] text-slate-400">Current quantities and critical thresholds</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search parts catalog..."
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500 w-44 focus:w-60 transition-all"
                />
              </div>

              {/* Status Selector */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white font-medium">
                <button
                  onClick={() => setStockStatus('All')}
                  className={`px-3 py-1.5 transition-colors ${stockStatus === 'All' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setStockStatus('Low')}
                  className={`px-3 py-1.5 border-l border-r border-slate-200 transition-colors ${stockStatus === 'Low' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
                >
                  Low Stock
                </button>
              </div>

              <button
                onClick={() => setIsAdjOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Adjust Stock</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Spare Part Detail</th>
                  <th className="py-3 px-4">Part No / Code</th>
                  <th className="py-3 px-4">Warehouse Pin</th>
                  <th className="py-3 px-4 text-center">In Stock</th>
                  <th className="py-3 px-4 text-center">Min Threshold</th>
                  <th className="py-3 px-4 text-right">Asset Cost Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredParts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      No parts matched active filters.
                    </td>
                  </tr>
                ) : (
                  filteredParts.map((p) => {
                    const isLow = p.stock <= p.minStock;
                    const val = p.purchasePrice * p.stock;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <span className="text-[10px] text-slate-400 font-medium font-mono">{p.brand} · {p.modelCompatibility}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{p.partNumber}</td>
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                            {p.location || 'Rack not set'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">{p.stock}</td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-400">{p.minStock}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">Rs. {val.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                            isLow 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isLow ? 'CRITICAL LOW' : 'STOCKED OK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RECENT ADJUSTMENT HISTORY FEED */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col h-[520px]">
          <div className="flex flex-col mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Adjustment Audits</h3>
            <span className="text-[9px] text-slate-400 font-mono">Logs of manual corrections & returns</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {recentAdjustments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-slate-400 gap-1">
                <RefreshCw className="h-8 w-8 text-slate-300 stroke-1" />
                <p className="text-xs font-medium">No adjustment logs</p>
                <p className="text-[10px] leading-relaxed">System-generated return logs or manual changes will appear here.</p>
              </div>
            ) : (
              recentAdjustments.map((adj) => {
                const isAdd = adj.type === 'adjustment_add' || adj.type === 'purchase' || adj.type === 'sales_return';
                return (
                  <div key={adj.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-0.5 ${
                        isAdd ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {isAdd ? <Plus className="h-2 w-2" /> : <Minus className="h-2 w-2" />}
                        {adj.type.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">{new Date(adj.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-snug">{adj.partName}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Qty: <strong className="text-slate-800 font-mono">{adj.quantity} units</strong> · Ref: {adj.referenceId}
                      </p>
                    </div>

                    <p className="text-[10px] italic text-slate-400 border-t border-slate-100 pt-1.5">
                      " {adj.reason} "
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 3. STOCK ADJUSTMENT FORM DIALOG */}
      {isAdjOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold">Adjust Warehouse Quantities</h3>
              <button onClick={() => setIsAdjOpen(false)} className="text-slate-400 hover:text-white">
                <Settings className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustmentSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Select Spare Part *</label>
                <select
                  required
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">-- Choose Spare Part --</option>
                  {parts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand} - Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Adjustment Type *</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setAdjType('adjustment_add')}
                    className={`p-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                      adjType === 'adjustment_add' 
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <PlusCircle className="h-4 w-4 text-emerald-500" />
                    <span>Stock Addition</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('adjustment_sub')}
                    className={`p-2 rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                      adjType === 'adjustment_sub' 
                        ? 'bg-red-50 border-red-400 text-red-800 font-bold' 
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <MinusCircle className="h-4 w-4 text-red-500" />
                    <span>Stock Deduction</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Adjustment Quantity *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjQty}
                  onChange={(e) => setAdjQty(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Reason / Details *</label>
                <textarea
                  required
                  rows={3}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g., Damaged item found during counting, or audit recount correction."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Apply Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
