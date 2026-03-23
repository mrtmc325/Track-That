// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';
import type { OrderSummary } from '@/types/contracts';

export async function getOrders() {
  const { data } = await apiClient.get<{ success: boolean; data: { orders: OrderSummary[]; total: number } }>('/orders');
  return data.data;
}

export async function getOrder(id: string) {
  const { data } = await apiClient.get<{ success: boolean; data: OrderSummary }>(`/orders/${id}`);
  return data.data;
}
