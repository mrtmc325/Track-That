// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { useGeoStore } from '../../stores/geoStore';

export default function TopNav() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { itemCount } = useCartStore();
  const { zipCode, radius } = useGeoStore();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm" role="navigation" aria-label="Main navigation">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="text-xl font-bold text-indigo-600" aria-label="Track-That Home">Track-That</Link>

        <form className="hidden flex-1 max-w-lg mx-8 sm:flex" action="/search" method="get" role="search">
          <label htmlFor="nav-search" className="sr-only">Search products</label>
          <input id="nav-search" name="q" type="search" placeholder="Search for products..."
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </form>

        <div className="flex items-center gap-4">
          {zipCode && (
            <span className="hidden sm:inline text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              📍 {zipCode} · {radius} mi
            </span>
          )}
          <Link to="/cart" className="relative" aria-label={`Cart with ${itemCount} items`}>
            <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{itemCount}</span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="text-sm text-slate-600 hover:text-indigo-600">{user?.display_name}</Link>
              <button onClick={() => { logout(); navigate('/login'); }} className="text-sm text-slate-500 hover:text-red-600" aria-label="Log out">Logout</button>
            </div>
          ) : (
            <Link to="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
