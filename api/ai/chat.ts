import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, chatHistory, businessContext } = req.body;

  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured in Vercel environment variables." });
  }

  const systemInstruction = `
You are the dedicated AI Assistant for "MotoPart ERP" (Bismillah Autos & Spare Parts, McLeod Road, Lahore, Pakistan).
Your goal is to provide deep, actionable business insights, financial analyses, and inventory advice based on the real-time ERP data provided to you.

Guidelines:
1. Read the businessContext carefully. It contains real-time summaries of Inventory (Parts), Sales, Purchases, Expenses, Ledger balances, and Profit metrics.
2. Answer the user's query clearly, professionally, and objectively in Pakistani Urdu, English, or a mix of both (as preferred in Pakistani retail, e.g., Urdu with English terminology). Keep the tone helpful, respectful, and business-focused.
3. Be data-driven: cite specific numbers, values, or parts from the context to support your advice or summaries.
4. Provide actionable insights (e.g., "Sprocket Kit CD70 is low on stock, suggest reordering 15 units since it is a fast-moving item").
5. Strictly adhere to READ-ONLY operations. Emphasize that you cannot modify database entries or trigger real transactions.
6. Make recommendations for simple business improvements, cost saving, or optimization.
7. Use neat Markdown formatting for readability, including bold text, bullet points, and tables.
  `;

  const currencySymbol = (businessContext && businessContext.currency) || "Rs.";
  const contextPrompt = `
[REAL-TIME ERP BUSINESS DATA CONTEXT]
Currency: ${currencySymbol}
Shop Name: ${(businessContext && businessContext.shopName) || "Bismillah Autos"}
Starting Cash: ${currencySymbol} ${((businessContext && businessContext.startingCash) || 0).toLocaleString()}
Starting Bank: ${currencySymbol} ${((businessContext && businessContext.startingBank) || 0).toLocaleString()}

--- INVENTORY SUMMARY ---
Total Unique Parts: ${(businessContext && businessContext.partsCount) || 0}
Low Stock Parts: ${JSON.stringify((businessContext && businessContext.lowStockParts) || [])}
Top 5 Retail Value Parts: ${JSON.stringify((businessContext && businessContext.topValueParts) || [])}

--- SALES SUMMARY ---
Total Sales Count: ${(businessContext && businessContext.salesCount) || 0}
Total Sales Revenue: ${currencySymbol} ${((businessContext && businessContext.salesRevenue) || 0).toLocaleString()}
Top Selling Parts: ${JSON.stringify((businessContext && businessContext.topSellingParts) || [])}

--- PURCHASES SUMMARY ---
Total Purchases Count: ${(businessContext && businessContext.purchasesCount) || 0}
Total Purchases Cost: ${currencySymbol} ${((businessContext && businessContext.purchasesCost) || 0).toLocaleString()}

--- LEDGER BALANCES ---
Total Outstanding Credits (Customers): ${currencySymbol} ${((businessContext && businessContext.customerOutstanding) || 0).toLocaleString()}
Top Debtors: ${JSON.stringify((businessContext && businessContext.topDebtors) || [])}
Total Outstanding Debts (Suppliers): ${currencySymbol} ${((businessContext && businessContext.supplierOutstanding) || 0).toLocaleString()}
Top Creditors: ${JSON.stringify((businessContext && businessContext.topCreditors) || [])}

--- EXPENSES SUMMARY ---
Total Expenses: ${currencySymbol} ${((businessContext && businessContext.totalExpenses) || 0).toLocaleString()}
Breakdown: ${JSON.stringify((businessContext && businessContext.expensesBreakdown) || {})}

--- PARTNERS CAPITAL ---
${JSON.stringify((businessContext && businessContext.partnersCapital) || [])}

--- CURRENT YEAR FINANCIAL PERFORMANCE ---
Yearly Gross Profit: ${currencySymbol} ${((businessContext && businessContext.grossProfit) || 0).toLocaleString()}
Yearly Net Profit: ${currencySymbol} ${((businessContext && businessContext.netProfit) || 0).toLocaleString()}
`;

  try {
    const groqMessages: any[] = [{ role: "system", content: systemInstruction }];

    if (chatHistory && chatHistory.length > 0) {
      groqMessages.push({
        role: "user",
        content: `${contextPrompt}\n\nHi AI, please keep this real-time business snapshot in mind.`
      });
      groqMessages.push({
        role: "assistant",
        content: `Understood! I have loaded the real-time business data for ${(businessContext && businessContext.shopName) || "Bismillah Autos"}. What would you like to know?`
      });
      chatHistory.forEach((msg: any) => {
        groqMessages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        });
      });
      groqMessages.push({ role: "user", content: prompt });
    } else {
      groqMessages.push({
        role: "user",
        content: `${contextPrompt}\n\nUser Question: ${prompt}`
      });
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text().catch(() => "");
      return res.status(500).json({ error: `Groq API Error: ${errText}` });
    }

    const result: any = await groqResponse.json();
    const text = result?.choices?.[0]?.message?.content || "";

    return res.json({ text, provider: "groq" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Unexpected server error." });
  }
}
