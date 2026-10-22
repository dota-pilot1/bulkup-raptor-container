import { create } from "zustand";

export type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  visual?: string;
  category?: string;
};

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
};

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((value) => value.productId === item.productId);
      if (existing) {
        return {
          items: state.items.map((value) =>
            value.productId === item.productId
              ? { ...value, quantity: value.quantity + item.quantity }
              : value
          ),
        };
      }
      return { items: [...state.items, item] };
    }),
  updateQuantity: (productId, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((item) => item.productId !== productId) };
      }
      return {
        items: state.items.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        ),
      };
    }),
  removeItem: (productId) =>
    set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
  clear: () => set({ items: [] }),
}));
