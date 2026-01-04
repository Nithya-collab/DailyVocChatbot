import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

async function listModels() {
  try {
    const response = await ai.models.list();
    console.log("Response type:", typeof response);
    console.log("Response keys:", Object.keys(response));
    if (Array.isArray(response)) {
      response.forEach((m) => console.log(m.name));
    } else {
      // @ts-ignore
      console.log("Response.models length:", response.models?.length);
      // @ts-ignore
      response.models?.forEach((m) => console.log(m.name));
    }
  } catch (e) {
    console.error("Failed to list models:", e);
  }
}

listModels();
