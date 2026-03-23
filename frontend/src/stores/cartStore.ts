import { create } from 'zustand';

interface CartItem {
  id: string;
  store_id: string;
  store_name: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  image_url: string;
}

interface CartState {
  items: CartItem[];
  itemCount: number;
  total: number;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  itemCount: 0,
  total: 0,
  addItem: (item) => set((state) => {
    const items = [...state.items, item];
    return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), total: items.reduce((s, i) => s + i.unit_price * i.quantity, 0) };
  }),
  removeItem: (id) => set((state) => {
    const items = state.items.filter(i => i.id !== id);
    return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), total: items.reduce((s, i) => s + i.unit_price * i.quantity, 0) };
  }),
  updateQuantity: (id, qty) => set((state) => {
    const items = state.items.map(i => i.id === id ? { ...i, quantity: qty } : i);
    return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), total: items.reduce((s, i) => s + i.unit_price * i.quantity, 0) };
  }),
  clearCart: () => set({ items: [], itemCount: 0, total: 0 }),
}));
