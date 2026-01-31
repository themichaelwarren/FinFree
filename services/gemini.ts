
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptExtraction } from "../types";

export async function extractReceiptData(
  apiKey: string,
  base64Image: string,
  mimeType: string
): Promise<ReceiptExtraction> {
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Extract from this Japanese receipt: store name, date, total amount (税込 total if shown), and list items with prices if legible. Return as JSON: {store, date, total, items: [{name, price}], confidence: high/medium/low}`;

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
          confidence: { type: Type.STRING }
        },
        required: ["store", "date", "total", "items", "confidence"]
      }
    }
  });

  const jsonStr = response.text.trim();
  return JSON.parse(jsonStr) as ReceiptExtraction;
}
