import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Chat endpoint
  app.post("/api/ai/chat", async (req, res) => {
    const { prompt, chatHistory, businessContext } = req.body;

    const groqApiKey = process.env.GROQ_API_KEY;
    let groqErrorMsg = "";
    let useGroqSuccess = false;
    let responseText = "";
    let providerUsed: "groq" | "gemini" = "gemini";

    const systemInstruction = `
You are the dedicated AI Assistant for "MotoPart ERP" (Bismillah Autos & Spare Parts, McLeod Road, Lahore, Pakistan).
Your goal is to provide deep, actionable business insights, financial analyses, and inventory advice based on the real-time ERP data provided to you.

Guidelines:
1. Read the businessContext carefully. It contains real-time summaries of Inventory (Parts), Sales, Purchases, Expenses, Ledger balances, and Profit metrics.
2. Answer the user's query clearly, professionally, and objectively in Pakistani Urdu, English, or a mix of both (as preferred in Pakistani retail, e.g., Urdu with English terminology). Keep the tone helpful, respectful, and business-focused.
3. Be data-driven: cite specific numbers, values, or parts from the context to support your advice or summaries.
4. Provide actionable insights (e.g., "Sprocket Kit CD70 is low on stock, suggest reordering 15 units since it is a fast-moving item" or "Customer ABC has an outstanding balance of Rs. 45,000, which has been unpaid for 30 days").
5. Strictly adhere to READ-ONLY operations. Emphasize that you cannot modify database entries or trigger real transactions.
6. Make recommendations for simple business improvements, cost saving, or optimization.
7. Use neat Markdown formatting for readability, including bold text, bullet points, and tables. Do not mention system-internal files, JSON structures, or tech details.
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
Low Stock Parts (Needs Reordering):
${JSON.stringify((businessContext && businessContext.lowStockParts) || [], null, 2)}
Top 5 Retail Value Parts:
${JSON.stringify((businessContext && businessContext.topValueParts) || [], null, 2)}

--- SALES SUMMARY ---
Total Sales Count: ${(businessContext && businessContext.salesCount) || 0}
Total Sales Revenue: ${currencySymbol} ${((businessContext && businessContext.salesRevenue) || 0).toLocaleString()}
Top Selling Parts:
${JSON.stringify((businessContext && businessContext.topSellingParts) || [], null, 2)}

--- PURCHASES SUMMARY ---
Total Purchases Count: ${(businessContext && businessContext.purchasesCount) || 0}
Total Purchases Cost: ${currencySymbol} ${((businessContext && businessContext.purchasesCost) || 0).toLocaleString()}

--- LEDGER BALANCES ---
Total Outstanding Credits (From Customers): ${currencySymbol} ${((businessContext && businessContext.customerOutstanding) || 0).toLocaleString()}
Top Debtors (Customers with balance):
${JSON.stringify((businessContext && businessContext.topDebtors) || [], null, 2)}

Total Outstanding Debts (To Suppliers): ${currencySymbol} ${((businessContext && businessContext.supplierOutstanding) || 0).toLocaleString()}
Top Creditors (Suppliers with balance):
${JSON.stringify((businessContext && businessContext.topCreditors) || [], null, 2)}

--- EXPENSES SUMMARY ---
Total Expenses Amount: ${currencySymbol} ${((businessContext && businessContext.totalExpenses) || 0).toLocaleString()}
Expenses Breakdown by Category:
${JSON.stringify((businessContext && businessContext.expensesBreakdown) || {}, null, 2)}

--- PARTNERS CAPITAL ---
Active Partners Capital Summary:
${JSON.stringify((businessContext && businessContext.partnersCapital) || [], null, 2)}

--- CURRENT YEAR FINANCIAL PERFORMANCE ---
Yearly Gross Profit: ${currencySymbol} ${((businessContext && businessContext.grossProfit) || 0).toLocaleString()}
Yearly Expenses: ${currencySymbol} ${((businessContext && businessContext.totalExpenses) || 0).toLocaleString()}
Yearly Net Profit: ${currencySymbol} ${((businessContext && businessContext.netProfit) || 0).toLocaleString()}
`;

    // 1. Try Groq API first if available
    if (groqApiKey) {
      try {
        console.log("Attempting to generate insights using Groq API...");
        const groqMessages = [
          { role: "system", content: systemInstruction }
        ];

        if (chatHistory && chatHistory.length > 0) {
          groqMessages.push({
            role: "user",
            content: `${contextPrompt}\n\nHi AI, please keep this real-time business snapshot in mind.`
          });
          groqMessages.push({
            role: "assistant",
            content: `Understood! I have loaded the real-time business data for ${(businessContext && businessContext.shopName) || "Bismillah Autos"}. I am ready to provide business analysis and answer questions based on this data. What would you like to know?`
          });
          chatHistory.forEach((msg: any) => {
            groqMessages.push({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.text
            });
          });
          groqMessages.push({
            role: "user",
            content: prompt
          });
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

        if (groqResponse.ok) {
          const result: any = await groqResponse.json();
          if (result && result.choices && result.choices[0] && result.choices[0].message) {
            console.log("Successfully generated response using Groq API.");
            responseText = result.choices[0].message.content;
            providerUsed = "groq";
            useGroqSuccess = true;
          } else {
            console.warn("Invalid response structure from Groq:", result);
            groqErrorMsg = "Invalid response body structure from Groq.";
          }
        } else {
          const errText = await groqResponse.text().catch(() => "");
          console.warn(`Groq API returned error status ${groqResponse.status}:`, errText);
          groqErrorMsg = `HTTP ${groqResponse.status}: ${errText || "Unknown error"}`;
        }
      } catch (err: any) {
        console.warn("Groq API call failed with exception, switching to Gemini API fallback:", err);
        groqErrorMsg = err.message || String(err);
      }
    }

    // 2. Fallback to Gemini if Groq failed or was skipped
    if (!useGroqSuccess) {
      console.log("Falling back to Gemini API due to Groq unavailability or limit exhaustion...");
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: `Groq API failed (${groqErrorMsg || "No Key"}), and GEMINI_API_KEY is not configured. Please add the Gemini API key in the Settings panel.` 
        });
      }

      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            }
          }
        });

        const contents = [];

        if (chatHistory && chatHistory.length > 0) {
          contents.push({
            role: "user",
            parts: [{ text: `${contextPrompt}\n\nHi AI, please keep this real-time business snapshot in mind.` }]
          });
          contents.push({
            role: "model",
            parts: [{ text: `Understood! I have loaded the real-time business data for ${(businessContext && businessContext.shopName) || "Bismillah Autos"}. I am ready to provide business analysis and answer questions based on this data. What would you like to know?` }]
          });

          chatHistory.forEach((msg: any) => {
            contents.push({
              role: msg.sender === "user" ? "user" : "model",
              parts: [{ text: msg.text }]
            });
          });

          contents.push({
            role: "user",
            parts: [{ text: prompt }]
          });
        } else {
          contents.push({
            role: "user",
            parts: [{ text: `${contextPrompt}\n\nUser Question: ${prompt}` }]
          });
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents,
          config: {
            systemInstruction,
          }
        });

        responseText = response.text || "";
        providerUsed = "gemini";
      } catch (error: any) {
        console.error("Both Groq and Gemini API calls failed. Gemini Error:", error);
        return res.status(500).json({ 
          error: `API Call Failed. Groq Error: ${groqErrorMsg || "None"}. Gemini Error: ${error.message || "None"}` 
        });
      }
    }

    return res.json({ text: responseText, provider: providerUsed });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Failed to boot Express + Vite Server:", err);
});
