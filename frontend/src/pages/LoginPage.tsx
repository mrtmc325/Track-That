// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      // TODO: Replace with real API call
      setUser({ id: '1', email, display_name: email.split('@')[0], search_radius_miles: 25 });
      navigate('/');
    } catch { setError('Invalid email or password'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
      <h2 className="text-xl font-semibold text-slate-800">Sign In</h2>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</div>}
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">Email</label>
        <input id="login-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
        <input id="login-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
      </div>
      <button type="submit" className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Sign In</button>
      <p className="text-center text-sm text-slate-500">
        No account? <Link to="/register" className="text-indigo-600 hover:underline">Register</Link>
        {' · '}
        <Link to="/forgot-password" className="text-indigo-600 hover:underline">Forgot password?</Link>
      </p>
    </form>
  );
}
