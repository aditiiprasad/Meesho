/**
 * API base URL.
 * - Local: frontend/.env.local → http://127.0.0.1:8000
 * - Production: VITE_API_URL at Vercel build time, or fallback below
 */
const PRODUCTION_API = 'https://meesho-backend-wgsi.onrender.com';
const LOCAL_API = 'http://127.0.0.1:8000';

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API : LOCAL_API);

export const API_MISCONFIGURED = false;
