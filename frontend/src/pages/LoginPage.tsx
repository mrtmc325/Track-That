// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
      <h2 className="text-xl font-semibold text-slate-800">Sign In</h2>
      {loginMutation.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
          Invalid email or password
        </div>
      )}
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
      <button type="submit" disabled={loginMutation.isPending}
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
        {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
      </button>
      <p className="text-center text-sm text-slate-500">
        No account? <Link to="/register" className="text-indigo-600 hover:underline">Register</Link>
      </p>
    </form>
  );
}
