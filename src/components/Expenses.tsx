import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  PlusCircle, 
  Trash2, 
  Calendar, 
  FileText, 
  Tag, 
  CreditCard,
  Plus,
  X,
  Search,
  Filter
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Expense } from '../types';

export const Expenses: React.FC = () => {
  const { expenses, addExpense, deleteExpense, settings } = useERP();

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [category, setCategory] = useState<'Rent' | 'Electricity' | 'Salaries' | 'Transport' | 'Internet' | 'Office Expenses' | 'Maintenance' | 'Miscellaneous'>('Rent');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'jazzcash' | 'easypaisa' | 'cheque' | 'other'>('cash');
  const [notes, setNotes] = useState('');

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Categories list
  const categories: Expense['category'][] = [
    'Rent', 'Electricity', 'Salaries', 'Transport', 'Internet', 'Office Expenses', 'Maintenance', 'Miscellaneous'
  ];

  // Payment methods list
  const paymentMethods: Expense['paymentMethod'][] = [
    'cash', 'bank', 'jazzcash', 'easypaisa', 'cheque', 'other'
  ];

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !description.trim()) return;

    await addExpense({
      date,
      category,
      description,
      amount: Number(amount),
      paymentMethod,
      notes: notes.trim() || undefined
    });

    // Reset Form
    setCategory('Rent');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setDescription('');
    setPaymentMethod('cash');
    setNotes('');
    setShowAddForm(false);
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'all' || exp.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchTerm, filterCategory]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const categoryBreakdown = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as { [key: string]: number });

    return {
      total,
      breakdown: categoryBreakdown
    };
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Operational Expense Ledger</h1>
          <p className="text-xs text-slate-400 font-mono">Log shop costs (rent, utilities, salaries) to maintain accurate real-time net margins.</p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-xs flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Operational Costs</span>
          <h3 className="text-2xl font-black text-red-500 font-mono mt-1">
            {settings.currency} {stats.total.toLocaleString()}
          </h3>
          <span className="text-[10px] text-slate-400">Lifetime recorded shop expenses</span>
        </div>

        {categories.slice(0, 3).map(cat => (
          <div key={cat} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{cat} Expense</span>
            <h3 className="text-lg font-bold text-slate-700 font-mono mt-1">
              {settings.currency} {(stats.breakdown[cat] || 0).toLocaleString()}
            </h3>
            <span className="text-[10px] text-slate-400">Total spent on {cat.toLowerCase()}</span>
          </div>
        ))}
      </div>

      {/* LIST & FILTER BLOCK */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description or notes..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>Category:</span>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-hidden focus:border-blue-500 bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Description</th>
                <th className="py-3 px-5">Method</th>
                <th className="py-3 px-5 text-right">Amount</th>
                <th className="py-3 px-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                    No expense items match your criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5 font-mono text-slate-500">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="py-3 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <p className="font-bold text-slate-800">{exp.description}</p>
                      {exp.notes && <p className="text-[10px] text-slate-400 mt-0.5">{exp.notes}</p>}
                    </td>
                    <td className="py-3 px-5 uppercase text-[10px] font-mono font-bold text-slate-500">{exp.paymentMethod}</td>
                    <td className="py-3 px-5 text-right font-bold font-mono text-red-500">
                      {settings.currency} {exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expense record?')) {
                            deleteExpense(exp.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete record"
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

      {/* RECORD EXPENSE MODAL */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Record Operational Expense</h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* Date & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Amount ({settings.currency})</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 15000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 bg-white"
                  >
                    {paymentMethods.map(method => (
                      <option key={method} value={method}>{method.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electric bill for June 2026"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Internal Notes (Optional)</label>
                <textarea
                  placeholder="Additional context, invoice vouchers, receipts reference..."
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-xs"
                >
                  Confirm & Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
