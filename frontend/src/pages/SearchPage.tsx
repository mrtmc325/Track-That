import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/shared/EmptyState';

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') || '';

  if (!query) {
    return <EmptyState title="Start searching" message="Enter a product name to find the best deals near you" action={{ label: 'Go Home', href: '/' }} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-800">Results for &ldquo;{query}&rdquo;</h1>
      <p className="text-sm text-slate-500">Comparing prices across local stores...</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Search results">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" role="listitem">
          <p className="text-slate-500 text-sm">Search results will appear here once connected to the Search API.</p>
        </div>
      </div>
    </div>
  );
}
