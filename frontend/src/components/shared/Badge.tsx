// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

type Variant = 'sale' | 'coupon' | 'best-deal' | 'fresh' | 'aging' | 'stale';

const variants: Record<Variant, string> = {
  sale: 'bg-red-100 text-red-700',
  coupon: 'bg-green-100 text-green-700',
  'best-deal': 'bg-indigo-100 text-indigo-700',
  fresh: 'bg-emerald-100 text-emerald-700',
  aging: 'bg-yellow-100 text-yellow-700',
  stale: 'bg-orange-100 text-orange-700',
};

export default function Badge({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]}`}>{children}</span>;
}
