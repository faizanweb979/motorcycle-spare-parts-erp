import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Handshake, 
  PlusCircle, 
  UserCheck, 
  X,
  CreditCard,
  Percent,
  Search,
  PieChart as PieIcon,
  AlertCircle
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Partner, Drawing } from '../types';

export const Partners: React.FC = () => {
  const { 
    partners, 
    drawings, 
    sales, 
    expenses, 
    addPartner, 
    updatePartner, 
    deletePartner, 
    addDrawing, 
    deleteDrawing, 
    settings 
  } = useERP();

  // Navigation sub-tabs
  const [subTab, setSubTab] = useState<'partners' | 'drawings' | 'distribution'>('partners');

  // Partner Form states
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerContact, setPartnerContact] = useState('');
  const [partnerInvestment, setPartnerInvestment] = useState<number | ''>('');
  const [partnerOwnership, setPartnerOwnership] = useState<number | ''>('');
  const [partnerJoiningDate, setPartnerJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [partnerStatus, setPartnerStatus] = useState<'Active' | 'Inactive'>('Active');

  // Drawing Form states
  const [showDrawingForm, setShowDrawingForm] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [drawingDate, setDrawingDate] = useState(new Date().toISOString().split('T')[0]);
  const [drawingAmount, setDrawingAmount] = useState<number | ''>('');
  const [drawingReason, setDrawingReason] = useState('');
  const [drawingNotes, setDrawingNotes] = useState('');

  // 1. CALCULATE LIFETIME NET PROFIT
  // Gross Margin = Sales total (completed) - sales.discount - COGS (purchase prices)
  const lifetimeNetProfit = useMemo(() => {
    const activeSales = sales.filter(s => s.status !== 'returned');
    const grossProfit = activeSales.reduce((total, sale) => {
      const saleMargin = sale.items.reduce((sum, item) => {
        const pPrice = item.purchasePrice || 0;
        return sum + ((item.retailPrice - pPrice) * item.quantity);
      }, 0);
      return total + (saleMargin - sale.discount);
    }, 0);

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return Math.max(0, grossProfit - totalExpenses);
  }, [sales, expenses]);

  // Total investment from active partners
  const totalInvestment = useMemo(() => {
    return partners
      .filter(p => p.status === 'Active')
      .reduce((sum, p) => sum + p.investment, 0);
  }, [partners]);

  // 2. VALIDATION: Check sum of ownership percentages
  const currentTotalOwnership = useMemo(() => {
    return partners.reduce((sum, p) => sum + p.ownershipPercentage, 0);
  }, [partners]);

  // Calculated Partner breakdown
  const partnersBreakdown = useMemo(() => {
    return partners.map(partner => {
      // Allocated Profit Share: Lifetime Profit * (ownershipPercentage / 100)
      const allocatedProfitShare = lifetimeNetProfit * (partner.ownershipPercentage / 100);

      // Total drawings for this partner
      const partnerDrawings = drawings
        .filter(d => d.partnerId === partner.id)
        .reduce((sum, d) => sum + d.amount, 0);

      // Remaining profit share
      const remainingProfitShare = allocatedProfitShare - partnerDrawings;

      // Current balance (Capital Account Balance) = Investment + Remaining Profit Share
      const capitalAccountBalance = partner.investment + remainingProfitShare;

      return {
        ...partner,
        allocatedProfitShare,
        totalDrawings: partnerDrawings,
        remainingProfitShare,
        capitalAccountBalance
      };
    });
  }, [partners, drawings, lifetimeNetProfit]);

  // Total drawings of all partners
  const totalDrawings = useMemo(() => {
    return drawings.reduce((sum, d) => sum + d.amount, 0);
  }, [drawings]);

  // Retained earnings/remaining profit for the business
  const remainingBusinessProfit = useMemo(() => {
    return lifetimeNetProfit - totalDrawings;
  }, [lifetimeNetProfit, totalDrawings]);

  // Handle Partner Form Submit
  const handlePartnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerName.trim() || !partnerContact.trim() || partnerInvestment === '' || partnerOwnership === '') return;

    const ownershipNum = Number(partnerOwnership);
    const investmentNum = Number(partnerInvestment);

    // Validate ownership totals
    const existingOwnershipSum = partners
      .filter(p => p.id !== editingPartnerId)
      .reduce((sum, p) => sum + p.ownershipPercentage, 0);
    
    if (existingOwnershipSum + ownershipNum > 100) {
      alert(`Invalid Ownership Percentage! Total ownership cannot exceed 100%. Currently allocated: ${existingOwnershipSum}%, attempting to allocate: ${ownershipNum}%, which sums to ${existingOwnershipSum + ownershipNum}%`);
      return;
    }

    if (editingPartnerId) {
      await updatePartner(editingPartnerId, {
        name: partnerName.trim(),
        contact: partnerContact.trim(),
        investment: investmentNum,
        ownershipPercentage: ownershipNum,
        joiningDate: partnerJoiningDate,
        status: partnerStatus
      });
    } else {
      await addPartner({
        name: partnerName.trim(),
        contact: partnerContact.trim(),
        investment: investmentNum,
        ownershipPercentage: ownershipNum,
        joiningDate: partnerJoiningDate,
        status: partnerStatus
      });
    }

    // Reset
    setPartnerName('');
    setPartnerContact('');
    setPartnerInvestment('');
    setPartnerOwnership('');
    setPartnerJoiningDate(new Date().toISOString().split('T')[0]);
    setPartnerStatus('Active');
    setEditingPartnerId(null);
    setShowPartnerForm(false);
  };

  // Handle Drawing Submit
  const handleDrawingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || drawingAmount === '' || drawingAmount <= 0 || !drawingReason.trim()) return;

    const partnerCalculations = partnersBreakdown.find(p => p.id === selectedPartnerId);
    if (!partnerCalculations) return;

    if (Number(drawingAmount) > partnerCalculations.remainingProfitShare) {
      if (!confirm(`Warning: This withdrawal (Rs. ${Number(drawingAmount).toLocaleString()}) exceeds the partner's remaining profit share (Rs. ${partnerCalculations.remainingProfitShare.toLocaleString()}). Do you still want to proceed?`)) {
        return;
      }
    }

    await addDrawing({
      partnerId: selectedPartnerId,
      partnerName: partnerCalculations.name,
      date: drawingDate,
      amount: Number(drawingAmount),
      reason: drawingReason.trim(),
      notes: drawingNotes.trim() || undefined
    });

    // Reset
    setSelectedPartnerId('');
    setDrawingAmount('');
    setDrawingReason('');
    setDrawingNotes('');
    setDrawingDate(new Date().toISOString().split('T')[0]);
    setShowDrawingForm(false);
  };

  // Start Editing Partner
  const startEditPartner = (p: Partner) => {
    setEditingPartnerId(p.id);
    setPartnerName(p.name);
    setPartnerContact(p.contact);
    setPartnerInvestment(p.investment);
    setPartnerOwnership(p.ownershipPercentage);
    setPartnerJoiningDate(p.joiningDate);
    setPartnerStatus(p.status);
    setShowPartnerForm(true);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Partner Capital & profit Distribution</h1>
          <p className="text-xs text-slate-400 font-mono">Manage partner equity, calculate automatic profit sharing, and log drawings.</p>
        </div>

        <div className="flex items-center gap-2">
          {currentTotalOwnership < 100 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/80">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Unallocated Ownership: {100 - currentTotalOwnership}%</span>
            </div>
          )}

          <button
            onClick={() => {
              setEditingPartnerId(null);
              setPartnerName('');
              setPartnerContact('');
              setPartnerInvestment('');
              setPartnerOwnership('');
              setPartnerStatus('Active');
              setPartnerJoiningDate(new Date().toISOString().split('T')[0]);
              setShowPartnerForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-xs flex items-center gap-2 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Partner</span>
          </button>
        </div>
      </div>

      {/* CORE FINANCIAL OVERVIEW FOR PARTNERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lifetime Business Net Profit</span>
          <h3 className="text-2xl font-black text-emerald-400 font-mono mt-1">
            {settings.currency} {lifetimeNetProfit.toLocaleString()}
          </h3>
          <span className="text-[10px] text-slate-400">Calculated after operational expenses</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Partner Capital Investment</span>
          <h3 className="text-2xl font-black text-slate-900 font-mono mt-1">
            {settings.currency} {totalInvestment.toLocaleString()}
          </h3>
          <span className="text-[10px] text-slate-400">Sum of initial partner deposits</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Partner Drawings (Withdrawals)</span>
          <h3 className="text-2xl font-black text-orange-500 font-mono mt-1">
            {settings.currency} {totalDrawings.toLocaleString()}
          </h3>
          <span className="text-[10px] text-slate-400">Total profit withdrawn by partners</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Retained Retirals & Profit</span>
          <h3 className="text-2xl font-black text-blue-600 font-mono mt-1">
            {settings.currency} {remainingBusinessProfit.toLocaleString()}
          </h3>
          <span className="text-[10px] text-slate-400">Total remaining profits left in business</span>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 text-xs">
        <button
          onClick={() => setSubTab('partners')}
          className={`px-5 py-2.5 font-bold transition-colors border-b-2 -mb-px ${subTab === 'partners' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Partners Equity List
        </button>
        <button
          onClick={() => setSubTab('distribution')}
          className={`px-5 py-2.5 font-bold transition-colors border-b-2 -mb-px ${subTab === 'distribution' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Profit Distribution Board
        </button>
        <button
          onClick={() => setSubTab('drawings')}
          className={`px-5 py-2.5 font-bold transition-colors border-b-2 -mb-px ${subTab === 'drawings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Partner Drawing Logs
        </button>
      </div>

      {/* PARTNERS TAB */}
      {subTab === 'partners' && (
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Partner Name</th>
                  <th className="py-3 px-5">Contact Info</th>
                  <th className="py-3 px-5">Joining Date</th>
                  <th className="py-3 px-5 text-right">Investment</th>
                  <th className="py-3 px-5 text-center">Ownership %</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {partnersBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-normal">
                      No partners registered. Click "Add Partner" to set up ownership.
                    </td>
                  </tr>
                ) : (
                  partnersBreakdown.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5 font-bold text-slate-900 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-slate-400" />
                        <span>{p.name}</span>
                      </td>
                      <td className="py-3 px-5 text-slate-500 font-mono">{p.contact}</td>
                      <td className="py-3 px-5 font-mono text-slate-500">{new Date(p.joiningDate).toLocaleDateString()}</td>
                      <td className="py-3 px-5 text-right font-bold font-mono">
                        {settings.currency} {p.investment.toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-center font-bold text-slate-800 font-mono">{p.ownershipPercentage}%</td>
                      <td className="py-3 px-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEditPartner(p)}
                            className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to remove this partner? All related equity calculations will reset.')) {
                                deletePartner(p.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROFIT DISTRIBUTION TAB */}
      {subTab === 'distribution' && (
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800">Automatic Share Matrix</h3>
            <p className="text-[10px] text-slate-400 font-mono">Real-time calculations for allocations based on active ownership percentages.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Partner</th>
                  <th className="py-3 px-5 text-center">Share %</th>
                  <th className="py-3 px-5 text-right">Lifetime Profit Share</th>
                  <th className="py-3 px-5 text-right">Total Withdrawn (Drawings)</th>
                  <th className="py-3 px-5 text-right">Remaining Profit Share</th>
                  <th className="py-3 px-5 text-right bg-blue-50/30 text-blue-800 font-bold">Total Capital Account Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {partnersBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                      No partners registered yet.
                    </td>
                  </tr>
                ) : (
                  partnersBreakdown.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-5 text-center font-bold text-slate-800 font-mono">{p.ownershipPercentage}%</td>
                      <td className="py-3 px-5 text-right font-bold font-mono text-emerald-600">
                        {settings.currency} {p.allocatedProfitShare.toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-right font-bold font-mono text-orange-500">
                        {settings.currency} {p.totalDrawings.toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-right font-bold font-mono text-blue-600">
                        {settings.currency} {p.remainingProfitShare.toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-right font-mono bg-blue-50/30 font-black text-slate-900">
                        {settings.currency} {p.capitalAccountBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DRAWINGS LOGS TAB */}
      {subTab === 'drawings' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (partners.length === 0) {
                  alert('Please register at least one partner before recording withdrawals (drawings).');
                  return;
                }
                setSelectedPartnerId(partners[0].id);
                setShowDrawingForm(true);
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-xs flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Record Withdrawal (Drawing)</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                    <th className="py-3 px-5">Withdrawal Date</th>
                    <th className="py-3 px-5">Partner</th>
                    <th className="py-3 px-5">Reason</th>
                    <th className="py-3 px-5">Notes</th>
                    <th className="py-3 px-5 text-right">Amount Drawn</th>
                    <th className="py-3 px-5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {drawings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                        No partner withdrawals logged.
                      </td>
                    </tr>
                  ) : (
                    drawings.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-5 font-mono text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                        <td className="py-3 px-5 font-bold text-slate-900">{d.partnerName}</td>
                        <td className="py-3 px-5 text-slate-700 font-semibold">{d.reason}</td>
                        <td className="py-3 px-5 text-slate-400">{d.notes || '—'}</td>
                        <td className="py-3 px-5 text-right font-bold font-mono text-orange-600">
                          {settings.currency} {d.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-center">
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this drawing entry? This will revert the partner remaining balance.')) {
                                deleteDrawing(d.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PARTNER FORM MODAL */}
      {showPartnerForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingPartnerId ? 'Edit Partner Details' : 'Register New Capital Partner'}
              </h3>
              <button 
                onClick={() => setShowPartnerForm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePartnerSubmit} className="p-5 space-y-4">
              {/* Partner Name */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Partner Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mian Muhammad Ali"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Contact Info */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Contact Number / Email</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0300-9876543"
                  value={partnerContact}
                  onChange={(e) => setPartnerContact(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Capital Investment & Ownership */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Capital Investment ({settings.currency})</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 500000"
                    value={partnerInvestment}
                    onChange={(e) => setPartnerInvestment(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Ownership Share (%)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    placeholder="e.g. 40"
                    value={partnerOwnership}
                    onChange={(e) => setPartnerOwnership(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Joining Date & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={partnerJoiningDate}
                    onChange={(e) => setPartnerJoiningDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Status</label>
                  <select
                    value={partnerStatus}
                    onChange={(e) => setPartnerStatus(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-xs"
                >
                  Save Partner Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWING FORM MODAL */}
      {showDrawingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Record Partner Withdrawal (Drawing)</h3>
              <button 
                onClick={() => setShowDrawingForm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDrawingSubmit} className="p-5 space-y-4">
              {/* Partner Select */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Select Capital Partner</label>
                <select
                  value={selectedPartnerId}
                  required
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-white"
                >
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.ownershipPercentage}%)</option>
                  ))}
                </select>
              </div>

              {/* Date & Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Withdrawal Date</label>
                  <input
                    type="date"
                    required
                    value={drawingDate}
                    onChange={(e) => setDrawingDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Amount ({settings.currency})</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 25000"
                    value={drawingAmount}
                    onChange={(e) => setDrawingAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Reason for Withdrawal</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly dividend drawing, personal cash advance"
                  value={drawingReason}
                  onChange={(e) => setDrawingReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Additional Notes (Optional)</label>
                <textarea
                  placeholder="Internal references, cheque numbers, details..."
                  rows={2}
                  value={drawingNotes}
                  onChange={(e) => setDrawingNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-xs"
                >
                  Confirm Withdrawal (Drawing)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
