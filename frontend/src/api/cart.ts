// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';
import type { CartResponse } from '@/types/contracts';

export async function getCart() {
  const { data } = await apiClient.get<{ success: boolean; data: CartResponse }>('/cart');
  return data.data;
}

export async function addCartItem(item: {
  store_id: string; store_name: string; product_id: string; product_name: string;
  quantity: number; unit_price: number; image_url?: string;
}) {
  const { data } = await apiClient.post<{ success: boolean; data: CartResponse }>('/cart/items', item);
  return data.data;
}

export async function updateCartItem(id: string, quantity: number) {
  const { data } = await apiClient.patch<{ success: boolean; data: CartResponse }>(`/cart/items/${id}`, { quantity });
  return data.data;
}

export async function removeCartItem(id: string) {
  const { data } = await apiClient.delete<{ success: boolean; data: CartResponse }>(`/cart/items/${id}`);
  return data.data;
}
