// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useQuery } from '@tanstack/react-query';
import { searchProducts, suggestProducts, getProduct, getCategories, type SearchParams } from '@/api/search';

export function useSearch(params: SearchParams) {
  return useQuery({
    queryKey: ['search', params],
    queryFn: () => searchProducts(params),
    enabled: (!!params.q && params.q.length >= 2) || (!!params.category && params.category.length > 0),
    // Crawl can take up to 55s — don't timeout on the client side
    staleTime: 2 * 60 * 1000,  // Cache results for 2 minutes
    retry: 1,
    retryDelay: 2000,
  });
}

export function useSuggest(q: string) {
  return useQuery({
    queryKey: ['suggest', q],
    queryFn: () => suggestProducts(q),
    enabled: q.length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id!),
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 30 * 60 * 1000,
  });
}
