// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { useParams } from 'react-router-dom';

export default function OrderDetailPage() {
  const { orderId } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Order #{orderId?.substring(0, 8)}</h1>
      <p className="text-sm text-slate-500">Order details and delivery tracking will appear here.</p>
    </div>
  );
}
