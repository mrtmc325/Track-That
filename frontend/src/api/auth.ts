// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import apiClient from './client';

interface User {
  id: string;
  email: string;
  display_name: string;
  search_radius_miles: number;
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<{ success: boolean; data: { user: User } }>('/auth/login', { email, password });
  return data.data;
}

export async function register(email: string, password: string, display_name: string) {
  const { data } = await apiClient.post<{ success: boolean; data: { user: User } }>('/auth/register', { email, password, display_name });
  return data.data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}

export async function getProfile() {
  const { data } = await apiClient.get<{ success: boolean; data: User }>('/users/me');
  return data.data;
}

export async function updateProfile(updates: Partial<User>) {
  const { data } = await apiClient.patch<{ success: boolean; data: User }>('/users/me', updates);
  return data.data;
}
