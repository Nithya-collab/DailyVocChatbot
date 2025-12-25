
import { GoogleGenAI, Type } from "@google/genai";
import { VocabWord, ScheduleIntent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateDailyWords = async (): Promise<VocabWord[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Generate 5 interesting, advanced English vocabulary words. Provide word, definition, pronunciation (phonetic), and one example sentence for each.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            definition: { type: Type.STRING },
            pronunciation: { type: Type.STRING },
            example: { type: Type.STRING }
          },
          required: ["word", "definition", "pronunciation", "example"]
        }
      }
    }
  });

  const wordsData = JSON.parse(response.text || '[]');
  
  // Generate images for each word
  const wordsWithImages = await Promise.all(wordsData.map(async (item: any) => {
    const imageUrl = await generateWordImage(item.word, item.definition);
    return {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      imageUrl
    };
  }));

  return wordsWithImages;
};

const generateWordImage = async (word: string, definition: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Create a high-quality, clear, cinematic visual representation of the vocabulary word "${word}" which means "${definition}". The image should be helpful for memory retention.` }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image generation failed", error);
  }
  return `https://picsum.photos/seed/${word}/400/400`;
};

export const parseReminderIntent = async (text: string): Promise<ScheduleIntent> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this user request for a reminder and extract scheduling information: "${text}". 
    Return JSON format only. 
    Examples: 
    "remind me in 1 hour" -> { "action": "remind", "delayMinutes": 60 }
    "remind me at 5pm" -> { "action": "remind", "absoluteTime": "17:00" }`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          delayMinutes: { type: Type.NUMBER },
          absoluteTime: { type: Type.STRING }
        },
        required: ["action"]
      }
    }
  });

  return JSON.parse(response.text || '{"action": "other"}');
};
