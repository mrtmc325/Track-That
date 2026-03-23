// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { getOrders, getOrder } from '@/api/orders';

export function useOrders() {
  return useQuery({ queryKey: ['orders'], queryFn: getOrders });
}

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id!), enabled: !!id });
}
