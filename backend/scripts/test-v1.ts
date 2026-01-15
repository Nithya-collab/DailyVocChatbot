import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || "",
  apiVersion: "v1",
});

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
    });
    console.log("Success with gemini-1.5-flash-latest on v1");
  } catch (e) {
    console.error("Failed:", e.message);
  }
}

test();
