// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { useAuthStore } from '../stores/authStore';

export default function ProfilePage() {
  const { user } = useAuthStore();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <dl className="space-y-3">
          <div><dt className="text-sm font-medium text-slate-500">Name</dt><dd className="text-slate-800">{user?.display_name || 'Guest'}</dd></div>
          <div><dt className="text-sm font-medium text-slate-500">Email</dt><dd className="text-slate-800">{user?.email || '—'}</dd></div>
          <div><dt className="text-sm font-medium text-slate-500">Search Radius</dt><dd className="text-slate-800">{user?.search_radius_miles || 25} miles</dd></div>
        </dl>
      </div>
    </div>
  );
}
