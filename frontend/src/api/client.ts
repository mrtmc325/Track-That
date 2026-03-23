// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

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
  timeout: 60000, // 60s — crawl searches can take up to 55s
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor: attach X-Request-ID and CSRF token.
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers['X-Request-ID'] = crypto.randomUUID();

  const csrfToken = getCookie('csrf_token');
  if (csrfToken && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  return config;
});

// ---------------------------------------------------------------------------
// URLs that should NOT trigger a redirect to /login on 401.
// These are expected to return 401 when the user is not authenticated.
// ---------------------------------------------------------------------------
const AUTH_EXEMPT_URLS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/users/me',
];

// ---------------------------------------------------------------------------
// Response interceptor: normalise errors into a typed shape.
// Do NOT blindly redirect on 401 — only redirect for protected API calls
// that require authentication and the user is clearly not logged in.
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response) {
      const { status, data } = error.response;
      const requestUrl = error.config?.url || '';

      if (status === 401) {
        // Check if this is an auth-exempt URL (login, register, profile check, etc.)
        const isAuthExempt = AUTH_EXEMPT_URLS.some(url => requestUrl.includes(url));
        const isAlreadyOnLogin = window.location.pathname === '/login' || window.location.pathname === '/register';

        // Only redirect to login if:
        // 1. Not an auth-exempt URL (e.g., not /users/me profile check)
        // 2. Not already on the login/register page
        // 3. Not a search or public endpoint
        if (!isAuthExempt && !isAlreadyOnLogin && !requestUrl.includes('/search') && !requestUrl.includes('/geo/')) {
          window.location.href = '/login';
        }
      }

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
