import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

async function listModels() {
  try {
    // The new SDK @google/genai has different methods.
    // Let's try to see if we can find a list method.
    console.log("Checking models...");
    // If it's the @google/genai SDK, it might have a listModels method on the client or similar.
    // However, I'll try a common one.
    // Actually, I'll just try to hit an endpoint that definitely exists.
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    console.log("gemini-2.0-flash works!");
  } catch (e) {
    console.error("gemini-2.0-flash failed:", e.message);
  }
}

listModels();
