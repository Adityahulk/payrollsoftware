// ── LOCAL DEVELOPMENT ──────────────────────────────────────────
// Use localhost:5200 when running the backend locally.
// For production, set REACT_APP_BACKEND_ORIGIN in .env.production
// ────────────────────────────────────────────────────────────────
const DEFAULT_BACKEND_ORIGIN = process.env.REACT_APP_BACKEND_ORIGIN || 'http://localhost:5125';

export const BACKEND_ORIGIN = DEFAULT_BACKEND_ORIGIN.replace(/\/$/, '');
export const API_BASE_URL = `${BACKEND_ORIGIN}/api`;
export const SIGNALR_HUB_URL = `${BACKEND_ORIGIN}/hub/notifications`;
