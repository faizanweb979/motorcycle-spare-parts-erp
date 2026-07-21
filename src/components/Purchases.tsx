import React, { useState, useMemo } from 'react';
import { 
  Briefcase, 
  Search, 
  Trash2, 
  CheckCircle2, 
  History, 
  Printer, 
  CornerUpLeft, 
  Plus, 
  PlusCircle, 
  X,
  FileText,
  Minus
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Part, Supplier, Purchase, PurchaseItem } from '../types';

export const Purchases: React.FC = () => {
  const { parts, suppliers, purchases, createPurchase, returnPurchase, settings } = useERP();

  const [purchaseTab, setPurchaseTab] = useState<'form' | 'history'>('form');

  // New Purchase states
  const [supplierId, setSupplierId] = useState('');
  const [partQuery, setPartQuery] = useState('');
  const [itemsList, setItemsList] = useState<{ partId: string; partNumber: string; name: string; quantity: number; purchasePrice: number }[]>([]);
  const [paidAmount, setPaidAmount] = useState(0);

  // Overpayment dialog state
  const [isOverpaymentOpen, setIsOverpaymentOpen] = useState(false);
  const [pendingPurchasePayload, setPendingPurchasePayload] = useState<any>(null);
  const [overpaymentExcess, setOverpaymentExcess] = useState(0);

  // History states
  const [historySearch, setHistorySearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Purchase | null>(null);

  // Filter parts for search
  const searchedParts = useMemo(() => {
    if (!partQuery.trim()) return [];
    const query = partQuery.toLowerCase();
    return parts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.partNumber.toLowerCase().includes(query) || 
      p.brand.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [parts, partQuery]);

  // Calculations for current purchase form
  const purchaseSubtotal = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
  }, [itemsList]);

  const balanceDue = useMemo(() => {
    return Math.max(0, purchaseSubtotal - paidAmount);
  }, [purchaseSubtotal, paidAmount]);

  // Add Item to Purchase list
  const addItemToPurchase = (part: Part) => {
    const existingIndex = itemsList.findIndex(item => item.partId === part.id);
    if (existingIndex > -1) {
      const updatedList = [...itemsList];
      updatedList[existingIndex].quantity += 1;
      setItemsList(updatedList);
    } else {
      setItemsList([...itemsList, {
        partId: part.id,
        partNumber: part.partNumber,
        name: part.name,
        quantity: 1,
        purchasePrice: part.purchasePrice // Default to current database wholesale cost
      }]);
    }
    setPartQuery('');
  };

  const updateQuantity = (partId: string, delta: number) => {
    setItemsList(itemsList.map(item => {
      if (item.partId === partId) {
        const qty = item.quantity + delta;
        return qty <= 0 ? null : { ...item, quantity: qty };
      }
      return item;
    }).filter(Boolean) as any);
  };

  const updatePurchasePrice = (partId: string, price: number) => {
    setItemsList(itemsList.map(item => {
      if (item.partId === partId) {
        return { ...item, purchasePrice: Math.max(0, price) };
      }
      return item;
    }));
  };

  const removeItem = (partId: string) => {
    setItemsList(itemsList.filter(item => item.partId !== partId));
  };

  const clearPurchaseForm = () => {
    setSupplierId('');
    setItemsList([]);
    setPaidAmount(0);
    setPartQuery('');
  };

  // Submit Purchase
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      alert('Please select a registered supplier first.');
      return;
    }

    if (itemsList.length === 0) {
      alert('Please add at least one spare part to restock.');
      return;
    }

    const supplierDetails = suppliers.find(s => s.id === supplierId);
    const supplierName = supplierDetails?.name || 'Registered Supplier';

    const payload = {
      supplierId,
      supplierName,
      date: new Date().toISOString(),
      totalAmount: purchaseSubtotal,
      paidAmount,
      balanceAmount: Math.max(0, purchaseSubtotal - paidAmount),
      status: 'completed' as const,
      items: itemsList.map(it => ({
        ...it,
        total: it.purchasePrice * it.quantity
      }))
    };

    // Overpayment check: paidAmount > totalAmount
    if (paidAmount > purchaseSubtotal) {
      const excess = paidAmount - purchaseSubtotal;
      setPendingPurchasePayload(payload);
      setOverpaymentExcess(excess);
      setIsOverpaymentOpen(true);
      return;
    }

    await submitPurchasePayload(payload);
  };

  const submitPurchasePayload = async (payload: any) => {
    try {
      await createPurchase(payload);
      alert('Supplier purchase order processed successfully! Warehouse inventory restocked.');
      clearPurchaseForm();
      setPurchaseTab('history');
    } catch (err: any) {
      alert(`Failed to record purchase: ${err.message}`);
    }
  };

  // Filter Purchase logs
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => 
      p.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase()) || 
      p.supplierName.toLowerCase().includes(historySearch.toLowerCase())
    );
  }, [purchases, historySearch]);

  // Return/cancel purchase from supplier
  const handleReturnPurchase = async (purchase: Purchase) => {
    const confirmReturn = confirm(`Are you sure you want to return items from Supplier Invoice ${purchase.invoiceNumber}? This will deduct the returned quantities from stock and reduce outstanding supplier balance.`);
    if (confirmReturn) {
      try {
        const returnedItems = purchase.items.map(it => ({
          partId: it.partId,
          quantity: it.quantity
        }));
        
        // Reverts credit balance added
        const refundAmount = purchase.balanceAmount;

        await returnPurchase(purchase.id, returnedItems, refundAmount);
        alert('Supplier purchase invoice returned. Quantities deducted from warehouse.');
      } catch (err) {
        alert('Return failed.');
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Module Subheader Switch tabs */}
      <div className="flex bg-white p-2 rounded-xl border border-slate-200 shadow-xs max-w-sm justify-between gap-1">
        <button
          onClick={() => setPurchaseTab('form')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            purchaseTab === 'form' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>New Supplier Order</span>
        </button>
        <button
          onClick={() => setPurchaseTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            purchaseTab === 'history' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Purchases Logs</span>
        </button>
      </div>

      {purchaseTab === 'form' ? (
        /* PURCHASE RECEIVING FORM VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Main items selector */}
          <div className="lg:col-span-2 space-y-5">
            {/* Search Part to Add */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-slate-800">Warehouse Restocking</h3>
                <span className="text-[10px] text-slate-400">Search spare parts to append to supplier billing sheet</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={partQuery}
                  onChange={(e) => setPartQuery(e.target.value)}
                  placeholder="Type code, part description, model compatibility..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Autocomplete Popup */}
              {partQuery.trim() !== '' && (
                <div className="border border-slate-200 rounded-lg bg-white shadow-lg divide-y divide-slate-100 overflow-hidden">
                  {searchedParts.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">No spare parts matched query.</p>
                  ) : (
                    searchedParts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addItemToPurchase(p)}
                        className="p-3 hover:bg-blue-50/50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{p.brand} · {p.modelCompatibility}</p>
                        </div>
                        <div className="text-right font-mono text-xs font-bold text-slate-700">
                          Cost: Rs. {p.purchasePrice}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Purchase items list */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">Supplier Order Lines ({itemsList.length})</span>
                {itemsList.length > 0 && (
                  <button onClick={clearPurchaseForm} className="text-xs font-semibold text-red-500 hover:text-red-700">
                    Cancel Order
                  </button>
                )}
              </div>

              {itemsList.length === 0 ? (
                <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Briefcase className="h-12 w-12 text-slate-300 stroke-1" />
                  <p className="text-xs">No restock items selected.</p>
                  <p className="text-[10px] max-w-xs leading-relaxed">Search parts in the Restocking panel above to add them to this supplier invoice.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                        <th className="py-3 px-4">Part Details</th>
                        <th className="py-3 px-4 text-center">Restock Qty</th>
                        <th className="py-3 px-4 text-right">Wholesale Cost (Rs.)</th>
                        <th className="py-3 px-4 text-right">Line Total</th>
                        <th className="py-3 px-4 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                      {itemsList.map((item) => (
                        <tr key={item.partId} className="hover:bg-slate-50/20">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-800">{item.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">{item.partNumber}</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-2 border border-slate-200 rounded-lg p-1 bg-white">
                              <button 
                                type="button" 
                                onClick={() => updateQuantity(item.partId, -1)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 font-mono font-bold text-center text-slate-800">{item.quantity}</span>
                              <button 
                                type="button" 
                                onClick={() => updateQuantity(item.partId, 1)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-600"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.purchasePrice}
                              onChange={(e) => updatePurchasePrice(item.partId, Number(e.target.value))}
                              className="w-24 text-right px-2 py-1 border border-slate-200 rounded font-mono text-slate-800 focus:outline-hidden"
                            />
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            Rs. {(item.purchasePrice * item.quantity).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.partId)}
                              className="text-red-400 hover:text-red-600 p-1 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Supplier info, Paid totals, finalization */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 pb-3 border-b border-slate-100">Supplier Checkout</h3>

            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              {/* Supplier Picker */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Select Target Supplier *</label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="">-- Choose Registered Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Outstanding: Rs. {s.balance})
                    </option>
                  ))}
                </select>
              </div>

              {/* Supplier Balance Info — shown after selection */}
              {supplierId && (() => {
                const sel = suppliers.find(s => s.id === supplierId);
                if (!sel) return null;
                const outstanding = Number(sel.balance) || 0;
                const advance = Number((sel as any).advance) || 0;
                return (
                  <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {sel.name} — Account Summary
                    </div>
                    <div className="flex divide-x divide-slate-100">
                      <div className="flex-1 p-2.5">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Outstanding</p>
                        <p className={`font-mono font-bold text-sm mt-0.5 ${outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          Rs. {outstanding.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-slate-400">We owe supplier</p>
                      </div>
                      <div className={`flex-1 p-2.5 ${advance > 0 ? 'bg-emerald-50' : ''}`}>
                        <p className="text-[9px] text-emerald-600 font-bold uppercase">Advance</p>
                        <p className={`font-mono font-bold text-sm mt-0.5 ${advance > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          Rs. {advance.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-emerald-600">{advance > 0 ? 'Will auto-adjust' : 'No advance'}</p>
                      </div>
                    </div>
                    {advance > 0 && (
                      <div className="bg-emerald-50 border-t border-emerald-100 px-3 py-1.5 text-[10px] text-emerald-700 font-semibold">
                        ✓ Rs. {advance.toLocaleString()} advance will auto-adjust against this invoice
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pricing ledger */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-2.5">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Gross Cost Total:</span>
                  <span className="font-mono">Rs. {purchaseSubtotal.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-slate-500 font-semibold">Cash Amount Paid (Rs.):</label>
                  <input
                    type="number"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-24 text-right px-2 py-0.5 border border-slate-200 rounded font-mono text-slate-800 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-between font-bold text-slate-800 text-sm border-t border-slate-200 pt-2.5">
                  <span>Net Ledger Credit Due:</span>
                  <span className="font-mono text-blue-700">Rs. {balanceDue.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={itemsList.length === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-3 rounded-xl text-xs transition-colors shadow-xs flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                <span>Record Supplier Purchase</span>
              </button>
            </form>
          </div>

        </div>
      ) : (
        /* PURCHASE HISTORY LIST TAB */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* List of Purchases */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-800">Supplier Invoices Log</span>
                <span className="text-[10px] text-slate-400 font-mono">Archive of all parts inventory restocking sessions.</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2 text-slate-400 h-3.5 w-3.5" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search Invoice # or Supplier..."
                  className="pl-8 pr-3 py-1 border border-slate-200 rounded-lg text-xs w-52 focus:outline-hidden focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Receive Date</th>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4 text-right">Total Invoice</th>
                    <th className="py-3 px-4 text-right">Cash Paid</th>
                    <th className="py-3 px-4 text-right">Credit Added</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">No purchases found.</td>
                    </tr>
                  ) : (
                    filteredPurchases.map((pur) => {
                      const isReturned = pur.status === 'returned';
                      const isSelected = selectedInvoice?.id === pur.id;
                      return (
                        <tr 
                          key={pur.id} 
                          onClick={() => setSelectedInvoice(pur)}
                          className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{pur.invoiceNumber}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500">{new Date(pur.date).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">{pur.supplierName}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">Rs. {pur.totalAmount.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600">Rs. {pur.paidAmount.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium text-blue-800">Rs. {pur.balanceAmount.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isReturned ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
                            }`}>
                              {isReturned ? 'Returned' : 'Restocked'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            {!isReturned && (
                              <button
                                onClick={() => handleReturnPurchase(pur)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Return Purchase Order"
                              >
                                <CornerUpLeft className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Itemized Details Sidebar Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100 mb-4">Itemized Purchase Invoice</h3>
            
            {!selectedInvoice ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-1.5">
                <FileText className="h-9 w-9 text-slate-300 stroke-1" />
                <p className="text-xs">Select any supplier invoice on the table to inspect individual items received, wholesale cost rates, and tax/margin tallies.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${selectedInvoice.status === 'returned' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                    {selectedInvoice.status.toUpperCase()}
                  </span>
                  <h4 className="text-sm font-black text-slate-800 mt-1.5">Invoice: {selectedInvoice.invoiceNumber}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Supplier: {selectedInvoice.supplierName}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Date: {new Date(selectedInvoice.date).toLocaleString()}</p>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Received Parts List</p>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {selectedInvoice.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-800 leading-snug">{it.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">Code: {it.partNumber}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-bold text-slate-800">x{it.quantity}</p>
                          <p className="text-[9px] text-slate-400 font-mono">Rs.{it.purchasePrice}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Purchase:</span>
                    <span className="font-mono font-bold text-slate-800">Rs. {selectedInvoice.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Paid Cash:</span>
                    <span className="font-mono font-bold text-emerald-600">Rs. {selectedInvoice.paidAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                    <span className="text-slate-700">Vendor Credit Added:</span>
                    <span className="font-mono text-blue-700">Rs. {selectedInvoice.balanceAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* OVERPAYMENT DIALOG */}
      {isOverpaymentOpen && pendingPurchasePayload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span className="text-amber-400">⚠</span> Payment Overrun Detected
              </h3>
              <button onClick={() => setIsOverpaymentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  This payment of <strong className="font-mono text-slate-900">Rs. {paidAmount.toLocaleString()}</strong> exceeds the invoice total of <strong className="font-mono text-slate-900">Rs. {purchaseSubtotal.toLocaleString()}</strong> by:
                </p>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center font-mono font-bold text-amber-800 text-lg">
                  Rs. {overpaymentExcess.toLocaleString()}
                </div>
                <p>How would you like to handle this extra amount?</p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsOverpaymentOpen(false);
                    await submitPurchasePayload({ ...pendingPurchasePayload, paidAmount: purchaseSubtotal, balanceAmount: 0 });
                  }}
                  className="w-full text-left p-3 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 rounded-lg transition-all"
                >
                  <p className="text-xs font-bold text-blue-800">Adjust Payment to Invoice Total (Recommended)</p>
                  <p className="text-[10px] text-blue-600 mt-0.5">Change payment to Rs. {purchaseSubtotal.toLocaleString()}. No advance balance created.</p>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsOverpaymentOpen(false);
                    await submitPurchasePayload(pendingPurchasePayload);
                  }}
                  className="w-full text-left p-3 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg transition-all"
                >
                  <p className="text-xs font-bold text-emerald-800">Save Extra as Supplier Advance</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Post full Rs. {paidAmount.toLocaleString()}. Excess Rs. {overpaymentExcess.toLocaleString()} saved as supplier advance (auto-adjusts on next purchase).</p>
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
