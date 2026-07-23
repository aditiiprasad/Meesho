const defaultUrl = 'http://127.0.0.1:8000';

export const API_URL = import.meta.env.VITE_API_URL || defaultUrl;

/** True when Vercel/production build has no backend URL baked in at build time. */
export const API_MISCONFIGURED =
  import.meta.env.PROD && !import.meta.env.VITE_API_URL;
