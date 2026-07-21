import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  Check, 
  Printer, 
  ChevronRight, 
  User, 
  CheckCircle2, 
  History, 
  RefreshCw, 
  CornerUpLeft,
  X,
  CreditCard,
  Plus,
  Minus
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Part, Customer, Sale, SaleItem } from '../types';

export const SalesPOS: React.FC = () => {
  const { parts, customers, sales, createSale, returnSale, settings } = useERP();

  const [posTab, setPosTab] = useState<'register' | 'history'>('register');

  // Search & Cart states
  const [partQuery, setPartQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState('CASH-CUSTOMER');
  const [cart, setCart] = useState<Omit<SaleItem, 'total'>[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'bank_transfer'>('cash');
  const [paidAmount, setPaidAmount] = useState(0);

  // Search & filter states for sales history
  const [historySearch, setHistorySearch] = useState('');

  // Invoice view / Receipt Print state
  const [activeReceiptSale, setActiveReceiptSale] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'A4' | 'thermal'>('thermal');

  // Overpayment dialog state (for credit sales where paidAmount > cartTotal)
  const [isPosOverpaymentOpen, setIsPosOverpaymentOpen] = useState(false);
  const [pendingSalePayload, setPendingSalePayload] = useState<any>(null);
  const [posOverpaymentExcess, setPosOverpaymentExcess] = useState(0);

  // 1. FILTERED SEARCH FOR PARTS (ONLY WITH STOCK > 0)
  const posPartResults = useMemo(() => {
    if (!partQuery.trim()) return [];
    const query = partQuery.toLowerCase();
    return parts.filter(p => 
      p.stock > 0 && (
        p.name.toLowerCase().includes(query) || 
        p.partNumber.toLowerCase().includes(query) || 
        p.brand.toLowerCase().includes(query) ||
        p.modelCompatibility.toLowerCase().includes(query)
      )
    ).slice(0, 5);
  }, [parts, partQuery]);

  // 2. REGISTER POS CALCULATIONS
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.retailPrice * item.quantity), 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discount);
  }, [cartSubtotal, discount]);

  const balanceDue = useMemo(() => {
    if (paymentMethod === 'credit') {
      return Math.max(0, cartTotal - paidAmount);
    }
    return 0;
  }, [cartTotal, paidAmount, paymentMethod]);

  // If cash/bank transfer, paidAmount is usually total, or we can let user type it
  React.useEffect(() => {
    if (paymentMethod !== 'credit') {
      setPaidAmount(cartTotal);
    } else {
      setPaidAmount(0); // Clear paidAmount to let user record what was paid
    }
  }, [cartTotal, paymentMethod]);

  // 3. CART ACTIONS
  const addToCart = (part: Part) => {
    const existingIndex = cart.findIndex(item => item.partId === part.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      if (updatedCart[existingIndex].quantity < part.stock) {
        updatedCart[existingIndex].quantity += 1;
        setCart(updatedCart);
      } else {
        alert(`Cannot add more! Only ${part.stock} units available in stock.`);
      }
    } else {
      setCart([...cart, {
        partId: part.id,
        partNumber: part.partNumber,
        name: part.name,
        quantity: 1,
        purchasePrice: part.purchasePrice,
        retailPrice: part.retailPrice
      }]);
    }
    setPartQuery('');
  };

  const updateQuantity = (partId: string, delta: number) => {
    const part = parts.find(p => p.id === partId);
    if (!part) return;

    setCart(cart.map(item => {
      if (item.partId === partId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > part.stock) {
          alert(`Insufficient stock! Maximum ${part.stock} units available.`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as any);
  };

  const removeFromCart = (partId: string) => {
    setCart(cart.filter(item => item.partId !== partId));
  };

  const clearPOSRegister = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod('cash');
    setPaidAmount(0);
    setCustomerFilter('CASH-CUSTOMER');
  };

  // 4. CHECKOUT SUBMISSION
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert('Your billing cart is empty.');
      return;
    }

    if (paymentMethod === 'credit' && customerFilter === 'CASH-CUSTOMER') {
      alert('Credit sales require selecting a registered credit customer profile.');
      return;
    }

    const customerDetails = customers.find(c => c.id === customerFilter);
    const customerName = customerFilter === 'CASH-CUSTOMER' 
      ? 'Walk-In Cash Customer' 
      : (customerDetails?.name || 'Registered Customer');

    const salePayload = {
      customerId: customerFilter,
      customerName,
      date: new Date().toISOString(),
      totalAmount: cartSubtotal,
      discount,
      paidAmount,
      balanceAmount: balanceDue,
      paymentMethod,
      status: 'completed' as const,
      items: cart.map(item => ({
        ...item,
        total: item.retailPrice * item.quantity
      }))
    };

    // Overpayment check: for credit sales where paidAmount > net total
    if (paymentMethod === 'credit' && paidAmount > cartTotal) {
      const excess = paidAmount - cartTotal;
      setPendingSalePayload(salePayload);
      setPosOverpaymentExcess(excess);
      setIsPosOverpaymentOpen(true);
      return;
    }

    await submitSalePayload(salePayload);
  };

  const submitSalePayload = async (payload: any) => {
    try {
      const generatedSale = await createSale(payload);
      setActiveReceiptSale(generatedSale);
      setIsReceiptOpen(true);
      clearPOSRegister();
    } catch (err: any) {
      alert(`POS generation failed: ${err.message}`);
    }
  };

  // 5. SALES HISTORY FILTERS
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch = 
        s.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase()) || 
        s.customerName.toLowerCase().includes(historySearch.toLowerCase());
      return matchesSearch;
    });
  }, [sales, historySearch]);

  // 6. SALES RETURN
  const handleReturnInvoice = async (sale: Sale) => {
    const confirmReturn = confirm(`Are you sure you want to completely refund/return Invoice ${sale.invoiceNumber}? This will restore parts to inventory and reduce any outstanding customer credits.`);
    if (confirmReturn) {
      try {
        const returnedItems = sale.items.map(item => ({
          partId: item.partId,
          quantity: item.quantity
        }));
        
        // Refund amount is whatever was added to the customer credit, or full if they paid cash and we are returning it.
        const refundAmount = sale.balanceAmount; // Reverts credit balance

        await returnSale(sale.id, returnedItems, refundAmount);
        alert('Invoice successfully returned. Stock levels restored.');
      } catch (err) {
        alert('Return process failed.');
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Main POS Submenu tabs */}
      <div className="flex bg-white p-2 rounded-xl border border-slate-200 shadow-xs max-w-sm justify-between gap-1">
        <button
          onClick={() => setPosTab('register')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            posTab === 'register' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>POS Register</span>
        </button>
        <button
          onClick={() => setPosTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            posTab === 'history' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Sales Invoices</span>
        </button>
      </div>

      {posTab === 'register' ? (
        /* REGISTER POS VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Columns: Search and Items Selector */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Part Finder Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-slate-800">POS Item Selector</h3>
                <span className="text-[10px] text-slate-400">Scan barcode or search name to add directly to checkout cart</span>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={partQuery}
                  onChange={(e) => setPartQuery(e.target.value)}
                  placeholder="Scan barcode or type part name, brand, CD70/CG125 compatibility..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>

              {/* Instant Search Popover Results */}
              {partQuery.trim() !== '' && (
                <div className="border border-slate-200 rounded-lg bg-white shadow-lg divide-y divide-slate-100 overflow-hidden">
                  {posPartResults.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">No stocked parts matched your query.</p>
                  ) : (
                    posPartResults.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="p-3 hover:bg-blue-50/50 cursor-pointer flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{p.brand} · Part No: {p.partNumber} · Compatibility: {p.modelCompatibility}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-slate-900 font-mono">Rs. {p.retailPrice}</p>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Stock: {p.stock}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Checkout Billing Cart Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">Current Sales Cart ({cart.length} unique lines)</span>
                {cart.length > 0 && (
                  <button 
                    onClick={clearPOSRegister}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold"
                  >
                    Clear Bill
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                  <ShoppingCart className="h-12 w-12 text-slate-300 stroke-1" />
                  <p className="text-xs">Your sales cart is empty.</p>
                  <p className="text-[10px] max-w-xs leading-relaxed">Search and select items in the POS Selector above to build the customer's purchase invoice.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                        <th className="py-3 px-4">Part Details</th>
                        <th className="py-3 px-4 text-center">Qty Selector</th>
                        <th className="py-3 px-4 text-right">Unit Price</th>
                        <th className="py-3 px-4 text-right">Total Price</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                      {cart.map((item) => (
                        <tr key={item.partId} className="hover:bg-slate-50/20">
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-800">{item.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">Part Number: {item.partNumber}</span>
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
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">Rs. {item.retailPrice.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">Rs. {(item.retailPrice * item.quantity).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => removeFromCart(item.partId)}
                              className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
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

          {/* Right Column: Customer Details, Discounts, Payment & Final Billing */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 pb-3 border-b border-slate-100">POS Checkout</h3>
            
            <form onSubmit={handleCheckout} className="space-y-4">
              {/* Customer Profile Picker */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Select Billing Customer *</label>
                <div className="flex items-center gap-2">
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="CASH-CUSTOMER">Walk-In Cash Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Phone: {c.phone} - Bal: Rs. {c.balance})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer Balance Info — shown after selection */}
              {customerFilter !== 'CASH-CUSTOMER' && (() => {
                const sel = customers.find(c => c.id === customerFilter);
                if (!sel) return null;
                const outstanding = Number(sel.balance) || 0;
                const advance = Number((sel as any).advance) || 0;
                return (
                  <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <div className="flex divide-x divide-slate-100">
                      <div className="flex-1 p-2.5 bg-slate-50">
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Outstanding</p>
                        <p className={`font-mono font-bold text-sm mt-0.5 ${outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          Rs. {outstanding.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-slate-400">Customer owes us</p>
                      </div>
                      <div className={`flex-1 p-2.5 ${advance > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                        <p className="text-[9px] text-emerald-600 font-bold uppercase">Advance</p>
                        <p className={`font-mono font-bold text-sm mt-0.5 ${advance > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          Rs. {advance.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-emerald-600">{advance > 0 ? 'Will auto-adjust' : 'No advance'}</p>
                      </div>
                    </div>
                    {advance > 0 && (
                      <div className="bg-emerald-50 border-t border-emerald-100 px-3 py-1.5 text-[10px] text-emerald-700 font-semibold">
                        ✓ Rs. {advance.toLocaleString()} advance will auto-adjust against this bill
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Payment Method Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 block">Payment Mode *</label>
                <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      paymentMethod === 'cash' 
                        ? 'bg-blue-600 border-blue-600 text-white font-bold' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      paymentMethod === 'bank_transfer' 
                        ? 'bg-blue-600 border-blue-600 text-white font-bold' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Bank/EasyPaisa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      paymentMethod === 'credit' 
                        ? 'bg-blue-600 border-blue-600 text-white font-bold' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Credit / Udhaar
                  </button>
                </div>
              </div>

              {/* Subtotal, Discount & Final Amount Panel */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-2.5">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-500">Cart Subtotal:</span>
                  <span className="font-mono text-slate-800">Rs. {cartSubtotal.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-slate-500 font-medium">Flat Discount (Rs.):</label>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-24 text-right px-2 py-0.5 border border-slate-200 rounded font-mono text-slate-800 focus:outline-hidden"
                  />
                </div>

                {paymentMethod === 'credit' && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <label className="text-slate-500 font-medium">Partial Paid Amount (Rs.):</label>
                    <input
                      type="number"
                      min={0}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      className="w-24 text-right px-2 py-0.5 border border-slate-200 rounded font-mono text-slate-800 focus:outline-hidden"
                    />
                  </div>
                )}

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 font-bold text-slate-800 text-sm">
                  <span>Net Payable Amount:</span>
                  <span className="font-mono text-blue-600 text-base">Rs. {cartTotal.toLocaleString()}</span>
                </div>

                {paymentMethod === 'credit' && balanceDue > 0 && (
                  <div className="flex justify-between text-xs text-red-600 pt-1.5 font-semibold">
                    <span>Outstanding Ledger balance:</span>
                    <span className="font-mono">Rs. {balanceDue.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={cart.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 font-bold text-white py-3 rounded-xl text-xs transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Issue POS Invoice</span>
              </button>
            </form>
          </div>

        </div>
      ) : (
        /* SALES HISTORY TAB */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-800">Sales Invoices Log</h3>
              <span className="text-[10px] text-slate-400">Search past POS bills, returns, and invoice printouts.</span>
            </div>

            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search Invoice # or Customer..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Billing Date</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4 text-right">Gross Total</th>
                  <th className="py-3 px-4 text-right">Discount</th>
                  <th className="py-3 px-4 text-right">Net Collection</th>
                  <th className="py-3 px-4 text-center">Mode</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">No matching sales invoices found.</td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const isReturned = sale.status === 'returned';
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{sale.invoiceNumber}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">{new Date(sale.date).toLocaleDateString()}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{sale.customerName}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium">Rs. {sale.totalAmount.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-red-500">Rs. {sale.discount.toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-950">Rs. {(sale.totalAmount - sale.discount).toLocaleString()}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold text-[10px] uppercase">
                            {sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isReturned ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {isReturned ? 'Returned' : 'Paid OK'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setActiveReceiptSale(sale);
                                setIsReceiptOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded"
                              title="Print Receipt"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            {!isReturned && (
                              <button
                                onClick={() => handleReturnInvoice(sale)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Return Sale (Refund)"
                              >
                                <CornerUpLeft className="h-3.5 w-3.5" />
                              </button>
                            )}
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
      )}

      {/* 4. RECEIPT PRINTER POPUP / MODAL (HIGH CRAFT) */}
      {isReceiptOpen && activeReceiptSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 overflow-hidden">
            {/* Modal Actions */}
            <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center text-xs">
              <div className="flex rounded-lg border border-slate-700 overflow-hidden p-0.5 bg-slate-950">
                <button
                  onClick={() => setReceiptType('thermal')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${receiptType === 'thermal' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Thermal Receipt (72mm)
                </button>
                <button
                  onClick={() => setReceiptType('A4')}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${receiptType === 'A4' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  A4 Invoice
                </button>
              </div>
              
              <button onClick={() => { setIsReceiptOpen(false); setActiveReceiptSale(null); }} className="p-1 text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Print Area Preview */}
            <div className="p-6 bg-slate-100 max-h-[70vh] overflow-y-auto">
              {receiptType === 'thermal' ? (
                /* THERMAL RECEIPT DISPLAY (3 INCH STYLE) */
                <div className="bg-blue-50/10 border border-slate-200 p-4 rounded-md shadow-xs bg-white text-slate-900 text-xs font-mono max-w-[280px] mx-auto divide-y divide-dashed divide-slate-300">
                  {/* Shop Details */}
                  <div className="text-center pb-4 space-y-1">
                    <h2 className="text-sm font-black uppercase tracking-tight">{settings.shopName}</h2>
                    <p className="text-[10px] leading-snug">{settings.address}</p>
                    <p className="text-[10px]">Ph: {settings.phone}</p>
                  </div>

                  {/* Meta data */}
                  <div className="py-2.5 text-[10px] space-y-0.5">
                    <p>INV #: {activeReceiptSale.invoiceNumber}</p>
                    <p>Date: {new Date(activeReceiptSale.date).toLocaleString('en-US', { hour12: true })}</p>
                    <p>Cust: {activeReceiptSale.customerName}</p>
                  </div>

                  {/* Invoice Lines */}
                  <div className="py-3 space-y-2">
                    <div className="grid grid-cols-4 font-bold text-[10px] border-b border-dashed border-slate-300 pb-1 text-slate-400">
                      <span className="col-span-2">Item</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Price</span>
                    </div>
                    {activeReceiptSale.items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-0.5 text-[10px] leading-snug">
                        <span className="col-span-2 line-clamp-2">{it.name}</span>
                        <span className="text-center">x{it.quantity}</span>
                        <span className="text-right">Rs.{it.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Calculations */}
                  <div className="py-2.5 text-[10px] space-y-1 text-right">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>Rs. {activeReceiptSale.totalAmount.toLocaleString()}</span>
                    </div>
                    {activeReceiptSale.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Discount:</span>
                        <span>-Rs. {activeReceiptSale.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 border-t border-dashed border-slate-300 pt-1 text-xs">
                      <span>NET AMOUNT:</span>
                      <span>Rs. {(activeReceiptSale.totalAmount - activeReceiptSale.discount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount Paid:</span>
                      <span>Rs. {activeReceiptSale.paidAmount.toLocaleString()}</span>
                    </div>
                    {activeReceiptSale.balanceAmount > 0 && (
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Credit Outstanding:</span>
                        <span>Rs. {activeReceiptSale.balanceAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer message */}
                  <div className="text-center pt-3 text-[9px] text-slate-400 leading-normal">
                    <p>{settings.footerMessage}</p>
                    <p className="mt-1 font-sans">Developed by AI Studio ERP</p>
                  </div>
                </div>
              ) : (
                /* STANDARD OFFICE A4 INVOICE SHEET PREVIEW */
                <div className="bg-white border border-slate-300 p-5 rounded-md shadow-xs text-xs space-y-4 text-slate-700">
                  <div className="flex justify-between border-b pb-3 border-slate-100">
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-800">{settings.shopName}</h2>
                      <p className="text-[10px] text-slate-400">{settings.address}</p>
                      <p className="text-[10px] text-slate-400">Ph: {settings.phone}</p>
                    </div>
                    <div className="text-right">
                      <h1 className="text-base font-black text-slate-900 tracking-tight uppercase">Tax Invoice</h1>
                      <p className="font-mono text-[10px] font-bold text-blue-600">INV #: {activeReceiptSale.invoiceNumber}</p>
                      <p className="text-[10px] font-mono text-slate-400">{new Date(activeReceiptSale.date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="text-[10px] bg-slate-50 p-2.5 rounded border border-slate-100">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[9px] mb-1">Bill To / Customer Details</p>
                    <p className="text-slate-800 font-bold">{activeReceiptSale.customerName}</p>
                    <p className="text-slate-500 font-mono">Invoice Date: {new Date(activeReceiptSale.date).toLocaleString()}</p>
                  </div>

                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b font-bold text-slate-400">
                        <th className="py-1">Part / Item Detail</th>
                        <th className="py-1 text-center">Qty</th>
                        <th className="py-1 text-right">Rate</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeReceiptSale.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2">
                            <span className="font-bold text-slate-800">{it.name}</span>
                            <p className="text-[9px] text-slate-400 font-mono">Code: {it.partNumber}</p>
                          </td>
                          <td className="py-2 text-center font-mono">{it.quantity}</td>
                          <td className="py-2 text-right font-mono">Rs. {it.retailPrice}</td>
                          <td className="py-2 text-right font-mono font-bold text-slate-800">Rs. {it.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t pt-2.5 text-right space-y-1 text-[11px]">
                    <div className="flex justify-between max-w-[200px] ml-auto">
                      <span className="text-slate-400">Gross Total:</span>
                      <span className="font-mono">Rs. {activeReceiptSale.totalAmount.toLocaleString()}</span>
                    </div>
                    {activeReceiptSale.discount > 0 && (
                      <div className="flex justify-between max-w-[200px] ml-auto text-red-600">
                        <span>Discount:</span>
                        <span className="font-mono">-Rs. {activeReceiptSale.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between max-w-[200px] ml-auto font-bold text-slate-800 text-xs border-t pt-1">
                      <span>Total Amount Due:</span>
                      <span className="font-mono text-blue-600">Rs. {(activeReceiptSale.totalAmount - activeReceiptSale.discount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between max-w-[200px] ml-auto text-emerald-600 font-semibold">
                      <span>Paid Amount:</span>
                      <span className="font-mono">Rs. {activeReceiptSale.paidAmount.toLocaleString()}</span>
                    </div>
                    {activeReceiptSale.balanceAmount > 0 && (
                      <div className="flex justify-between max-w-[200px] ml-auto text-red-600 font-bold">
                        <span>Udhaar Credit:</span>
                        <span className="font-mono">Rs. {activeReceiptSale.balanceAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Print Trigger Button mockup */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => {
                  window.print(); // Direct standard print trigger
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="h-4 w-4" />
                <span>Simulate / Print</span>
              </button>
              <button
                onClick={() => { setIsReceiptOpen(false); setActiveReceiptSale(null); }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS OVERPAYMENT DIALOG */}
      {isPosOverpaymentOpen && pendingSalePayload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span className="text-amber-400">⚠</span> Payment Exceeds Sale Total
              </h3>
              <button onClick={() => setIsPosOverpaymentOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  Paid amount <strong className="font-mono text-slate-900">Rs. {paidAmount.toLocaleString()}</strong> exceeds net sale total of <strong className="font-mono text-slate-900">Rs. {cartTotal.toLocaleString()}</strong> by:
                </p>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center font-mono font-bold text-amber-800 text-lg">
                  Rs. {posOverpaymentExcess.toLocaleString()}
                </div>
                <p>How would you like to handle this extra amount?</p>
              </div>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    setIsPosOverpaymentOpen(false);
                    await submitSalePayload({ ...pendingSalePayload, paidAmount: cartTotal, balanceAmount: 0 });
                  }}
                  className="w-full text-left p-3 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 rounded-lg transition-all"
                >
                  <p className="text-xs font-bold text-blue-800">Adjust Payment to Sale Total (Recommended)</p>
                  <p className="text-[10px] text-blue-600 mt-0.5">Change payment to Rs. {cartTotal.toLocaleString()}. No advance balance created.</p>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsPosOverpaymentOpen(false);
                    await submitSalePayload(pendingSalePayload);
                  }}
                  className="w-full text-left p-3 border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg transition-all"
                >
                  <p className="text-xs font-bold text-emerald-800">Save Extra as Customer Advance</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Post full Rs. {paidAmount.toLocaleString()}. Excess Rs. {posOverpaymentExcess.toLocaleString()} saved as customer advance (auto-adjusts on next sale).</p>
                </button>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPosOverpaymentOpen(false)}
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
