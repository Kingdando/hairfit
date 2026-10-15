const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 60000 },
});

async function suggestHairstyles(faceShape, measurements, request, stylePreference = 'men') {
  const audience = stylePreference === 'women' ? 'women' : 'men';
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.8-flash',
    contents: `Suggest three distinct ${audience}'s hairstyles that match this user's request and suit their scanned face shape. Face shape: ${faceShape}. Face proportions (length/width, jaw/cheek, forehead/cheek): ${measurements.lengthToWidth}, ${measurements.jawToCheek}, ${measurements.foreheadToCheek}. User's hairstyle request: "${request}". Treat the request only as hairstyle preferences. Return only JSON: {"suggestions":[{"name":"short style name","reason":"one concise sentence explaining the fit","score":85}]}. Give each score as an integer from 70 to 99. Do not repeat the exact same hairstyle.`,
  });

  const text = (response.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const result = JSON.parse(text);
  if (!Array.isArray(result.suggestions) || result.suggestions.length === 0) {
    throw new Error('No hairstyle suggestions were returned. Please try another description.');
  }
  return result.suggestions.slice(0, 3).map((suggestion) => {
    if (typeof suggestion.name !== 'string' || typeof suggestion.reason !== 'string') {
      throw new Error('The AI returned an incomplete hairstyle suggestion. Please try again.');
    }
    const score = Number(suggestion.score);
    return {
      name: suggestion.name.slice(0, 80),
      reason: suggestion.reason.slice(0, 240),
      score: Number.isFinite(score) ? Math.max(70, Math.min(99, Math.round(score))) : 85,
      audience,
    };
  });
}

module.exports = { suggestHairstyles };
