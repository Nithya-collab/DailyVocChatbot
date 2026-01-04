import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

async function listModels() {
  try {
    // In @google/genai, the client usually exposes methods for management.
    // However, I'll try to use a generic approach to see if it's available.
    // Looking at the SDK structure, it might be ai.models.list()
    // Let's try to inspect the ai.models object.
    console.log("Models object keys:", Object.keys(ai.models));
  } catch (e) {
    console.error("Failed to list models:", e);
  }
}

listModels();
