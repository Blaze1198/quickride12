import { create } from 'zustand';

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  restaurantId: string | null;
  restaurantName: string | null;
  addItem: (item: CartItem, restaurantId: string, restaurantName: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalAmount: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  restaurantId: null,
  restaurantName: null,
  addItem: (item, restaurantId, restaurantName) => {
    const state = get();
    
    // If different restaurant, clear cart
    if (state.restaurantId && state.restaurantId !== restaurantId) {
      set({
        items: [item],
        restaurantId,
        restaurantName,
      });
      return;
    }
    
    const existingItem = state.items.find((i) => i.menu_item_id === item.menu_item_id);
    
    if (existingItem) {
      set({
        items: state.items.map((i) =>
          i.menu_item_id === item.menu_item_id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        ),
      });
    } else {
      set({
        items: [...state.items, item],
        restaurantId,
        restaurantName,
      });
    }
  },
  removeItem: (menuItemId) =>
    set((state) => ({
      items: state.items.filter((i) => i.menu_item_id !== menuItemId),
    })),
  updateQuantity: (menuItemId, quantity) =>
    set((state) => ({
      items:
        quantity > 0
          ? state.items.map((i) =>
              i.menu_item_id === menuItemId ? { ...i, quantity } : i
            )
          : state.items.filter((i) => i.menu_item_id !== menuItemId),
    })),
  clearCart: () => set({ items: [], restaurantId: null, restaurantName: null }),
  getTotalAmount: () => {
    const state = get();
    return state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
  getItemCount: () => {
    const state = get();
    return state.items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
