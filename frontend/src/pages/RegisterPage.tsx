// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../hooks/useAuth';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', display_name: '' });
  const registerMutation = useRegister();
  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <form onSubmit={e => { e.preventDefault(); registerMutation.mutate(form); }} className="space-y-4" aria-label="Registration form">
      <h2 className="text-xl font-semibold text-slate-800">Create Account</h2>
      {registerMutation.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">Registration failed. Try a different email.</div>
      )}
      <div>
        <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700">Display Name</label>
        <input id="reg-name" type="text" required value={form.display_name} onChange={e => update('display_name', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>
      <div>
        <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700">Email</label>
        <input id="reg-email" type="email" required value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
      </div>
      <div>
        <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700">Password</label>
        <input id="reg-password" type="password" required minLength={8} value={form.password} onChange={e => update('password', e.target.value)} autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
        <p className="mt-1 text-xs text-slate-400">Min 8 chars, 1 uppercase, 1 number</p>
      </div>
      <button type="submit" disabled={registerMutation.isPending}
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {registerMutation.isPending ? 'Creating...' : 'Create Account'}
      </button>
      <p className="text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link></p>
    </form>
  );
}
