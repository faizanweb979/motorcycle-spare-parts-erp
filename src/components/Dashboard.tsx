import React, { useState, useMemo } from 'react';
import { 
  IndianRupee, 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  ShoppingCart, 
  Briefcase, 
  Users, 
  History,
  Info,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { Part, Sale, Purchase, Customer, Supplier } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  onSelectPart: (part: Part) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab, onSelectPart }) => {
  const { 
    parts, 
    customers, 
    suppliers, 
    sales, 
    purchases, 
    adjustments, 
    settings,
    seedDemoData,
    loading,
    expenses,
    partners,
    drawings,
    payments
  } = useERP();

  const [partSearch, setPartSearch] = useState('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // 1. CALCULATE DATE BOUNDARIES (TODAY IN PAKISTAN TIMEZONE)
  const todayStr = useMemo(() => {
    // Current UTC date string, adjust for timezone
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  // 2. CALCULATE METRICS
  const todaySales = useMemo(() => {
    return sales
      .filter(s => s.date.startsWith(todayStr) && s.status !== 'returned')
      .reduce((sum, s) => sum + (s.totalAmount - s.discount), 0);
  }, [sales, todayStr]);

  const todayPurchases = useMemo(() => {
    return purchases
      .filter(p => p.date.startsWith(todayStr) && p.status !== 'returned')
      .reduce((sum, p) => sum + p.totalAmount, 0);
  }, [purchases, todayStr]);

  const stockValue = useMemo(() => {
    return parts.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0);
  }, [parts]);

  // Real margin-based profit calculation!
  // Sale Profit = Sum of (item.retailPrice - item.purchasePrice) * item.quantity - discount
  const todayProfit = useMemo(() => {
    const activeTodaySales = sales.filter(s => s.date.startsWith(todayStr) && s.status !== 'returned');
    return activeTodaySales.reduce((totalProfit, sale) => {
      const saleMargin = sale.items.reduce((sum, item) => {
        // Fallback purchasePrice if not present
        const pPrice = item.purchasePrice || 0;
        return sum + ((item.retailPrice - pPrice) * item.quantity);
      }, 0);
      return totalProfit + (saleMargin - sale.discount);
    }, 0);
  }, [sales, todayStr]);

  const lowStockItems = useMemo(() => {
    return parts.filter(p => p.stock <= p.minStock);
  }, [parts]);

  const creditCustomers = useMemo(() => {
    return customers
      .filter(c => (Number(c.balance) || 0) > 0)
      .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));
  }, [customers]);

  const creditSuppliers = useMemo(() => {
    return suppliers
      .filter(s => (Number(s.balance) || 0) > 0)
      .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0));
  }, [suppliers]);

  // 2b. COMPREHENSIVE FINANCIAL & ACCOUNTING CALCULATIONS
  const accountingMetrics = useMemo(() => {
    const activeSales = sales.filter(s => s.status !== 'returned');
    const activePurchases = purchases.filter(p => p.status !== 'returned');

    // Dates
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7); // YYYY-MM
    const currentYearStr = todayStr.substring(0, 4); // YYYY

    // Total sales lifetime
    const totalSales = activeSales.reduce((sum, s) => sum + (s.totalAmount - s.discount), 0);

    // Total purchases lifetime
    const totalPurchases = activePurchases.reduce((sum, p) => sum + p.totalAmount, 0);

    // Total expenses lifetime
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Current inventory value
    const currentInventoryValue = parts.reduce((sum, p) => sum + (p.purchasePrice * p.stock), 0);

    // Outstanding Receivables (Customers)
    const outstandingReceivables = customers.reduce((sum, c) => {
      const bal = Number(c.balance) || 0;
      return sum + (bal > 0 ? bal : 0);
    }, 0);

    // Outstanding Payables (Suppliers)
    const outstandingPayables = suppliers.reduce((sum, s) => {
      const bal = Number(s.balance) || 0;
      return sum + (bal > 0 ? bal : 0);
    }, 0);

    // Total Customer Advances
    const totalCustomerAdvances = customers.reduce((sum, c) => sum + (Number(c.advance) || 0), 0);

    // Total Supplier Advances
    const totalSupplierAdvances = suppliers.reduce((sum, s) => sum + (Number(s.advance) || 0), 0);

    // Gross Profit Helper
    const getGrossProfit = (salesList: typeof sales) => {
      return salesList.reduce((total, sale) => {
        const saleMargin = sale.items.reduce((sum, item) => sum + ((item.retailPrice - (item.purchasePrice || 0)) * item.quantity), 0);
        return total + (saleMargin - sale.discount);
      }, 0);
    };

    // Lifetime profits
    const lifetimeGrossProfit = getGrossProfit(activeSales);
    const lifetimeNetProfit = lifetimeGrossProfit - totalExpenses;

    // Today profits
    const todaySalesList = activeSales.filter(s => s.date.startsWith(todayStr));
    const todayGrossProfit = getGrossProfit(todaySalesList);
    const todayExpensesAmount = expenses.filter(e => e.date.startsWith(todayStr)).reduce((sum, e) => sum + e.amount, 0);
    const todayNetProfit = todayGrossProfit - todayExpensesAmount;

    // Monthly profits
    const monthlySalesList = activeSales.filter(s => s.date.startsWith(currentMonthStr));
    const monthlyGrossProfit = getGrossProfit(monthlySalesList);
    const monthlyExpensesAmount = expenses.filter(e => e.date.startsWith(currentMonthStr)).reduce((sum, e) => sum + e.amount, 0);
    const monthlyNetProfit = monthlyGrossProfit - monthlyExpensesAmount;

    // Yearly profits
    const yearlySalesList = activeSales.filter(s => s.date.startsWith(currentYearStr));
    const yearlyGrossProfit = getGrossProfit(yearlySalesList);
    const yearlyExpensesAmount = expenses.filter(e => e.date.startsWith(currentYearStr)).reduce((sum, e) => sum + e.amount, 0);
    const yearlyNetProfit = yearlyGrossProfit - yearlyExpensesAmount;

    // Cash and Bank Balances
    const startingCash = settings.startingCash !== undefined ? Number(settings.startingCash) : 50000;
    const startingBank = settings.startingBank !== undefined ? Number(settings.startingBank) : 150000;

    // Partner active investments
    const activePartners = partners.filter(p => p.status === 'Active');
    const partnerInvestments = activePartners.reduce((sum, p) => sum + p.investment, 0);

    // Sales payments received:
    // If paymentMethod === 'bank_transfer', it goes to Bank. Otherwise (cash or credit), s.paidAmount goes to Cash.
    const salesCashReceived = activeSales.filter(s => s.paymentMethod !== 'bank_transfer').reduce((sum, s) => sum + s.paidAmount, 0);
    const salesBankReceived = activeSales.filter(s => s.paymentMethod === 'bank_transfer').reduce((sum, s) => sum + s.paidAmount, 0);

    // Customer payments received:
    // If paymentMethod === 'bank' || 'cheque', goes to Bank. Otherwise goes to Cash.
    const paymentsToBank = ['bank', 'cheque'];
    const customerPaymentsCash = payments.filter(p => p.entityType === 'customer' && !paymentsToBank.includes(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0);
    const customerPaymentsBank = payments.filter(p => p.entityType === 'customer' && paymentsToBank.includes(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0);

    // Purchase payments paid:
    // Assumed from Cash by default (subtraction)
    const purchasesPaid = activePurchases.reduce((sum, p) => sum + p.paidAmount, 0);

    // Supplier payments made:
    // If paymentMethod === 'bank' || 'cheque', reduces Bank. Otherwise reduces Cash.
    const supplierPaymentsCash = payments.filter(p => p.entityType === 'supplier' && !paymentsToBank.includes(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0);
    const supplierPaymentsBank = payments.filter(p => p.entityType === 'supplier' && paymentsToBank.includes(p.paymentMethod)).reduce((sum, p) => sum + p.amount, 0);

    // Expenses paid:
    // If paymentMethod === 'bank' || 'cheque', reduces Bank. Otherwise reduces Cash.
    const expensesCash = expenses.filter(e => !paymentsToBank.includes(e.paymentMethod)).reduce((sum, e) => sum + e.amount, 0);
    const expensesBank = expenses.filter(e => paymentsToBank.includes(e.paymentMethod)).reduce((sum, e) => sum + e.amount, 0);

    // Drawings made:
    // Assumed drawn from Cash (subtraction)
    const drawingsCash = drawings.reduce((sum, d) => sum + d.amount, 0);

    // Final balances
    const cashInHand = startingCash + salesCashReceived + customerPaymentsCash - purchasesPaid - supplierPaymentsCash - expensesCash - drawingsCash;
    const bankBalance = startingBank + partnerInvestments + salesBankReceived + customerPaymentsBank - supplierPaymentsBank - expensesBank;

    // Start Date Calculation
    // Find the earliest date across transactions, or default to "2026-07-01"
    const dates = [
      ...activeSales.map(s => s.date),
      ...activePurchases.map(p => p.date),
      ...expenses.map(e => e.date)
    ];
    let businessStartDate = '2026-07-01';
    if (dates.length > 0) {
      dates.sort();
      businessStartDate = dates[0].split('T')[0];
    }
    const runningDays = Math.max(1, Math.ceil((Date.now() - new Date(businessStartDate).getTime()) / (1000 * 60 * 60 * 24)));

    return {
      lifetimeNetProfit,
      todayNetProfit,
      monthlyNetProfit,
      yearlyNetProfit,
      totalSales,
      totalPurchases,
      totalExpenses,
      currentInventoryValue,
      cashInHand,
      bankBalance,
      outstandingReceivables,
      outstandingPayables,
      totalCustomerAdvances,
      totalSupplierAdvances,
      businessStartDate,
      runningDays,
      lifetimeGrossProfit
    };
  }, [sales, purchases, expenses, parts, customers, suppliers, partners, drawings, payments]);

  // 3. TOP SELLING PARTS
  const topSellingParts = useMemo(() => {
    const quantities: { [partId: string]: { name: string; quantity: number; totalRev: number; brand: string } } = {};
    sales.filter(s => s.status !== 'returned').forEach(s => {
      s.items.forEach(item => {
        if (!quantities[item.partId]) {
          quantities[item.partId] = { name: item.name, quantity: 0, totalRev: 0, brand: parts.find(p => p.id === item.partId)?.brand || '' };
        }
        quantities[item.partId].quantity += item.quantity;
        quantities[item.partId].totalRev += item.total;
      });
    });

    return Object.values(quantities)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [sales, parts]);

  // 4. PARTS QUICK LOOKUP SEARCH
  const searchedParts = useMemo(() => {
    if (!partSearch.trim()) return [];
    const query = partSearch.toLowerCase();
    return parts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.partNumber.toLowerCase().includes(query) || 
      p.brand.toLowerCase().includes(query) ||
      p.modelCompatibility.toLowerCase().includes(query)
    ).slice(0, 5);
  }, [parts, partSearch]);

  // 5. CHART DATA (SALES & PURCHASES TREND OVER LAST 7 DAYS)
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(dateStr => {
      const dateSales = sales
        .filter(s => s.date.startsWith(dateStr) && s.status !== 'returned')
        .reduce((sum, s) => sum + (s.totalAmount - s.discount), 0);

      const datePurchases = purchases
        .filter(p => p.date.startsWith(dateStr) && p.status !== 'returned')
        .reduce((sum, p) => sum + p.totalAmount, 0);

      // Format simple date label e.g., 'Jul 14'
      const label = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        date: label,
        Sales: dateSales,
        Purchases: datePurchases
      };
    });
  }, [sales, purchases]);

  // Category distribution data for parts
  const categoryData = useMemo(() => {
    const distribution: { [cat: string]: number } = {};
    parts.forEach(p => {
      distribution[p.category] = (distribution[p.category] || 0) + p.stock;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value })).slice(0, 5);
  }, [parts]);

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];

  if (parts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 border border-slate-100 rounded-2xl shadow-xs mt-6 max-w-2xl mx-auto">
        <Package className="h-16 w-16 text-blue-600 mb-4 stroke-1 animate-bounce" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">Welcome to your Motorcycle Parts ERP</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-md">
          It looks like your database is completely empty. We can automatically seed it with typical Pakistani motorcycle spare parts, registered credit customers, supplier ledger logs, and sample transactions to let you explore instantly!
        </p>
        <button
          onClick={seedDemoData}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-sm flex items-center gap-2"
        >
          <span>Seed Professional Demo Data</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 0. WELCOME HEADER AND BUSINESS SUMMARY BUTTON */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Welcome back, {settings.shopName}</h1>
          <p className="text-xs text-slate-400 font-mono">Real-time Pakistani Motorcycle Spare Parts & Accounting Ledger.</p>
        </div>
        <button
          onClick={() => setShowSummaryModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-xs flex items-center gap-2 shrink-0"
        >
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span>View Business Summary</span>
        </button>
      </div>

      {/* 0B. BUSINESS ACCOUNTING SUMMARY TILES (12 Live Metrics) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Accounting Overview</h3>
          <p className="text-[10px] text-slate-400 font-mono">Automatic ledger updates including sales, purchases, and expenses.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* 1. Lifetime Net Profit */}
          <div className="bg-slate-900 text-white p-3.5 rounded-lg border border-slate-800 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Lifetime Net Profit</span>
            <h4 className="text-sm font-black text-emerald-400 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.lifetimeNetProfit.toLocaleString()}
            </h4>
          </div>

          {/* 2. Today's Net Profit */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Today's Net Profit</span>
            <h4 className={`text-sm font-black font-mono mt-0.5 ${accountingMetrics.todayNetProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {settings.currency} {accountingMetrics.todayNetProfit.toLocaleString()}
            </h4>
          </div>

          {/* 3. Monthly Net Profit */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Monthly Net Profit</span>
            <h4 className="text-sm font-black text-slate-900 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.monthlyNetProfit.toLocaleString()}
            </h4>
          </div>

          {/* 4. Yearly Net Profit */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Yearly Net Profit</span>
            <h4 className="text-sm font-black text-slate-900 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.yearlyNetProfit.toLocaleString()}
            </h4>
          </div>

          {/* 5. Total Sales */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Sales</span>
            <h4 className="text-sm font-bold text-slate-800 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.totalSales.toLocaleString()}
            </h4>
          </div>

          {/* 6. Total Purchases */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Purchases</span>
            <h4 className="text-sm font-bold text-slate-800 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.totalPurchases.toLocaleString()}
            </h4>
          </div>

          {/* 7. Total Expenses */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Expenses</span>
            <h4 className="text-sm font-bold text-red-500 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.totalExpenses.toLocaleString()}
            </h4>
          </div>

          {/* 8. Current Inventory Value */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Inventory Value</span>
            <h4 className="text-sm font-bold text-slate-800 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.currentInventoryValue.toLocaleString()}
            </h4>
          </div>

          {/* 9. Cash in Hand */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Cash in Hand</span>
            <h4 className="text-sm font-bold text-slate-800 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.cashInHand.toLocaleString()}
            </h4>
          </div>

          {/* 10. Bank Balance */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Bank Balance</span>
            <h4 className="text-sm font-bold text-blue-600 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.bankBalance.toLocaleString()}
            </h4>
          </div>

          {/* 11. Outstanding Receivables */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Receivables</span>
            <h4 className="text-sm font-bold text-orange-600 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.outstandingReceivables.toLocaleString()}
            </h4>
          </div>

          {/* 12. Outstanding Payables */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 shadow-xs">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Payables</span>
            <h4 className="text-sm font-bold text-red-500 font-mono mt-0.5">
              {settings.currency} {accountingMetrics.outstandingPayables.toLocaleString()}
            </h4>
          </div>
        </div>
      </div>

      {/* 1. CORE KEY METRICS SUMMARY ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric Card: Today Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between group hover:border-blue-300 transition-colors duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Total Sales</span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {settings.currency} {todaySales.toLocaleString()}
            </h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> Sales Active
            </span>
          </div>
          <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors">
            <ShoppingCart className="h-6 w-6 stroke-[1.8]" />
          </div>
        </div>

        {/* Metric Card: Today Purchases */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between group hover:border-slate-300 transition-colors duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Purchases</span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {settings.currency} {todayPurchases.toLocaleString()}
            </h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold inline-flex items-center">
              Inventory Restock
            </span>
          </div>
          <div className="p-3.5 bg-slate-100 rounded-xl text-slate-500 group-hover:bg-slate-200 transition-colors">
            <Briefcase className="h-6 w-6 stroke-[1.8]" />
          </div>
        </div>

        {/* Metric Card: Real Net Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between group hover:border-emerald-300 transition-colors duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today's Est. Profit</span>
            <h3 className={`text-2xl font-black font-mono ${todayProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {settings.currency} {todayProfit.toLocaleString()}
            </h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-semibold inline-flex items-center">
              Net margin calculated
            </span>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-xl text-emerald-500 group-hover:bg-emerald-100 transition-colors">
            <TrendingUp className="h-6 w-6 stroke-[1.8]" />
          </div>
        </div>

        {/* Metric Card: Total Warehouse Stock Asset Value */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between group hover:border-blue-300 transition-colors duration-150">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Warehouse Stock Value</span>
            <h3 className="text-2xl font-black text-slate-900 font-mono">
              {settings.currency} {stockValue.toLocaleString()}
            </h3>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold inline-flex items-center">
              {parts.length} distinct items
            </span>
          </div>
          <div className="p-3.5 bg-blue-50 rounded-xl text-blue-500 group-hover:bg-blue-100 transition-colors">
            <Package className="h-6 w-6 stroke-[1.8]" />
          </div>
        </div>
      </div>

      {/* 2. MAIN LAYOUT GRID (Charts, Quick Finder & Lists) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-DAY TRANSACTIONS GRAPH */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-800">Sales vs Purchases Trend</h3>
              <span className="text-[10px] text-slate-400">Past 7 days performance</span>
            </div>
          </div>
          <div className="h-72 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} stroke="#94a3b8" tickFormatter={(v) => `Rs.${v}`} />
                <Tooltip 
                  formatter={(value: any) => [`Rs. ${value.toLocaleString()}`]} 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', border: 'none' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="Purchases" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* COUNTER-TOP QUICK PARTS FINDER */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-0.5 mb-4">
              <h3 className="text-sm font-bold text-slate-800">Counter Quick-Finder</h3>
              <span className="text-[10px] text-slate-400">Instantly look up parts location & price</span>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Search name, code, compatability..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="space-y-2.5">
              {partSearch.trim() === '' ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 gap-2">
                  <Search className="h-8 w-8 stroke-1 text-slate-300" />
                  <p className="text-[11px] leading-relaxed">Search to lookup price,<br />stock, and rack location.</p>
                </div>
              ) : searchedParts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No parts matched your query.
                </div>
              ) : (
                searchedParts.map((p) => (
                  <div 
                    key={p.id} 
                    onClick={() => onSelectPart(p)}
                    className="p-2.5 border border-slate-100 rounded-lg hover:bg-blue-50/40 hover:border-blue-200 cursor-pointer transition-colors flex justify-between items-center"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tight truncate">
                        {p.brand} · {p.modelCompatibility}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-900 font-mono">Rs.{p.retailPrice}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        p.stock <= p.minStock ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        Stock: {p.stock}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {partSearch.trim() !== '' && (
            <p className="text-[10px] text-slate-400 text-center mt-3 bg-slate-50 py-1.5 rounded border border-slate-100">
              💡 Tip: Click any result to view full details
            </p>
          )}
        </div>
      </div>

      {/* 3. LOWER CONTENT ROWS (Alerts, Credit ledgers, Top selling) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* LOW STOCK ALERT CENTER */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-96">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>Low Stock Warnings</span>
              </h3>
              <span className="text-[10px] text-slate-400">Needs restocking soon</span>
            </div>
            <button 
              onClick={() => setActiveTab('inventory')}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              View Inventory
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {lowStockItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 gap-1.5">
                <Package className="h-8 w-8 text-emerald-500 stroke-1" />
                <p className="text-xs font-medium text-slate-600">All parts stocked well!</p>
                <p className="text-[10px] text-slate-400">No low stock warnings.</p>
              </div>
            ) : (
              lowStockItems.map((p) => (
                <div key={p.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100 flex justify-between items-center transition-colors">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-mono">{p.brand} | Loc: {p.location || 'N/A'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      Stock: {p.stock}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-1">Min: {p.minStock}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CREDIT CUSTOMERS LEDGER */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-96">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-800">Receivable Credit Customers</h3>
              <span className="text-[10px] text-slate-400">Outstanding payments to collect</span>
            </div>
            <button 
              onClick={() => setActiveTab('customers')}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              View Ledgers
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {creditCustomers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 gap-1.5">
                <Users className="h-8 w-8 text-emerald-500 stroke-1" />
                <p className="text-xs font-medium text-slate-600">No pending customer credits</p>
                <p className="text-[10px] text-slate-400">All customer ledgers clear!</p>
              </div>
            ) : (
              creditCustomers.map((c) => (
                <div key={c.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100 flex justify-between items-center transition-colors">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[9px] text-slate-400 truncate">{c.shopName || c.phone}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      Rs.{c.balance.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT SALES & TOP SELLING PARTS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-96">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex flex-col">
              <h3 className="text-sm font-bold text-slate-800">Top Selling Products</h3>
              <span className="text-[10px] text-slate-400">Highest volume sales items</span>
            </div>
            <button 
              onClick={() => setActiveTab('reports')}
              className="text-[11px] text-blue-600 font-semibold hover:underline"
            >
              Analytics
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
            {topSellingParts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-slate-400 gap-1.5">
                <ShoppingCart className="h-8 w-8 text-slate-300 stroke-1" />
                <p className="text-xs font-medium text-slate-600">No sale transactions yet</p>
                <p className="text-[10px] text-slate-400">Generate POS invoices first.</p>
              </div>
            ) : (
              topSellingParts.map((tsp, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div className="min-w-0 pr-2 flex items-center gap-2.5">
                    <span className="text-xs font-extrabold text-slate-400 w-4 font-mono">#{idx+1}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{tsp.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{tsp.brand}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-mono font-bold text-emerald-600">{tsp.quantity} sold</p>
                    <p className="text-[9px] text-slate-400">Rs.{tsp.totalRev.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 4. DETAILED BUSINESS SUMMARY MODAL (DRAWER) */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-slate-800">Business Accounting Summary</h3>
                <span className="text-[10px] text-slate-400 font-mono">Detailed financial status report</span>
              </div>
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Meta information row */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div>
                  <span className="text-[9px] uppercase text-slate-400 font-bold block">Business Start Date</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {new Date(accountingMetrics.businessStartDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase text-slate-400 font-bold block">Total Running Days</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">
                    {accountingMetrics.runningDays} days
                  </span>
                </div>
              </div>

              {/* Accounting details rows */}
              <div className="divide-y divide-slate-100">
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Lifetime Sales Collection</span>
                  <span className="font-bold font-mono text-slate-800">
                    {settings.currency} {accountingMetrics.totalSales.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Lifetime Purchase Expenses</span>
                  <span className="font-bold font-mono text-slate-800">
                    {settings.currency} {accountingMetrics.totalPurchases.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Lifetime Operational Expenses</span>
                  <span className="font-bold font-mono text-slate-800">
                    {settings.currency} {accountingMetrics.totalExpenses.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Gross Margin Profit</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {settings.currency} {accountingMetrics.lifetimeGrossProfit.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-800 font-bold">Lifetime Business Net Profit</span>
                  <span className="font-black font-mono text-emerald-600 text-sm">
                    {settings.currency} {accountingMetrics.lifetimeNetProfit.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Current Inventory Asset Value</span>
                  <span className="font-bold font-mono text-slate-800">
                    {settings.currency} {accountingMetrics.currentInventoryValue.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Cash in Hand Balance</span>
                  <span className="font-bold font-mono text-slate-800">
                    {settings.currency} {accountingMetrics.cashInHand.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Bank Accounts Balance</span>
                  <span className="font-bold font-mono text-blue-600">
                    {settings.currency} {accountingMetrics.bankBalance.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Outstanding Customer Receivables</span>
                  <span className="font-bold font-mono text-orange-600">
                    {settings.currency} {accountingMetrics.outstandingReceivables.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center border-b border-slate-50 pb-2.5">
                  <span className="text-slate-500 font-medium">Total Customer Advances</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {settings.currency} {accountingMetrics.totalCustomerAdvances.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Outstanding Supplier Payables</span>
                  <span className="font-bold font-mono text-red-500">
                    {settings.currency} {accountingMetrics.outstandingPayables.toLocaleString()}
                  </span>
                </div>

                <div className="py-2.5 flex justify-between items-center border-b border-slate-50 pb-2.5">
                  <span className="text-slate-500 font-medium">Total Supplier Advances</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {settings.currency} {accountingMetrics.totalSupplierAdvances.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs transition-colors"
                >
                  Close Summary Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
