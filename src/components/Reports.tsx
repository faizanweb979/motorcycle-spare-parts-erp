import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  ChevronRight, 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart2,
  CheckCircle2,
  Users,
  Briefcase
} from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Cell,
  Pie,
  Legend
} from 'recharts';

export const Reports: React.FC = () => {
  const { parts, customers, suppliers, sales, purchases, adjustments, settings, expenses, partners, drawings } = useERP();

  // Selected Reporting Tab
  const [reportTab, setReportTab] = useState<'analytics' | 'lifetime_profit' | 'monthly_profit' | 'expenses' | 'partners_share' | 'drawings_history'>('analytics');
  const [dateRange, setDateRange] = useState<'30days' | '7days' | 'today'>('30days');

  // ==========================================
  // 1. ANALYTICS CALCULATIONS (ORIGINAL VIEW)
  // ==========================================
  const financialTotals = useMemo(() => {
    const filteredSales = sales.filter(s => {
      if (s.status !== 'completed') return false;
      const saleDate = new Date(s.date);
      const diffTime = Math.abs(new Date().getTime() - saleDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (dateRange === '7days') return diffDays <= 7;
      if (dateRange === 'today') return diffDays <= 1;
      return diffDays <= 30;
    });

    let grossSalesRevenue = 0;
    let totalDiscountGiven = 0;
    let totalCostOfGoodsSold = 0;

    filteredSales.forEach(s => {
      grossSalesRevenue += s.totalAmount;
      totalDiscountGiven += s.discount;

      s.items.forEach(item => {
        totalCostOfGoodsSold += (item.purchasePrice * item.quantity);
      });
    });

    const netSalesCollection = grossSalesRevenue - totalDiscountGiven;
    const grossProfit = netSalesCollection - totalCostOfGoodsSold;
    const netProfitMarginPct = netSalesCollection > 0 ? (grossProfit / netSalesCollection) * 100 : 0;

    return {
      grossSalesRevenue,
      totalDiscountGiven,
      netSalesCollection,
      totalCostOfGoodsSold,
      grossProfit,
      netProfitMarginPct
    };
  }, [sales, dateRange]);

  const salesChartData = useMemo(() => {
    const dailyMap: { [key: string]: { date: string; revenue: number; profit: number } } = {};
    const rangeLength = dateRange === '7days' ? 7 : 30;
    for (let i = rangeLength - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap[dateStr] = { date: dateStr, revenue: 0, profit: 0 };
    }

    sales.forEach(s => {
      if (s.status !== 'completed') return;
      const dateStr = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dailyMap[dateStr]) {
        const costOfItems = s.items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
        dailyMap[dateStr].revenue += (s.totalAmount - s.discount);
        dailyMap[dateStr].profit += ((s.totalAmount - s.discount) - costOfItems);
      }
    });

    return Object.values(dailyMap);
  }, [sales, dateRange]);

  const topParts = useMemo(() => {
    const partSalesMap: { [key: string]: { name: string; qty: number; revenue: number } } = {};
    sales.forEach(s => {
      if (s.status !== 'completed') return;
      s.items.forEach(item => {
        if (!partSalesMap[item.partId]) {
          partSalesMap[item.partId] = { name: item.name, qty: 0, revenue: 0 };
        }
        partSalesMap[item.partId].qty += item.quantity;
        partSalesMap[item.partId].revenue += (item.retailPrice * item.quantity);
      });
    });

    return Object.values(partSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  const categorySales = useMemo(() => {
    const catMap: { [key: string]: number } = {};
    sales.forEach(s => {
      if (s.status !== 'completed') return;
      s.items.forEach(item => {
        const originalPart = parts.find(p => p.id === item.partId);
        const category = originalPart?.category || 'Engine Parts';
        catMap[category] = (catMap[category] || 0) + (item.retailPrice * item.quantity);
      });
    });

    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'];
    return Object.keys(catMap).map((cat, idx) => ({
      name: cat,
      value: catMap[cat],
      color: colors[idx % colors.length]
    })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [sales, parts]);

  const lowStockReportList = useMemo(() => {
    return parts.filter(p => p.stock <= p.minStock);
  }, [parts]);

  // ==========================================
  // 2. NEW DETAILED ACCOUNTING REPORT GENERATORS
  // ==========================================

  // Aggregated Lifetime & Monthly Profits
  const monthlyProfitData = useMemo(() => {
    const monthlyMap: { [month: string]: { month: string; sales: number; cogs: number; gross: number; expenses: number; net: number } } = {};

    // completed sales
    sales.filter(s => s.status === 'completed').forEach(s => {
      const month = s.date.substring(0, 7); // YYYY-MM
      if (!monthlyMap[month]) {
        monthlyMap[month] = { month, sales: 0, cogs: 0, gross: 0, expenses: 0, net: 0 };
      }
      const cogs = s.items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
      const revenue = s.totalAmount - s.discount;
      monthlyMap[month].sales += revenue;
      monthlyMap[month].cogs += cogs;
      monthlyMap[month].gross += (revenue - cogs);
    });

    // expenses
    expenses.forEach(e => {
      const month = e.date.substring(0, 7); // YYYY-MM
      if (!monthlyMap[month]) {
        monthlyMap[month] = { month, sales: 0, cogs: 0, gross: 0, expenses: 0, net: 0 };
      }
      monthlyMap[month].expenses += e.amount;
    });

    // compute net
    Object.keys(monthlyMap).forEach(month => {
      monthlyMap[month].net = monthlyMap[month].gross - monthlyMap[month].expenses;
    });

    return Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));
  }, [sales, expenses]);

  // Lifetime Gross & Net totals
  const lifetimeFinancialTotals = useMemo(() => {
    const activeSales = sales.filter(s => s.status !== 'returned');
    const grossProfit = activeSales.reduce((total, sale) => {
      const saleMargin = sale.items.reduce((sum, item) => sum + ((item.retailPrice - (item.purchasePrice || 0)) * item.quantity), 0);
      return total + (saleMargin - sale.discount);
    }, 0);
    const totalSales = activeSales.reduce((sum, s) => sum + (s.totalAmount - s.discount), 0);
    const totalCOGS = activeSales.reduce((total, sale) => {
      const saleCogs = sale.items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
      return total + saleCogs;
    }, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return {
      totalSales,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfit
    };
  }, [sales, expenses]);

  // Expenses Categorized Summary
  const expenseSummaryData = useMemo(() => {
    const categoryMap: { [cat: string]: { count: number; total: number } } = {};
    let grandTotal = 0;

    expenses.forEach(e => {
      if (!categoryMap[e.category]) {
        categoryMap[e.category] = { count: 0, total: 0 };
      }
      categoryMap[e.category].count += 1;
      categoryMap[e.category].total += e.amount;
      grandTotal += e.amount;
    });

    return Object.keys(categoryMap).map(cat => ({
      category: cat,
      count: categoryMap[cat].count,
      total: categoryMap[cat].total,
      percentage: grandTotal > 0 ? (categoryMap[cat].total / grandTotal) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Partners Share Distribution List
  const partnerDistributionData = useMemo(() => {
    return partners.map(partner => {
      const allocatedProfitShare = lifetimeFinancialTotals.netProfit * (partner.ownershipPercentage / 100);
      const partnerDrawings = drawings
        .filter(d => d.partnerId === partner.id)
        .reduce((sum, d) => sum + d.amount, 0);
      const remainingProfitShare = allocatedProfitShare - partnerDrawings;
      return {
        name: partner.name,
        ownershipPercentage: partner.ownershipPercentage,
        allocatedProfitShare,
        totalDrawings: partnerDrawings,
        remainingProfitShare
      };
    });
  }, [partners, drawings, lifetimeFinancialTotals.netProfit]);

  // ==========================================
  // 3. EXPORT / PRINT HANDLERS
  // ==========================================
  const triggerPrint = () => {
    window.print();
  };

  const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelExport = () => {
    if (reportTab === 'lifetime_profit') {
      const headers = ['Metric', 'Amount'];
      const rows = [
        ['Total Sales Collection', lifetimeFinancialTotals.totalSales],
        ['Cost of Goods Sold (COGS)', lifetimeFinancialTotals.totalCOGS],
        ['Gross Markup Profit', lifetimeFinancialTotals.grossProfit],
        ['Operating Expenses', lifetimeFinancialTotals.totalExpenses],
        ['Net Real Profit', lifetimeFinancialTotals.netProfit]
      ];
      exportCSV('lifetime_profit_report', headers, rows);
    } 
    else if (reportTab === 'monthly_profit') {
      const headers = ['Month', 'Sales Revenue', 'Cost of Goods Sold (COGS)', 'Gross Margin', 'Expenses', 'Net Profit'];
      const rows = monthlyProfitData.map(d => [
        d.month,
        d.sales,
        d.cogs,
        d.gross,
        d.expenses,
        d.net
      ]);
      exportCSV('monthly_profit_report', headers, rows);
    } 
    else if (reportTab === 'expenses') {
      const headers = ['Category', 'Voucher Count', 'Total Expenses', 'Percentage Share'];
      const rows = expenseSummaryData.map(d => [
        d.category,
        d.count,
        d.total,
        `${d.percentage.toFixed(1)}%`
      ]);
      exportCSV('operational_expense_summary', headers, rows);
    } 
    else if (reportTab === 'partners_share') {
      const headers = ['Partner Name', 'Ownership %', 'Allocated Share', 'Total Drawn', 'Remaining Share'];
      const rows = partnerDistributionData.map(d => [
        d.name,
        d.ownershipPercentage,
        d.allocatedProfitShare,
        d.totalDrawings,
        d.remainingProfitShare
      ]);
      exportCSV('partner_profits_matrix', headers, rows);
    } 
    else if (reportTab === 'drawings_history') {
      const headers = ['Date', 'Partner', 'Reason', 'Notes', 'Amount Withdrawn'];
      const rows = drawings.map(d => [
        d.date,
        d.partnerName,
        d.reason,
        d.notes || '',
        d.amount
      ]);
      exportCSV('partner_withdrawals_history', headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. REPORT CONTROL TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-slate-800">ERP Audit & Business Reports</h1>
          <p className="text-[11px] text-slate-400 font-mono">Detailed financial profit accounting, stock valuations, and partner equity audits.</p>
        </div>

        <div className="flex items-center gap-2">
          {reportTab === 'analytics' && (
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white font-medium">
              <button
                onClick={() => setDateRange('today')}
                className={`px-3 py-1.5 transition-colors ${dateRange === 'today' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                Today
              </button>
              <button
                onClick={() => setDateRange('7days')}
                className={`px-3 py-1.5 border-l border-r border-slate-200 transition-colors ${dateRange === '7days' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                7 Days
              </button>
              <button
                onClick={() => setDateRange('30days')}
                className={`px-3 py-1.5 transition-colors ${dateRange === '30days' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-50 text-slate-600'}`}
              >
                30 Days
              </button>
            </div>
          )}

          {reportTab !== 'analytics' && (
            <button
              onClick={handleExcelExport}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-blue-500" />
              <span>Export to Excel</span>
            </button>
          )}

          <button
            onClick={triggerPrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 text-blue-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* MULTI-TAB NAVIGATION */}
      <div className="flex border-b border-slate-200 text-xs overflow-x-auto">
        <button
          onClick={() => setReportTab('analytics')}
          className={`px-4 py-2.5 font-bold transition-colors border-b-2 -mb-px shrink-0 ${reportTab === 'analytics' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Sales & Profit Analytics
        </button>
        <button
          onClick={() => setReportTab('lifetime_profit')}
          className={`px-4 py-2.5 font-bold transition-colors border-b-2 -mb-px shrink-0 ${reportTab === 'lifetime_profit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Lifetime Profit Summary
        </button>
        <button
          onClick={() => setReportTab('monthly_profit')}
          className={`px-4 py-2.5 font-bold transition-colors border-b-2 -mb-px shrink-0 ${reportTab === 'monthly_profit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Monthly Profit Ledger
        </button>
        <button
          onClick={() => setReportTab('expenses')}
          className={`px-4 py-2.5 font-bold transition-colors border-b-2 -mb-px shrink-0 ${reportTab === 'expenses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Expense Breakdown
        </button>
        <button
          onClick={() => setReportTab('partners_share')}
          className={`px-4 py-2.5 font-bold transition-colors border-b-2 -mb-px shrink-0 ${reportTab === 'partners_share' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Partner Profit Sharing
        </button>
        <button
          onClick={() => setReportTab('drawings_history')}
          className={`px-4 py-2.5 font-bold transition-colors border-b-2 -mb-px shrink-0 ${reportTab === 'drawings_history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Partner Withdrawals Log
        </button>
      </div>

      {/* ==========================================
          TAB 1: ORIGINAL ANALYTICS VIEW
          ========================================== */}
      {reportTab === 'analytics' && (
        <div className="space-y-6">
          {/* MATHEMATICAL FINANCIAL LEDGER METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gross Retail Sales</span>
              <h3 className="text-2xl font-black text-slate-900 font-mono mt-1">Rs. {financialTotals.grossSalesRevenue.toLocaleString()}</h3>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-1">
                <span>Before flat client discounts</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Discounts Given</span>
              <h3 className="text-2xl font-black text-red-500 font-mono mt-1">Rs. {financialTotals.totalDiscountGiven.toLocaleString()}</h3>
              <div className="flex items-center gap-1 text-[10px] text-red-600/70 font-semibold mt-1">
                <span>Reduces net profit collection</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
              <h3 className="text-2xl font-black text-slate-900 font-mono mt-1">Rs. {financialTotals.totalCostOfGoodsSold.toLocaleString()}</h3>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-1">
                <span>Total wholesale cost of items</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs ring-2 ring-emerald-500/10 bg-emerald-50/10">
              <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Net Markup Profit</span>
              <h3 className="text-2xl font-black text-emerald-600 font-mono mt-1">Rs. {financialTotals.grossProfit.toLocaleString()}</h3>
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold font-mono mt-1">
                <TrendingUp className="h-3 w-3 shrink-0" />
                <span>Avg margin: {Math.round(financialTotals.netProfitMarginPct)}%</span>
              </div>
            </div>
          </div>

          {/* CHARTS PANEL CONTAINER */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Revenue & Profit Trends</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Daily sales collection vs. net product profits</span>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', fontFamily: 'monospace', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="revenue" name="Collection" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="profit" name="Net Margin" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Top Product Categories</h3>
                <span className="text-[10px] text-slate-400 font-mono">Category shares in net collection</span>
              </div>

              {categorySales.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 my-auto">No sales processed to render share splits.</div>
              ) : (
                <div className="space-y-4">
                  <div className="h-40 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categorySales}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {categorySales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '6px' }} formatter={(val: number) => `Rs. ${val.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {categorySales.map((entry, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] font-medium text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="truncate max-w-[120px]">{entry.name}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-800">Rs. {entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* LOWER TABULAR REPORTS (Bento style) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Top-Selling Spare Parts</h3>
                <span className="text-[10px] text-slate-400 font-mono">Product lines driving high volume</span>
              </div>

              <div className="divide-y divide-slate-100">
                {topParts.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-10">No sales transactions logged.</p>
                ) : (
                  topParts.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-300 w-4 font-mono">{idx + 1}.</span>
                        <div>
                          <p className="font-bold text-slate-800 leading-snug">{item.name}</p>
                          <p className="text-[10px] text-slate-400">Total units sold: <strong className="font-mono text-slate-700">{item.qty} units</strong></p>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2.5 py-1 rounded">
                        Rs. {item.revenue.toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-0.5">Inventory Depletion Alert</h3>
                <span className="text-[10px] text-slate-400 font-mono">Spare parts currently at or below minimum threshold</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {lowStockReportList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto stroke-1 mb-2" />
                    <p className="text-emerald-700 font-bold">Warehouse stock is perfect!</p>
                    <p className="text-[10px]">All spare parts are above the threshold line.</p>
                  </div>
                ) : (
                  lowStockReportList.map((p) => (
                    <div key={p.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800 leading-snug">{p.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Location: {p.location || 'N/A'} · Brand: {p.brand}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 font-mono text-[10px] font-bold rounded-full">
                          {p.stock} units
                        </span>
                        <p className="text-[9px] text-slate-400 mt-1">Min threshold: {p.minStock}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 2: LIFETIME PROFIT SUMMARY
          ========================================== */}
      {reportTab === 'lifetime_profit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Lifetime Net Profit Audit</h3>
            <p className="text-[11px] text-slate-400 font-mono">Accumulated margins, purchase costs, and operational overheads since inception.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800">
              <span className="text-[10px] font-bold uppercase block">Gross Margin Profit</span>
              <h2 className="text-3xl font-black font-mono mt-1">Rs. {lifetimeFinancialTotals.grossProfit.toLocaleString()}</h2>
              <span className="text-[10px] block mt-1">Revenue minus wholesale product costs</span>
            </div>

            <div className="p-5 bg-red-50 rounded-xl border border-red-100 text-red-800">
              <span className="text-[10px] font-bold uppercase block">Operating Expenses</span>
              <h2 className="text-3xl font-black font-mono mt-1">Rs. {lifetimeFinancialTotals.totalExpenses.toLocaleString()}</h2>
              <span className="text-[10px] block mt-1">Shop rent, electric bills, salaries, etc.</span>
            </div>

            <div className="p-5 bg-blue-950 rounded-xl border border-blue-900 text-white">
              <span className="text-[10px] font-bold uppercase text-slate-300 block">Net Profit Shareable</span>
              <h2 className="text-3xl font-black font-mono text-emerald-400 mt-1">Rs. {lifetimeFinancialTotals.netProfit.toLocaleString()}</h2>
              <span className="text-[10px] text-slate-300 block mt-1">Net surplus to be distributed to equity partners</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-5">Financial Metric Label</th>
                  <th className="py-3.5 px-5 text-right">Aggregated Amount</th>
                  <th className="py-3.5 px-5">Notes / Ledger Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                <tr>
                  <td className="py-3.5 px-5 font-bold">Total Sales (Collection)</td>
                  <td className="py-3.5 px-5 text-right font-bold font-mono">Rs. {lifetimeFinancialTotals.totalSales.toLocaleString()}</td>
                  <td className="py-3.5 px-5 text-slate-400">Total net sales processed (flat customer discounts deducted)</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-bold">Cost of Goods Sold (COGS)</td>
                  <td className="py-3.5 px-5 text-right font-bold font-mono">Rs. {lifetimeFinancialTotals.totalCOGS.toLocaleString()}</td>
                  <td className="py-3.5 px-5 text-slate-400">Total original purchasing cost of all parts sold</td>
                </tr>
                <tr className="bg-emerald-50/10">
                  <td className="py-3.5 px-5 font-bold text-emerald-800">Gross Markup Margin</td>
                  <td className="py-3.5 px-5 text-right font-bold font-mono text-emerald-700">Rs. {lifetimeFinancialTotals.grossProfit.toLocaleString()}</td>
                  <td className="py-3.5 px-5 text-slate-400">Net markup profit on part sales before shop overheads</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-bold text-red-500">Shop Operating Expenses</td>
                  <td className="py-3.5 px-5 text-right font-bold font-mono text-red-500">Rs. {lifetimeFinancialTotals.totalExpenses.toLocaleString()}</td>
                  <td className="py-3.5 px-5 text-slate-400">Rent, utilities, salaries, maintenance, transport, internet</td>
                </tr>
                <tr className="bg-blue-50/20">
                  <td className="py-3.5 px-5 font-black text-blue-900">Lifetime Net Business Profit</td>
                  <td className="py-3.5 px-5 text-right font-black font-mono text-blue-700 text-sm">Rs. {lifetimeFinancialTotals.netProfit.toLocaleString()}</td>
                  <td className="py-3.5 px-5 text-slate-500 font-semibold">Net real earnings of the business available for partner withdrawal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 3: MONTHLY PROFIT LEDGER
          ========================================== */}
      {reportTab === 'monthly_profit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Month-by-Month Profit ledger</h3>
            <p className="text-[11px] text-slate-400 font-mono">Automated monthly audit tracking revenue streams, inventory costs, and overhead expenditures.</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Month/Year</th>
                  <th className="py-3 px-5 text-right">Sales Revenue</th>
                  <th className="py-3 px-5 text-right">COGS (Wholesale)</th>
                  <th className="py-3 px-5 text-right">Gross Profit</th>
                  <th className="py-3 px-5 text-right">Shop Expenses</th>
                  <th className="py-3 px-5 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {monthlyProfitData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                      No monthly accounting history recorded.
                    </td>
                  </tr>
                ) : (
                  monthlyProfitData.map((d) => (
                    <tr key={d.month} className="hover:bg-slate-50/50 font-mono text-xs">
                      <td className="py-3 px-5 font-sans font-bold text-slate-900">{d.month}</td>
                      <td className="py-3 px-5 text-right text-slate-600">Rs. {d.sales.toLocaleString()}</td>
                      <td className="py-3 px-5 text-right text-slate-500">Rs. {d.cogs.toLocaleString()}</td>
                      <td className="py-3 px-5 text-right text-emerald-600 font-bold">Rs. {d.gross.toLocaleString()}</td>
                      <td className="py-3 px-5 text-right text-red-500">Rs. {d.expenses.toLocaleString()}</td>
                      <td className={`py-3 px-5 text-right font-bold ${d.net >= 0 ? 'text-blue-600 font-bold' : 'text-red-500'}`}>
                        Rs. {d.net.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 4: EXPENSE CATEGORY BREAKDOWN
          ========================================== */}
      {reportTab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Operational Expense Category Summary</h3>
            <p className="text-[11px] text-slate-400 font-mono">Consolidated look at shop operating expenditure distribution.</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Expense Category</th>
                  <th className="py-3 px-5 text-center">Vouchers Count</th>
                  <th className="py-3 px-5 text-right">Total Expenses Paid</th>
                  <th className="py-3 px-5 text-right">Percentage Share of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {expenseSummaryData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-normal">
                      No expenses registered.
                    </td>
                  </tr>
                ) : (
                  expenseSummaryData.map((e) => (
                    <tr key={e.category} className="hover:bg-slate-50/50">
                      <td className="py-3 px-5 font-bold text-slate-800">{e.category}</td>
                      <td className="py-3 px-5 text-center font-mono text-slate-500">{e.count} records</td>
                      <td className="py-3 px-5 text-right font-bold font-mono text-red-500">Rs. {e.total.toLocaleString()}</td>
                      <td className="py-3 px-5 text-right font-mono text-slate-500">{e.percentage.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 5: PARTNER PROFIT SHARING
          ========================================== */}
      {reportTab === 'partners_share' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Partner Profit Share Allocations</h3>
            <p className="text-[11px] text-slate-400 font-mono">Automatic division of Lifetime Net Profits based on active ownership percentages.</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Partner Name</th>
                  <th className="py-3 px-5 text-center">Ownership Percentage</th>
                  <th className="py-3 px-5 text-right">Gross Profit Allocated</th>
                  <th className="py-3 px-5 text-right">Total Drawn to Date</th>
                  <th className="py-3 px-5 text-right text-blue-900 font-bold">Remaining Profit share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {partnerDistributionData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-normal">
                      No partner records found. Register partners in the Partners Management module.
                    </td>
                  </tr>
                ) : (
                  partnerDistributionData.map((p) => (
                    <tr key={p.name} className="hover:bg-slate-50/50">
                      <td className="py-3 px-5 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-5 text-center font-bold text-slate-800 font-mono">{p.ownershipPercentage}%</td>
                      <td className="py-3 px-5 text-right font-mono text-emerald-600 font-bold">Rs. {p.allocatedProfitShare.toLocaleString()}</td>
                      <td className="py-3 px-5 text-right font-mono text-orange-500">Rs. {p.totalDrawings.toLocaleString()}</td>
                      <td className="py-3 px-5 text-right font-mono text-blue-600 font-black">Rs. {p.remainingProfitShare.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==========================================
          TAB 6: PARTNER WITHDRAWALS HISTORY LOG
          ========================================== */}
      {reportTab === 'drawings_history' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Partner Drawings / Withdrawals Ledger</h3>
            <p className="text-[11px] text-slate-400 font-mono">Detailed audit logs of cash/dividend withdrawals made by partners from their equity shares.</p>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Withdrawal Date</th>
                  <th className="py-3 px-5">Partner Name</th>
                  <th className="py-3 px-5">Withdrawal Reason</th>
                  <th className="py-3 px-5">Reference Notes</th>
                  <th className="py-3 px-5 text-right">Amount Withdrawn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {drawings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-normal">
                      No partner withdrawals logged.
                    </td>
                  </tr>
                ) : (
                  drawings.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-5 font-mono text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                      <td className="py-3 px-5 font-bold text-slate-900">{d.partnerName}</td>
                      <td className="py-3 px-5 font-semibold text-slate-800">{d.reason}</td>
                      <td className="py-3 px-5 text-slate-400">{d.notes || '—'}</td>
                      <td className="py-3 px-5 text-right font-mono font-bold text-orange-600">Rs. {d.amount.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
