import 'dotenv/config'; // Loads variables from .env into process.env
import { GoogleGenAI } from '@google/genai';

// Initialize the client using the key from .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runTest() {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image',
    contents: 'A small test prompt to check connection',
  });
  console.log('API Response:', response);
}

runTest();