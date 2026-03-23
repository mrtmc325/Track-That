import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Track-That</h1>
          <p className="mt-1 text-sm text-slate-500">Find the best local deals</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
