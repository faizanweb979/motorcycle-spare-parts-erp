import React, { useState, useEffect, useRef, useMemo } from "react";
import { useERP } from "../context/ERPContext";
import { auth } from "../firebase";
import { 
  Sparkles, 
  Send, 
  Trash2, 
  Copy, 
  Check, 
  ArrowRight, 
  Bot, 
  User, 
  AlertCircle, 
  Coins, 
  Boxes, 
  TrendingUp, 
  ShieldAlert 
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  provider?: "groq" | "gemini";
}

export const AIAssistant: React.FC = () => {
  const { 
    parts, 
    customers, 
    suppliers, 
    sales, 
    purchases, 
    expenses, 
    partners, 
    settings 
  } = useERP();

  // Role verification (from settings / localStorage / firebase email)
  const simulatedRole = useMemo(() => {
    const saved = localStorage.getItem("simulated_role");
    if (saved) return saved as "super_admin" | "admin" | "operator";
    const email = auth.currentUser?.email || "";
    if (email.includes("admin") || email.includes("owner") || email.includes("super")) return "super_admin";
    if (email.includes("operator")) return "operator";
    return "super_admin"; // Default to Super Admin for easy workspace testing
  }, []);

  const isAuthorized = simulatedRole === "super_admin" || simulatedRole === "admin";

  // Messages State (loaded from sessionStorage if present)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem("ai_chat_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save history to session storage
  useEffect(() => {
    sessionStorage.setItem("ai_chat_history", JSON.stringify(messages));
  }, [messages]);

  // Suggested Prompts
  const suggestedPrompts = [
    { text: "Which parts are running low on stock and need reordering?", category: "Inventory" },
    { text: "Summarize our current financial performance, including gross and net profit.", category: "Finance" },
    { text: "Who are our top debtors with high outstanding customer balances?", category: "Ledger" },
    { text: "What are our primary expense categories and how can we optimize costs?", category: "Expenses" },
    { text: "What is the capital standing and active status of all business partners?", category: "Partners" },
  ];

  // Compile real-time data context to feed into Gemini API
  const businessContext = useMemo(() => {
    // Basic date helpers
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMonthStr = now.toISOString().slice(0, 7);
    const currentYearStr = now.toISOString().slice(0, 4);

    // Active/non-returned transactions
    const activeSales = sales.filter(s => s.status !== "returned");
    const activePurchases = purchases.filter(p => p.status !== "returned");

    // Inventory Calculations
    const lowStockParts = parts
      .filter(p => p.stock <= p.minStock)
      .map(p => ({
        partNumber: p.partNumber,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        brand: p.brand
      }));

    const topValueParts = [...parts]
      .sort((a, b) => (b.purchasePrice * b.stock) - (a.purchasePrice * a.stock))
      .slice(0, 5)
      .map(p => ({
        partNumber: p.partNumber,
        name: p.name,
        stock: p.stock,
        purchasePrice: p.purchasePrice,
        retailValue: p.retailPrice * p.stock
      }));

    // Sales Calculations
    const totalSalesRevenue = activeSales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    const partSalesMap: Record<string, { name: string; quantity: number; totalRevenue: number }> = {};
    activeSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!partSalesMap[item.partId]) {
          partSalesMap[item.partId] = { name: item.name, quantity: 0, totalRevenue: 0 };
        }
        partSalesMap[item.partId].quantity += item.quantity;
        partSalesMap[item.partId].totalRevenue += item.totalPrice;
      });
    });

    const topSellingParts = Object.values(partSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Purchase Calculations
    const totalPurchasesCost = activePurchases.reduce((sum, p) => sum + p.totalAmount, 0);

    // Ledger Outstanding Balances
    const customerOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);
    const topDebtors = [...customers]
      .filter(c => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map(c => ({ name: c.name, phone: c.phone, balance: c.balance }));

    const supplierOutstanding = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const topCreditors = [...suppliers]
      .filter(s => s.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5)
      .map(s => ({ name: s.name, phone: s.phone, balance: s.balance }));

    // Expenses breakdown
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const expensesBreakdown: Record<string, number> = {};
    expenses.forEach(e => {
      expensesBreakdown[e.category] = (expensesBreakdown[e.category] || 0) + e.amount;
    });

    // Partners Investment
    const partnersCapital = partners.map(p => ({
      name: p.name,
      investment: p.investment,
      profitSharePercentage: p.profitSharePercentage,
      status: p.status
    }));

    // Gross and Net Profit Calculations
    const getGrossProfit = (salesList: typeof sales) => {
      return salesList.reduce((total, sale) => {
        const saleMargin = sale.items.reduce(
          (sum, item) => sum + ((item.retailPrice - (item.purchasePrice || 0)) * item.quantity), 
          0
        );
        return total + (saleMargin - sale.discount);
      }, 0);
    };

    // Calculate yearly metrics matching Reports
    const yearlySalesList = activeSales.filter(s => s.date.startsWith(currentYearStr));
    const yearlyGrossProfit = getGrossProfit(yearlySalesList);
    const yearlyExpensesAmount = expenses.filter(e => e.date.startsWith(currentYearStr)).reduce((sum, e) => sum + e.amount, 0);
    const yearlyNetProfit = yearlyGrossProfit - yearlyExpensesAmount;

    return {
      shopName: settings?.shopName || "Bismillah Autos",
      currency: settings?.currency || "Rs.",
      startingCash: settings?.startingCash !== undefined ? Number(settings.startingCash) : 50000,
      startingBank: settings?.startingBank !== undefined ? Number(settings.startingBank) : 150000,
      partsCount: parts.length,
      lowStockParts,
      topValueParts,
      salesCount: activeSales.length,
      salesRevenue: totalSalesRevenue,
      topSellingParts,
      purchasesCount: activePurchases.length,
      purchasesCost: totalPurchasesCost,
      customerOutstanding,
      topDebtors,
      supplierOutstanding,
      topCreditors,
      totalExpenses,
      expensesBreakdown,
      partnersCapital,
      grossProfit: yearlyGrossProfit,
      netProfit: yearlyNetProfit
    };
  }, [parts, customers, suppliers, sales, purchases, expenses, partners, settings]);

  const handleSend = async (textToSend: string) => {
    const trimmedInput = textToSend.trim();
    if (!trimmedInput) return;

    setError(null);
    setLoading(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: trimmedInput,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Prepare chat history payload for backend in simple format
    const chatHistoryPayload = messages.map(m => ({
      sender: m.sender,
      text: m.text
    }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedInput,
          chatHistory: chatHistoryPayload,
          businessContext
        })
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate AI insights.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response is not JSON (e.g. an HTML error page from the proxy/server)
          const textError = await response.text().catch(() => "");
          if (textError.includes("GEMINI_API_KEY") || textError.includes("API key")) {
            errorMessage = "GEMINI_API_KEY is not configured. Please add your Gemini API key in the Settings > Secrets panel.";
          } else {
            errorMessage = `Server Error (${response.status}): The server returned an unexpected response. Please try again or make sure your dev server is active.`;
          }
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The server responded with an invalid data format. Please verify your server configuration.");
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.text || "I was unable to analyze the request. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        provider: data.provider
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred while communicating with the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear the conversation history?")) {
      setMessages([]);
      sessionStorage.removeItem("ai_chat_history");
      setError(null);
    }
  };

  // If role is operator, lock screen
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-2xl mx-auto my-12 text-center">
        <div className="h-14 w-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-xs mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-950 tracking-tight">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md leading-relaxed">
          The AI Assistant contains sensitive business valuations, capital holdings, and performance reports.
          Access is restricted to **Admin** and **Super Admin** roles.
        </p>
        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-800 leading-relaxed max-w-sm">
          Please navigate to the **Logs & Settings** panel to simulate an active Super Admin or Admin role.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-180px)] min-h-[500px]">
      
      {/* Left panel: Info & Suggested Prompts */}
      <div className="lg:w-80 flex flex-col gap-4 shrink-0">
        {/* Module Title Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/10">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">ERP AI Advisor</h2>
              <span className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">Groq & Gemini Dual Sync</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            I have real-time, read-only access to your spare parts catalogs, daily POS sales, purchase registers, credit customer ledgers, and partner accounts. Ask any analytical business questions below.
          </p>
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Authorized Role:</span>
              <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold text-[9px] border border-blue-100">{simulatedRole}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Integrations status:</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">● Online</span>
            </div>
          </div>
        </div>

        {/* Dynamic Context Summary Cards */}
        <div className="bg-slate-900 text-slate-100 p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col gap-4 hidden lg:flex">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono">Live Sync Status</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <Boxes className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Catalog & Parts</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{businessContext.partsCount} Items • {businessContext.lowStockParts.length} low stock</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Financial Revenue</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{businessContext.currency}{businessContext.salesRevenue.toLocaleString()} POS gross</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Coins className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Credit Ledger Balance</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{businessContext.currency}{businessContext.customerOutstanding.toLocaleString()} receivables</p>
              </div>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 italic">Data compiles automatically from active Firestore transactions before query submission.</p>
        </div>
      </div>

      {/* Right panel: Chat Container */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-bold text-slate-800">Business Consultation Chat</span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Clear entire thread"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>

        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-slate-50/20">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-xl mx-auto my-auto py-12">
              <Bot className="h-10 w-10 text-blue-600/30 mb-3 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800">Ask MotoPart AI Assistant</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                Choose a suggested prompt below or type any custom query. Your session chat history will be temporarily cached during the session.
              </p>

              {/* Suggestion list */}
              <div className="mt-6 w-full space-y-2 text-left">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt.text)}
                    className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-between group gap-4 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold text-[8px] font-mono shrink-0">{prompt.category}</span>
                      <span className="truncate pr-2 font-medium">{prompt.text}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-3xl ${msg.sender === "user" ? "ml-auto flex-row-reverse" : ""}`}
                >
                  <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center ${
                    msg.sender === "user" 
                      ? "bg-slate-100 text-slate-600 border border-slate-200" 
                      : "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                  }`}>
                    {msg.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div className="flex flex-col gap-1 min-w-0 max-w-[85%]">
                    <div className={`px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-3xs relative group ${
                      msg.sender === "user" 
                        ? "bg-slate-900 text-white rounded-tr-none" 
                        : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none"
                    }`}>
                      {/* Message Text with proper formatting */}
                      <div className="whitespace-pre-wrap break-words prose prose-sm max-w-none">
                        {msg.text}
                      </div>

                      {/* Copy Button */}
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className={`absolute -bottom-7 right-1 p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 transition-opacity hidden group-hover:flex items-center justify-center text-slate-400 hover:text-slate-600 ${
                          msg.sender === "user" ? "right-auto left-1" : ""
                        }`}
                        title="Copy Response"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <span className={`text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 ${msg.sender === "user" ? "justify-end text-right" : ""}`}>
                      {msg.timestamp}
                      {msg.sender === "ai" && msg.provider && (
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded font-sans tracking-wide ${
                          msg.provider === "groq" 
                            ? "bg-amber-50 text-amber-700 border border-amber-200/60" 
                            : "bg-blue-50 text-blue-700 border border-blue-200/60"
                        }`}>
                          {msg.provider}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}

              {/* Server-Side Loading indicator */}
              {loading && (
                <div className="flex gap-3 max-w-xl">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center animate-pulse shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-slate-100 border border-slate-200/40 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs text-slate-500 shadow-2xs font-medium">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    Analyzing real-time transaction ledger & inventory indexes...
                  </div>
                </div>
              )}

              {/* Error block */}
              {error && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs max-w-xl font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Gemini API Service Alert</p>
                    <p className="mt-0.5 leading-relaxed text-red-600/90">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input form */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Ask about fast-moving items, debtors, yearly profits, or improvements..."
              className="flex-1 bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500/10 transition-all placeholder-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 uppercase tracking-wide"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Submit</span>
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};
