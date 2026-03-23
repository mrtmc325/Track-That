import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/constants';
import type { ApiError } from '@/types/api';

// ---------------------------------------------------------------------------
// Helper: read a cookie value by name (used for CSRF token).
// ---------------------------------------------------------------------------
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send HttpOnly auth cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor: attach X-Request-ID and CSRF token.
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Unique per-request trace ID so server logs and client can correlate.
  config.headers['X-Request-ID'] = crypto.randomUUID();

  // Double-submit cookie CSRF pattern: mirror the csrf_token cookie value
  // into the X-CSRF-Token header for mutating requests.
  const csrfToken = getCookie('csrf_token');
  if (csrfToken && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor: normalise errors into a typed shape.
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response) {
      const { status, data } = error.response;

      // Surface a friendly error message for common status codes.
      if (status === 401) {
        // Redirect to login — avoid circular import by using window.location.
        window.location.href = '/login';
      }

      // Re-throw as a structured error so callers can pattern-match on `code`.
      const structured: ApiError = data ?? {
        error: { code: 'UNKNOWN', message: error.message },
        timestamp: new Date().toISOString(),
        request_id: error.config?.headers?.['X-Request-ID'] as string ?? '',
      };
      return Promise.reject(structured);
    }

    // Network error / timeout.
    const networkError: ApiError = {
      error: { code: 'NETWORK_ERROR', message: 'A network error occurred. Please check your connection.' },
      timestamp: new Date().toISOString(),
      request_id: '',
    };
    return Promise.reject(networkError);
  },
);

export default apiClient;
