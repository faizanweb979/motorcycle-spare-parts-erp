import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  FileText, 
  Briefcase, 
  UserCheck, 
  Sliders, 
  Coins, 
  X,
  Smartphone
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Customer, Supplier } from '../types';

interface LedgerProps {
  type: 'customers' | 'suppliers';
  showAddFormGlobally: boolean;
  setShowAddFormGlobally: (show: boolean) => void;
}

export const Ledger: React.FC<LedgerProps> = ({ 
  type, 
  showAddFormGlobally, 
  setShowAddFormGlobally 
}) => {
  const { 
    customers, 
    suppliers, 
    sales, 
    purchases, 
    adjustments,
    payments,
    ledgerEntries,
    addCustomer, 
    updateCustomer, 
    deleteCustomer,
    addSupplier, 
    updateSupplier, 
    deleteSupplier,
    recordCustomerPayment,
    recordSupplierPayment,
    addManualAuditLog,
    settings 
  } = useERP();

  const [search, setSearch] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Form Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | Supplier | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [optionalField, setOptionalField] = useState(''); // shopName for customers, address for suppliers
  const [balance, setBalance] = useState(0);

  // Payment Recording Form
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'other'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');

  // Overpayment confirmation state
  const [isOverpaymentOpen, setIsOverpaymentOpen] = useState(false);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState(0);

  // Drawer tab state: 'ledger' | 'advance'
  const [drawerTab, setDrawerTab] = useState<'ledger' | 'advance'>('ledger');

  // Handle global trigger to open form
  React.useEffect(() => {
    if (showAddFormGlobally) {
      openAddModal();
      setShowAddFormGlobally(false);
    }
  }, [showAddFormGlobally]);

  const activeList = useMemo(() => {
    return type === 'customers' ? customers : suppliers;
  }, [type, customers, suppliers]);

  const filteredList = useMemo(() => {
    return activeList.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) || 
      item.phone.toLowerCase().includes(search.toLowerCase())
    );
  }, [activeList, search]);

  const activeDetailItem = useMemo(() => {
    return activeList.find(item => item.id === selectedEntityId) || null;
  }, [activeList, selectedEntityId]);

  // Reset drawer tab when switching entity
  React.useEffect(() => {
    setDrawerTab('ledger');
  }, [selectedEntityId]);

  // Derived ledger transaction histories
  const ledgerHistory = useMemo(() => {
    if (!selectedEntityId) return [];

    const entries = ledgerEntries.filter(
      entry => entry.entityId === selectedEntityId && entry.entityType === (type === 'customers' ? 'customer' : 'supplier')
    );

    const sortedChronologically = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const historyWithRunningBalance = sortedChronologically.map(entry => {
      if (type === 'customers') {
        runningBalance += (entry.debit - entry.credit);
      } else {
        runningBalance += (entry.credit - entry.debit);
      }
      return {
        ...entry,
        runningBalance
      };
    });

    return historyWithRunningBalance.reverse();
  }, [ledgerEntries, selectedEntityId, type]);

  // Advance transaction history — only entries related to advance (saved or adjusted)
  const advanceHistory = useMemo(() => {
    if (!selectedEntityId) return [];
    const entityType = type === 'customers' ? 'customer' : 'supplier';
    return ledgerEntries
      .filter(e =>
        e.entityId === selectedEntityId &&
        e.entityType === entityType &&
        (e.description.toLowerCase().includes('advance') )
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledgerEntries, selectedEntityId, type]);

  // Calculations
  const metrics = useMemo(() => {
    const totalOutstanding = activeList.reduce((sum, item) => {
      const bal = Number(item.balance) || 0;
      return sum + (bal > 0 ? bal : 0);
    }, 0);
    const totalCreditDealers = activeList.filter(item => (Number(item.balance) || 0) > 0).length;
    return { totalOutstanding, totalCreditDealers };
  }, [activeList]);

  // CRUD Trigger modals
  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setPhone('');
    setOptionalField('');
    setBalance(0);
    setIsFormOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setPhone(item.phone);
    setOptionalField(type === 'customers' ? (item.shopName || '') : (item.address || ''));
    setBalance(item.balance);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !phone.trim()) {
      alert('Name and Phone are required.');
      return;
    }

    try {
      if (type === 'customers') {
        const custPayload = {
          name,
          phone,
          shopName: optionalField,
          balance: Number(balance)
        };

        if (editingItem) {
          await updateCustomer(editingItem.id, custPayload);
        } else {
          await addCustomer(custPayload);
        }
      } else {
        const suppPayload = {
          name,
          phone,
          address: optionalField,
          balance: Number(balance)
        };

        if (editingItem) {
          await updateSupplier(editingItem.id, suppPayload);
        } else {
          await addSupplier(suppPayload);
        }
      }
      setIsFormOpen(false);
    } catch (err) {
      alert('Operation failed.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you absolutely sure you want to delete this profile? All ledger transaction histories will be archived.')) {
      try {
        if (type === 'customers') {
          await deleteCustomer(id);
        } else {
          await deleteSupplier(id);
        }
        if (selectedEntityId === id) setSelectedEntityId(null);
      } catch (err) {
        alert('Failed to delete item.');
      }
    }
  };

  // RECORD KHATA PAYMENT
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEntityId || !activeDetailItem) return;

    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    const currentOutstanding = activeDetailItem.balance || 0;

    if (paymentAmount > currentOutstanding) {
      setPendingPaymentAmount(paymentAmount);
      setIsOverpaymentOpen(true);
      return;
    }

    await executePaymentPosting(paymentAmount);
  };

  const executePaymentPosting = async (amountToPost: number) => {
    if (!selectedEntityId || !activeDetailItem) return;

    try {
      const now = new Date().toISOString();
      if (type === 'customers') {
        const currentCust = activeDetailItem as Customer;
        await recordCustomerPayment({
          date: now,
          entityId: currentCust.id,
          entityName: currentCust.name,
          amount: amountToPost,
          paymentMethod: paymentMethod,
          referenceNumber: referenceNumber || undefined,
          remarks: paymentNotes || 'Counter Payment'
        });
      } else {
        const currentSupp = activeDetailItem as Supplier;
        await recordSupplierPayment({
          date: now,
          entityId: currentSupp.id,
          entityName: currentSupp.name,
          amount: amountToPost,
          paymentMethod: paymentMethod,
          referenceNumber: referenceNumber || undefined,
          remarks: paymentNotes || 'Cash Handover'
        });
      }

      alert('Khata transaction saved. Ledger balance updated instantly!');
      setIsPaymentOpen(false);
      setPaymentAmount(0);
      setPaymentNotes('');
      setReferenceNumber('');
      setPaymentMethod('cash');
    } catch (err) {
      alert('Failed to save payment.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP METRIC STRIPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {type === 'customers' ? 'Total Receivables (Udhaar)' : 'Total Payables (Our Credit)'}
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {settings.currency} {metrics.totalOutstanding.toLocaleString()}
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Outstanding across {metrics.totalCreditDealers} registered {type}
            </span>
          </div>
          <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600">
            <Coins className="h-6 w-6 stroke-[1.8]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Registered {type === 'customers' ? 'Customers' : 'Suppliers'}
            </span>
            <h3 className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {activeList.length} <span className="text-xs font-normal text-slate-500">dealers</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">In active khata database</span>
          </div>
          <div className="p-3.5 bg-slate-100 rounded-xl text-slate-500">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Action summary */}
        <div className="bg-slate-900 text-slate-100 p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quick Actions</p>
          <button
            onClick={openAddModal}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add New {type === 'customers' ? 'Customer' : 'Supplier'}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN LAYOUT GRID (DASHBOARD-STYLE TABLE AND PROFILE DETAIL DRAWER) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* LEDGER TABLE CARD */}
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-bold text-slate-800">
                {type === 'customers' ? 'Customer Khata Registries' : 'Supplier Credit Registries'}
              </h3>
              <span className="text-[10px] text-slate-400">Ledger details and outstanding balances</span>
            </div>

            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search by name or phone...`}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Dealer Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">{type === 'customers' ? 'Shop Name' : 'Office Address'}</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  filteredList.map((item) => {
                    const isSelected = item.id === selectedEntityId;
                    const hasOutstanding = (Number(item.balance) || 0) > 0;
                    return (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedEntityId(item.id)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-800">{item.name}</td>
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                          <span className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900">
                            <Smartphone className="h-3 w-3" />
                            {item.phone}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 truncate max-w-[200px]" title={type === 'customers' ? (item as Customer).shopName : (item as Supplier).address}>
                          {type === 'customers' ? ((item as Customer).shopName || 'N/A') : ((item as Supplier).address || 'N/A')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                              hasOutstanding 
                                ? 'bg-red-50 text-red-600 border border-red-100' 
                                : 'bg-emerald-50 text-emerald-800'
                            }`}>
                              Rs. {(Number(item.balance) || 0).toLocaleString()}
                            </span>
                            {Number((item as any).advance || 0) > 0 && (
                              <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100/60 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                Adv: Rs. {Number((item as any).advance).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DYNAMIC LEDGER KHATA DRAWER */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col h-[520px]">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Khata Statement</h3>
            {selectedEntityId && (
              <button onClick={() => setSelectedEntityId(null)} className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase">Clear</button>
            )}
          </div>

          {!activeDetailItem ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-1.5 my-auto">
              <FileText className="h-10 w-10 text-slate-300 stroke-1 animate-pulse" />
              <p className="text-xs font-semibold">Select a Dealer profile</p>
              <p className="text-[10px] max-w-[180px] leading-relaxed mx-auto">Click any client or supplier in the khata registries to view billing records and adjust payments.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full min-h-0">
              {/* Profile Summary with Balance Cards */}
              <div className="py-2 border-b border-slate-100 shrink-0">
                <h4 className="text-sm font-black text-slate-800 leading-tight">{activeDetailItem.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono">{activeDetailItem.phone}</p>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Outstanding</p>
                    <p className="font-mono font-bold text-red-600 text-xs mt-0.5">
                      Rs. {(Number(activeDetailItem.balance) || 0).toLocaleString()}
                    </p>
                  </div>
                  <div
                    className="flex-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors"
                    onClick={() => setDrawerTab('advance')}
                    title="Click to view advance history"
                  >
                    <p className="text-[9px] text-emerald-600 font-bold uppercase">Advance</p>
                    <p className="font-mono font-bold text-emerald-700 text-xs mt-0.5">
                      Rs. {(Number((activeDetailItem as any).advance) || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="flex gap-1 my-2 shrink-0">
                <button
                  onClick={() => setDrawerTab('ledger')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${drawerTab === 'ledger' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  Invoices & Logs
                </button>
                <button
                  onClick={() => setDrawerTab('advance')}
                  className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors flex items-center justify-center gap-1 ${drawerTab === 'advance' ? 'bg-emerald-700 text-white' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'}`}
                >
                  Advance History
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${drawerTab === 'advance' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                    {advanceHistory.length}
                  </span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">

                {/* LEDGER TAB */}
                {drawerTab === 'ledger' && (
                  <div className="space-y-2.5">
                    {ledgerHistory.length === 0 ? (
                      <p className="text-[10px] text-center text-slate-400 py-6 italic">No invoice transactions linked to this profile.</p>
                    ) : (
                      ledgerHistory.map((line, idx) => (
                        <div key={line.id || idx} className="p-2.5 bg-slate-50/50 border border-slate-100 rounded flex flex-col gap-0.5 text-[11px]">
                          <div className="flex justify-between font-mono text-[9px] text-slate-400">
                            <span>{new Date(line.date).toLocaleDateString()} {new Date(line.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="font-bold text-blue-600">{line.referenceNumber}</span>
                          </div>
                          <p className="font-semibold text-slate-800">{line.description}</p>
                          <div className="flex justify-between items-center text-[10px] mt-1 border-t border-slate-100/50 pt-1">
                            {type === 'customers' ? (
                              <>
                                <span className="text-red-500">Dr: Rs.{line.debit.toLocaleString()}</span>
                                <span className="text-emerald-600 font-medium">Cr: Rs.{line.credit.toLocaleString()}</span>
                                <span className="font-bold text-slate-700">Bal: Rs.{line.runningBalance.toLocaleString()}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-red-500 font-medium">Cr: Rs.{line.credit.toLocaleString()}</span>
                                <span className="text-emerald-600">Dr: Rs.{line.debit.toLocaleString()}</span>
                                <span className="font-bold text-slate-700">Bal: Rs.{line.runningBalance.toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ADVANCE HISTORY TAB */}
                {drawerTab === 'advance' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Current Advance Balance</p>
                      <p className="text-lg font-black font-mono text-emerald-800 mt-0.5">
                        Rs. {(Number((activeDetailItem as any).advance) || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-emerald-600 mt-0.5">
                        {type === 'customers' ? 'Auto-adjusts on next sale invoice' : 'Auto-adjusts on next purchase invoice'}
                      </p>
                    </div>

                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pt-1">Advance Transactions</p>

                    {advanceHistory.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-1.5">
                        <TrendingUp className="h-7 w-7 text-slate-300 stroke-1" />
                        <p className="text-[10px]">No advance transactions yet.</p>
                        <p className="text-[9px] text-slate-300 max-w-[160px] leading-relaxed">
                          Advance is created when a payment exceeds the outstanding balance.
                        </p>
                      </div>
                    ) : (
                      advanceHistory.map((entry, idx) => {
                        const isAdjusted = entry.description.toLowerCase().includes('applied') || entry.description.toLowerCase().includes('adjusted');
                        const advAmt = isAdjusted
                          ? (type === 'customers' ? entry.credit : entry.debit)
                          : (type === 'customers' ? entry.debit : entry.credit);
                        return (
                          <div key={entry.id || idx} className={`p-2.5 border rounded flex flex-col gap-0.5 text-[11px] ${isAdjusted ? 'bg-blue-50/50 border-blue-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                            <div className="flex justify-between font-mono text-[9px] text-slate-400">
                              <span>{new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span className={`font-bold ${isAdjusted ? 'text-blue-600' : 'text-emerald-600'}`}>{entry.referenceNumber}</span>
                            </div>
                            <p className="font-semibold text-slate-800 leading-snug">{entry.description}</p>
                            <div className="mt-1 pt-1 border-t border-slate-100/50">
                              {isAdjusted ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                  − Advance Used: Rs. {advAmt.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                  + Advance Added: Rs. {advAmt.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Record Payment Button */}
              {activeDetailItem && (
                <button
                  onClick={() => setIsPaymentOpen(true)}
                  className="w-full mt-3 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                >
                  <Coins className="h-4 w-4 text-blue-500" />
                  <span>{type === 'customers' ? 'Record Payment Received' : 'Record Payment Sent'}</span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 3. ADD / EDIT DEALER PROFILE MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold">
                {editingItem ? 'Edit Profile' : `Add New ${type === 'customers' ? 'Customer' : 'Supplier'}`}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Dealer/Contact Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Sajid Mehmood Autos"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 0300-1234567"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">
                  {type === 'customers' ? 'Shop Name / Notes' : 'Office/Shop Address'}
                </label>
                <input
                  type="text"
                  value={optionalField}
                  onChange={(e) => setOptionalField(e.target.value)}
                  placeholder={type === 'customers' ? "e.g., Sajid workshop" : "e.g., Badami Bagh, Lahore"}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Starting Balance Ledger (Rs.)</label>
                <input
                  type="number"
                  disabled={!!editingItem} // Ledger balance is adjusted via payments for perfect double entry!
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-200 disabled:bg-slate-50 rounded-lg text-xs font-mono focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 block leading-tight">
                  {type === 'customers' 
                    ? 'Positive means customer owes you money. Negative means they paid in advance.' 
                    : 'Positive means you owe the supplier. Negative means advance payment sent.'}
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. KHATA PAYMENT DIALOG MODAL */}
      {isPaymentOpen && activeDetailItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xs w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold">Record Khata Transaction</h3>
              <button onClick={() => setIsPaymentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div className="text-xs space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
                <p className="text-slate-500 font-semibold">{type === 'customers' ? 'Receive Payment From:' : 'Send Payment To:'}</p>
                <p className="text-slate-800 font-bold text-sm">{activeDetailItem.name}</p>
                <p className="text-[10px] font-mono text-slate-400">Current Outstanding: Rs. {(Number(activeDetailItem.balance) || 0).toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Payment Amount (Rs.) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="cheque">Cheque / Promissory</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Transaction Reference / Receipt #</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g., TID-293847, Cheque 8820"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Internal Remarks</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g., Paid at counter, outstanding adjustment"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                >
                  Post Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. OVERPAYMENT OPTION DIALOG */}
      {isOverpaymentOpen && activeDetailItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500 animate-bounce" />
                <span>Payment Overrun Detected</span>
              </h3>
              <button onClick={() => setIsOverpaymentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  This payment of <strong className="text-slate-900 font-mono">Rs. {pendingPaymentAmount.toLocaleString()}</strong> exceeds the current outstanding amount of <strong className="text-slate-900 font-mono">Rs. {(activeDetailItem.balance || 0).toLocaleString()}</strong> by:
                </p>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center font-mono font-bold text-amber-800 text-lg">
                  Rs. {(pendingPaymentAmount - (activeDetailItem.balance || 0)).toLocaleString()}
                </div>
                <p>Please select how you would like to handle this extra amount:</p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsOverpaymentOpen(false);
                    await executePaymentPosting(activeDetailItem.balance || 0);
                  }}
                  className="w-full text-left p-3 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 rounded-lg transition-all"
                >
                  <p className="text-xs font-bold text-blue-800">Adjust Payment to Outstanding (Recommended)</p>
                  <p className="text-[10px] text-blue-600 mt-0.5">Automatically change payment to Rs. {(activeDetailItem.balance || 0).toLocaleString()}. No advance balance is saved.</p>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsOverpaymentOpen(false);
                    await executePaymentPosting(pendingPaymentAmount);
                  }}
                  className="w-full text-left p-3 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg transition-all"
                >
                  <p className="text-xs font-bold text-emerald-800">Save Extra Amount as Advance</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Post full Rs. {pendingPaymentAmount.toLocaleString()}. The excess Rs. {(pendingPaymentAmount - (activeDetailItem.balance || 0)).toLocaleString()} will be saved as an advance balance.</p>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsOverpaymentOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold"
                >
                  Cancel & Edit Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
