import { useParams } from 'react-router-dom';

export default function ProductPage() {
  const { productId } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Product Detail</h1>
      <p className="text-sm text-slate-500">Product ID: {productId}</p>
      <section aria-label="Price comparison">
        <h2 className="text-lg font-semibold text-slate-700">Price Comparison</h2>
        <p className="mt-2 text-sm text-slate-500">Price comparison table will be populated from the Price Engine API.</p>
      </section>
    </div>
  );
}
