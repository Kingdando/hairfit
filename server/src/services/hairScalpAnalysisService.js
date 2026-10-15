const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 120000 },
});

function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

async function analyzeHairAndScalp(imageData) {
  const dataUrlMatch = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageData);
  const rawBase64 = dataUrlMatch ? dataUrlMatch[2] : imageData;
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : 'image/jpeg';
  if (typeof rawBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64)) {
    throw new Error('Photo data must be base64 encoded. Select or capture the photo again.');
  }

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.8-flash',
    contents: [
      {
        inlineData: { mimeType, data: rawBase64 },
      },
      `Review this photo for general cosmetic hair and scalp care only. Describe only details clearly visible in the image. Do not diagnose or claim to detect a disease, infection, hair-loss cause, or other medical condition. Mention image limitations and uncertainty. Return only a JSON object with exactly these string fields: hairType (visible curl pattern/type), hairLength (visible length such as short, medium, or long), hairTexture (visible texture such as straight, wavy, curly, or coily), visibleScalpObservations, whenToSeekProfessional, disclaimer; and careTips as an array of 3 short strings. If a feature is not clearly visible, say "Unable to determine from this photo." Keep the guidance neutral, practical, and non-medical.`,
    ],
  });

  const analysis = parseJson(response.text || '');
  if (
    typeof analysis.hairType !== 'string' ||
    typeof analysis.hairLength !== 'string' ||
    typeof analysis.hairTexture !== 'string' ||
    typeof analysis.visibleScalpObservations !== 'string' ||
    !Array.isArray(analysis.careTips) ||
    typeof analysis.whenToSeekProfessional !== 'string' ||
    typeof analysis.disclaimer !== 'string'
  ) {
    throw new Error('The AI returned an incomplete hair and scalp analysis. Please try again.');
  }
  return analysis;
}

module.exports = { analyzeHairAndScalp };
