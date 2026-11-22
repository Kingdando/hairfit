const CONFIGURED_URL = process.env.EXPO_PUBLIC_API_URL?.trim();

function normalizeUrl(url: string) {
  const normalized = url.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('EXPO_PUBLIC_API_URL must start with http:// or https://');
  }
  return normalized;
}

export function resolveApiUrl() {
  if (!CONFIGURED_URL) throw new Error('EXPO_PUBLIC_API_URL is missing from the Expo environment.');
  return normalizeUrl(CONFIGURED_URL);
}

export const API_URL = resolveApiUrl();
