// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useParams } from 'react-router-dom';
import { useProduct } from '../hooks/useSearch';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function ProductPage() {
  const { productId } = useParams();
  const { data: product, isLoading, error } = useProduct(productId);

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (error || !product) return <div className="text-center py-12 text-slate-500">Product not found</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{product.canonical_name}</h1>
      <p className="text-slate-500">{product.brand} · {product.category}</p>
      <p className="text-sm text-slate-600">{product.description}</p>

      {product.store_listings && product.store_listings.length > 0 && (
        <section aria-label="Price comparison">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Available At</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Store</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Price</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.store_listings.map((sl: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{sl.store_name}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-indigo-600">${sl.current_price.toFixed(2)}</span>
                      {sl.on_sale && <span className="ml-1 text-xs text-red-500">Sale</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{sl.store_rating?.toFixed(1) || '—'} ★</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
