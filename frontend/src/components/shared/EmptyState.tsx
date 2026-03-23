// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

export default function EmptyState({ title, message, action }: { title: string; message: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-4xl">🔍</div>
      <h3 className="text-lg font-medium text-slate-700">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
      {action && <a href={action.href} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">{action.label}</a>}
    </div>
  );
}
