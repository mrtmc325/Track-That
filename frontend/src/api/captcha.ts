// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';

const CAPTCHA_BASE = '/captcha';

export async function getScreenshot(sessionId: string): Promise<{ screenshot: string; solved: boolean }> {
  // Captcha routes are on the vendor-adapter service, not the default API base
  // We route through nginx at /api/v1/captcha/
  const { data } = await apiClient.get(`${CAPTCHA_BASE}/${sessionId}/screenshot`);
  return data.data;
}

export async function sendClick(sessionId: string, x: number, y: number): Promise<{ screenshot: string }> {
  const { data } = await apiClient.post(`${CAPTCHA_BASE}/${sessionId}/click`, { x, y });
  return data.data;
}

export async function sendHold(sessionId: string, x: number, y: number, duration: number = 3000): Promise<{ screenshot: string }> {
  const { data } = await apiClient.post(`${CAPTCHA_BASE}/${sessionId}/hold`, { x, y, duration });
  return data.data;
}

export async function sendType(sessionId: string, text: string): Promise<{ screenshot: string }> {
  const { data } = await apiClient.post(`${CAPTCHA_BASE}/${sessionId}/type`, { text });
  return data.data;
}

export async function markDone(sessionId: string): Promise<void> {
  await apiClient.post(`${CAPTCHA_BASE}/${sessionId}/done`);
}

export async function getStatus(sessionId: string): Promise<{ solved: boolean; domain: string }> {
  const { data } = await apiClient.get(`${CAPTCHA_BASE}/${sessionId}/status`);
  return data.data;
}
