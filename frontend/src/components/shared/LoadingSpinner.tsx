// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex items-center justify-center p-4" role="status" aria-label="Loading">
      <div className={`${sizes[size]} animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600`} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
