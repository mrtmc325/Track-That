// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { useParams } from 'react-router-dom';

export default function StorePage() {
  const { storeSlug } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Store: {storeSlug}</h1>
      <p className="text-sm text-slate-500">Store details and product listings will appear here.</p>
    </div>
  );
}
