
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptExtraction, CategoryDefinition } from "../types";

// Provide hints to help AI understand what each category is for
function getCategoryHints(id: string, name: string): string {
  const hints: Record<string, string> = {
    'RENT': 'housing, apartment rent',
    'ELECTRIC': 'electricity bills',
    'GAS': 'gas bills, propane',
    'WATER': 'water bills',
    'PHONE': 'mobile phone, internet bills',
    'FOOD': 'groceries, supermarkets, convenience store food',
    'TRANSPORT': 'trains, buses, taxis, gas stations',
    'TOILETRIES': 'drugstores, cosmetics, hygiene products',
    'EAT OUT': 'restaurants, cafes, takeout, fast food',
    'WANT': 'entertainment, hobbies, non-essential shopping',
    'SAVE': 'savings, investments',
    'DEBT': 'loan payments, credit card payments'
  };
  return hints[id] || name.toLowerCase();
}

export async function extractReceiptData(
  apiKey: string,
  base64Image: string,
  mimeType: string,
  categories?: CategoryDefinition[]
): Promise<ReceiptExtraction> {
  const ai = new GoogleGenAI({ apiKey });

  // Build category context for the AI
  const categoryContext = categories?.length
    ? `\n\nAvailable expense categories:\n${categories.map(c =>
        `- ${c.id}: "${c.name}" (${c.defaultType}) - use for ${getCategoryHints(c.id, c.name)}`
      ).join('\n')}\n\nBased on the store name and items, suggest the most appropriate category ID from this list.`
    : '';

  const prompt = `Extract from this Japanese receipt: store name, date (format YYYY-MM-DD), total amount (税込 total if shown), and list items with prices if legible.${categoryContext}

Return JSON with: store, date, total, items [{name, price}], confidence (high/medium/low), suggestedCategory (category ID), suggestedType (NEED/WANT/SAVE based on the purchase).

Category selection tips:
- Grocery stores, supermarkets (イオン, ライフ, OK, 業務スーパー, etc.) → FOOD
- Convenience stores (セブン, ファミマ, ローソン) buying food/drinks → FOOD or EAT OUT
- Restaurants, cafes, fast food → EAT OUT
- Drug stores (マツキヨ, ウェルシア) → TOILETRIES (if cosmetics/toiletries) or FOOD (if food)
- Train/bus charges → TRANSPORT
- Amazon, electronics stores → usually WANT
- Utility bills → appropriate utility category`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          store: { type: Type.STRING },
          date: { type: Type.STRING },
          total: { type: Type.NUMBER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER }
              },
              required: ["name", "price"]
            }
          },
          confidence: { type: Type.STRING },
          suggestedCategory: { type: Type.STRING },
          suggestedType: { type: Type.STRING }
        },
        required: ["store", "date", "total", "items", "confidence"]
      }
    }
  });

  const jsonStr = response.text.trim();
  return JSON.parse(jsonStr) as ReceiptExtraction;
}
