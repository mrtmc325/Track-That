// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCart, addCartItem, updateCartItem, removeCartItem } from '@/api/cart';
import { useAuthStore } from '@/stores/authStore';

export function useCart() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['cart'],
    queryFn: getCart,
    enabled: isAuthenticated,
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addCartItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); },
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => updateCartItem(id, quantity),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); },
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeCartItem(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cart'] }); },
  });
}
