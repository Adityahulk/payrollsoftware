import axios from 'axios';
import { API_BASE_URL } from '../config';

// ─── Pending request map for deduplication ──────────────────────────────────
const pendingRequests = new Map();

// const getRequestKey = (config) =>
//   `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;

// ─── Global Loading state event publisher ────────────────────────────────────
let activeRequests = 0;
let activeMutations = 0;
const loadListeners = new Set();

const publishLoadingState = () => {
  const state = {
    loading: activeRequests > 0,
    mutating: activeMutations > 0,
  };
  loadListeners.forEach((fn) => fn(state));
};

export const subscribeToLoading = (fn) => {
  loadListeners.add(fn);
  fn({ loading: activeRequests > 0, mutating: activeMutations > 0 });
  return () => loadListeners.delete(fn);
};

// ─── Axios instance ──────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: attach token + idempotency key + dedup ─────────────
apiClient.interceptors.request.use((config) => {
  activeRequests++;
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    activeMutations++;
  }
  publishLoadingState();
  // Strip duplicate '/api' if present in URL
  if (config.url && config.url.startsWith('/api/')) {
    config.url = config.url.substring(4);
  }

  // Attach JWT
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Idempotency key for mutating requests (prevent double-submit)
  if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['Idempotency-Key'] =
      config.headers['Idempotency-Key'] || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  // Deduplication: cancel in-flight duplicate GET requests
  // (Disabled temporarily to fix CanceledError and ensure stable API calls)
  /*
  if (config.method === 'get') {
    const key = getRequestKey(config);
    const existingSignal = pendingRequests.get(key);
    if (existingSignal && (existingSignal === true || !existingSignal.aborted)) {
      // Cancel the NEW duplicate request (not the existing one)
      const controller = new AbortController();
      controller.abort(`Duplicate request cancelled: ${key}`);
      config.signal = controller.signal;
    } else {
      // Register this request as in-flight; track its signal
      config._dedupKey = key;
      pendingRequests.set(key, config.signal || true);
    }
  }
  */

  return config;
});


// ─── Response interceptor: clear dedup map + handle 401 ─────────────────────
apiClient.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (['post', 'put', 'patch', 'delete'].includes(response.config?.method?.toLowerCase())) {
      activeMutations = Math.max(0, activeMutations - 1);
    }
    publishLoadingState();

    if (response.config._dedupKey) {
      if (pendingRequests.get(response.config._dedupKey) === (response.config.signal || true)) {
        pendingRequests.delete(response.config._dedupKey);
      }
    }
    return response;
  },
  async (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (['post', 'put', 'patch', 'delete'].includes(error.config?.method?.toLowerCase())) {
      activeMutations = Math.max(0, activeMutations - 1);
    }
    publishLoadingState();

    if (error.config?._dedupKey) {
      if (pendingRequests.get(error.config._dedupKey) === (error.config.signal || true)) {
        pendingRequests.delete(error.config._dedupKey);
      }
    }

    // Session timeout: redirect to login on 401 (excluding login attempts)
    if (error.response?.status === 401) {
      if (!error.config?.url?.includes('/Auth/login')) {
        sessionStorage.clear();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Don't retry cancelled (deduplicated) requests
    if (axios.isCancel(error)) return Promise.reject(error);

    return Promise.reject(error);
  }
);

// ─── Retry wrapper with exponential backoff ──────────────────────────────────
// const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

export async function withRetry(requestFn, maxRetries = 3) {
  // Retry logic temporarily disabled as requested
  return await requestFn();
}

// ─── Cancel-token factory for component unmounts ─────────────────────────────
export function createCancelToken() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort('Component unmounted'),
  };
}

export default apiClient;
