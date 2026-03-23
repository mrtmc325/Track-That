export default function CheckoutPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Checkout</h1>
      <p className="text-sm text-slate-500">Review your order and complete payment.</p>
      <section className="rounded-lg border border-slate-200 bg-white p-6" aria-label="Payment form">
        <h2 className="text-lg font-semibold text-slate-700">Payment</h2>
        <p className="mt-2 text-sm text-slate-500">Stripe Elements payment form will be rendered here. Card data never touches our servers (PCI SAQ-A).</p>
      </section>
    </div>
  );
}
