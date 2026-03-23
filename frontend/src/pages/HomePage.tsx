import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="text-center py-12" aria-label="Hero search">
        <h1 className="text-3xl font-bold text-slate-800 sm:text-4xl">Find the Best Local Deals</h1>
        <p className="mt-2 text-lg text-slate-500">Compare prices across stores near you</p>
        <form action="/search" method="get" className="mx-auto mt-6 max-w-xl" role="search">
          <label htmlFor="hero-search" className="sr-only">Search products</label>
          <div className="flex gap-2">
            <input id="hero-search" name="q" type="search" placeholder="Search for groceries, clothing, accessories..."
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <button type="submit" className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700">Search</button>
          </div>
        </form>
      </section>

      <section aria-label="Categories">
        <h2 className="text-xl font-semibold text-slate-800">Browse Categories</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {['Grocery', 'Clothing', 'Pharmacy', 'Department', 'Specialty', 'Convenience'].map(cat => (
            <Link key={cat} to={`/search?category=${cat.toLowerCase()}`}
              className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all">
              <span className="text-2xl" aria-hidden="true">{cat === 'Grocery' ? '🛒' : cat === 'Clothing' ? '👕' : cat === 'Pharmacy' ? '💊' : cat === 'Department' ? '🏬' : cat === 'Specialty' ? '⭐' : '🏪'}</span>
              <span className="mt-2 text-sm font-medium text-slate-700">{cat}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
