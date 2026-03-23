// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useSearchParams, Link } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch';
import { useGeoStore } from '../stores/geoStore';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import EmptyState from '../components/shared/EmptyState';
import Badge from '../components/shared/Badge';

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('category') || undefined;
  const page = parseInt(params.get('page') || '1', 10);
  const { lat, lng, radius } = useGeoStore();

  const { data, isLoading, error } = useSearch({
    q: query,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
    radius,
    category,
    page,
  });

  if (!query && !category) {
    return <EmptyState title="Start searching" message="Enter a product name to find the best deals near you" action={{ label: 'Go Home', href: '/' }} />;
  }

  if (isLoading) return <LoadingSpinner size="lg" />;

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center">
        <p className="text-red-600">Search failed. Please try again.</p>
      </div>
    );
  }

  const results = data?.results || [];
  const similar = data?.similar_items || [];
  const total = data?.total_results || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">
          {query ? <>Results for &ldquo;{query}&rdquo;</> : `${category} products`}
        </h1>
        <span className="text-sm text-slate-500">{total} result{total !== 1 ? 's' : ''}{data?.search_metadata?.fuzzy_applied ? ' (fuzzy match)' : ''}</span>
      </div>

      {results.length === 0 && similar.length === 0 ? (
        <EmptyState title="No results found" message="Try a different search term or broaden your radius" action={{ label: 'Go Home', href: '/' }} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Search results">
            {results.map((r) => (
              <Link key={r.product.id} to={`/products/${r.product.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow" role="listitem">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">{r.product.name}</h3>
                    <p className="text-sm text-slate-500">{r.product.brand}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {r.best_price.on_sale && <Badge variant="sale">Sale</Badge>}
                    {r.best_price.coupon_available && <Badge variant="coupon">Coupon</Badge>}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <span className="text-2xl font-bold text-indigo-600">${r.best_price.price.toFixed(2)}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{r.best_price.store_name} · {r.best_price.distance_miles.toFixed(1)} mi</p>
                  </div>
                  <span className="text-xs text-slate-400">{r.listings.length} store{r.listings.length !== 1 ? 's' : ''}</span>
                </div>
              </Link>
            ))}
          </div>

          {similar.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-700 mb-3">Similar Items</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {similar.map((s) => (
                  <Link key={s.product.id} to={`/products/${s.product.id}`}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:shadow-sm transition-shadow">
                    <p className="font-medium text-slate-700 truncate">{s.product.name}</p>
                    <p className="text-indigo-600 font-semibold">${s.best_price.price.toFixed(2)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {data?.search_metadata && (
        <p className="text-xs text-slate-400 text-right">Query: &ldquo;{data.search_metadata.normalized_query}&rdquo; · {data.search_metadata.response_time_ms}ms</p>
      )}
    </div>
  );
}
