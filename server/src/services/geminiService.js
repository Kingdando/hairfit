const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 120000 // 120 seconds in milliseconds
  }
});

/**
 * Identity-preserving hairstyle try-on
 */
async function generateHairstylePreview(imageBase64, hairstyleName) {
  // Accept either a data URL or raw base64. A device file:// URI is not image
  // data and must never be forwarded as Gemini's inlineData payload.
  const dataUrlMatch = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageBase64);
  const rawBase64 = dataUrlMatch ? dataUrlMatch[2] : imageBase64;
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : 'image/jpeg';
  if (typeof rawBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
    throw new Error('Photo data must be base64 encoded. Select or capture the photo again.');
  }

  const promptText = `Preserve the person's exact face, identity, expression, and skin tone. Edit ONLY their hair to a ${hairstyleName} style. High quality photorealistic result.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image', // Uses your active $30 credit balance
    contents: [
      {
        inlineData: {
          mimeType,
          data: rawBase64,
        },
      },
      promptText,
    ],
  });

  return response;
}

module.exports = { generateHairstylePreview };
