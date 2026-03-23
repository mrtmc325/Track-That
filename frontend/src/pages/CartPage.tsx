// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Link } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import EmptyState from '../components/shared/EmptyState';

export default function CartPage() {
  const { items, total, itemCount, removeItem } = useCartStore();

  if (itemCount === 0) {
    return <EmptyState title="Your cart is empty" message="Add items from search results to get started" action={{ label: 'Start Shopping', href: '/' }} />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Your Cart ({itemCount} items)</h1>
      <div className="space-y-4" role="list" aria-label="Cart items">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4" role="listitem">
            <div>
              <p className="font-medium text-slate-800">{item.product_name}</p>
              <p className="text-sm text-slate-500">{item.store_name} &middot; Qty: {item.quantity}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-800">${(item.unit_price * item.quantity).toFixed(2)}</span>
              <button onClick={() => removeItem(item.id)} className="text-sm text-red-600 hover:underline" aria-label={`Remove ${item.product_name}`}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm">
        <span className="text-lg font-semibold text-slate-800">Total: ${total.toFixed(2)}</span>
        <Link to="/checkout" className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700">Checkout</Link>
      </div>
    </div>
  );
}
