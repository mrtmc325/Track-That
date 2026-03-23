// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';
import type { SearchResponse, SuggestResponse } from '@/types/contracts';

export interface SearchParams {
  q: string;
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string;
  page?: number;
  page_size?: number;
}

export async function searchProducts(params: SearchParams) {
  const { data } = await apiClient.get<{ success: boolean; data: SearchResponse }>('/search', { params });
  return data.data;
}

export async function suggestProducts(q: string) {
  const { data } = await apiClient.get<{ success: boolean; data: SuggestResponse }>('/search/suggest', { params: { q } });
  return data.data;
}

export async function getProduct(id: string) {
  const { data } = await apiClient.get<{ success: boolean; data: any }>(`/products/${id}`);
  return data.data;
}

export async function getCategories() {
  const { data } = await apiClient.get<{ success: boolean; data: { categories: { name: string; count: number }[] } }>('/categories');
  return data.data.categories;
}
