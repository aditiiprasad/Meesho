/** Fetch with timeout — Render free tier cold starts can take 60–90s. */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(
        'Backend is waking up — Render free tier can take up to 1–2 minutes. Wait and try again.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
