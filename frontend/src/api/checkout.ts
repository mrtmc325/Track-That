// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';

export async function initiateCheckout() {
  const { data } = await apiClient.post<{ success: boolean; data: any }>('/checkout/initiate');
  return data.data;
}

export async function setFulfillment(params: { store_id: string; fulfillment: 'pickup' | 'delivery'; delivery_fee?: number }) {
  const { data } = await apiClient.post<{ success: boolean; data: any }>('/checkout/fulfillment', params);
  return data.data;
}

export async function processPayment() {
  const { data } = await apiClient.post<{ success: boolean; data: any }>('/checkout/pay');
  return data.data;
}

export async function completeCheckout(payment_intent_id: string) {
  const { data } = await apiClient.post<{ success: boolean; data: any }>('/checkout/complete', { payment_intent_id });
  return data.data;
}
