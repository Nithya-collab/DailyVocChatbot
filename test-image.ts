import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

async function testImageGen() {
  try {
    const response = await ai.models.generateImages({
      model: "imagen-3",
      prompt: "A futuristic city",
    });
    console.log("Image response keys:", Object.keys(response));
  } catch (e) {
    console.error("Image gen failed:", e.message);
  }
}

testImageGen();
