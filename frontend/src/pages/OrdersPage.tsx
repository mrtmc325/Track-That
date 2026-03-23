// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import EmptyState from '../components/shared/EmptyState';

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Order History</h1>
      <EmptyState title="No orders yet" message="Your order history will appear here after your first purchase" action={{ label: 'Start Shopping', href: '/' }} />
    </div>
  );
}
