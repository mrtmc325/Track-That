// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';

export async function getNearbyStores(params: { lat: number; lng: number; radius?: number; type?: string }) {
  const { data } = await apiClient.get<{ success: boolean; data: { stores: any[]; total: number } }>('/geo/stores', { params });
  return data.data;
}

export async function getDistance(params: { from_lat: number; from_lng: number; store_id: string }) {
  const { data } = await apiClient.get<{ success: boolean; data: any }>('/geo/distance', { params });
  return data.data;
}
