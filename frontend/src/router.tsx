import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Lazy page imports — actual components are TODO; placeholders shown below.
// Replace each `() => import('./pages/...')` with the real module once created.
// ---------------------------------------------------------------------------

const HomePage = lazy(() => import('./pages/HomePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const StorePage = lazy(() => import('./pages/StorePage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ---------------------------------------------------------------------------
// Route config — exported so tests and breadcrumb helpers can inspect it.
// ---------------------------------------------------------------------------

export interface RouteConfig {
  path: string;
  label: string;
  protected?: boolean;
}

export const routeConfig: RouteConfig[] = [
  { path: '/', label: 'Home' },
  { path: '/search', label: 'Search' },
  { path: '/stores/:storeSlug', label: 'Store', protected: false },
  { path: '/products/:productId', label: 'Product' },
  { path: '/cart', label: 'Cart', protected: true },
  { path: '/checkout', label: 'Checkout', protected: true },
  { path: '/orders', label: 'Orders', protected: true },
  { path: '/orders/:orderId', label: 'Order Detail', protected: true },
  { path: '/profile', label: 'Profile', protected: true },
  { path: '/login', label: 'Login' },
  { path: '/register', label: 'Register' },
];

// ---------------------------------------------------------------------------
// Rendered route tree
// ---------------------------------------------------------------------------

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-gray-500">Loading…</div>}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/stores/:storeSlug" element={<StorePage />} />
        <Route path="/products/:productId" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
