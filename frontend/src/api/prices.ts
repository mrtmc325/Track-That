// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';

export async function comparePrices(params: { product_id: string; lat?: number; lng?: number; radius?: number }) {
  const { data } = await apiClient.get<{ success: boolean; data: any }>('/prices/compare', { params });
  return data.data;
}

export async function getBestDeals(params?: { category?: string; lat?: number; lng?: number; limit?: number }) {
  const { data } = await apiClient.get<{ success: boolean; data: { deals: any[]; total: number } }>('/prices/best-deals', { params });
  return data.data;
}
