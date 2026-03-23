// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6" role="contentinfo">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} Track-That. Find the best local deals.</p>
      </div>
    </footer>
  );
}
