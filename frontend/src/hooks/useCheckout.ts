// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { initiateCheckout, setFulfillment, processPayment, completeCheckout } from '@/api/checkout';

export function useInitiateCheckout() {
  return useMutation({ mutationFn: initiateCheckout });
}

export function useSetFulfillment() {
  return useMutation({ mutationFn: setFulfillment });
}

export function useProcessPayment() {
  return useMutation({ mutationFn: processPayment });
}

export function useCompleteCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payment_intent_id: string) => completeCheckout(payment_intent_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
