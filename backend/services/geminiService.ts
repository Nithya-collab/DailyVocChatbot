
import { GoogleGenAI, Type } from "@google/genai";
import { VocabWord, ScheduleIntent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const themes = [
  "Nature and Environment", "Technology and Innovation", "Human Emotions",
  "Business and Leadership", "Art and Literature", "Science and Space",
  "Philosophy and Thinking", "Travel and Culture", "Food and Culinary Arts",
  "History and Ancient Times", "Architecture and Design", "Music and Performance"
];

export const generateDailyWords = async (): Promise<VocabWord[]> => {
  const theme = themes[Math.floor(Math.random() * themes.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 5 interesting, advanced English vocabulary words related to the theme "${theme}". Provide word, definition, pronunciation (phonetic), one example sentence, and Tamil meaning for each. Ensure these are unique and not just the most common words.`,
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
            example: { type: Type.STRING },
            tamilMeaning: { type: Type.STRING }
          },
          required: ["word", "definition", "pronunciation", "example", "tamilMeaning"]
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

export const generateWordOfTheDay = async (): Promise<VocabWord> => {
  const theme = themes[Math.floor(Math.random() * themes.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate 1 interesting, advanced English vocabulary word related to the theme "${theme}". Provide word, definition, pronunciation (phonetic), one example sentence, and Tamil meaning.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          definition: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          example: { type: Type.STRING },
          tamilMeaning: { type: Type.STRING }
        },
        required: ["word", "definition", "pronunciation", "example", "tamilMeaning"]
      }
    }
  });

  const wordData = JSON.parse(response.text || '{}');
  const imageUrl = await generateWordImage(wordData.word, wordData.definition);

  return {
    ...wordData,
    id: new Date().toISOString().split('T')[0], // Use date as ID
    imageUrl
  };
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
