import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CartItem } from '../types';
import { addToCart, clearCart, fetchCart, removeFromCart, updateCartItem } from '../api';

export interface UseCartResult {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  itemCount: number;
  subtotal: number;
  add: (productId: number, quantity?: number) => Promise<void>;
  update: (productId: number, quantity: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  clear: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useCart(): UseCartResult {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const nextItems = await fetchCart();
    setItems(nextItems);
    setError(null);
  }, []);

  useEffect(() => {
    refetch()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refetch]);

  const add = useCallback(async (productId: number, quantity = 1) => {
    try {
      await addToCart({ productId, quantity });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [refetch]);

  const update = useCallback(async (productId: number, quantity: number) => {
    try {
      await updateCartItem(productId, { quantity });
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [refetch]);

  const remove = useCallback(async (productId: number) => {
    try {
      await removeFromCart(productId);
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [refetch]);

  const clear = useCallback(async () => {
    try {
      await clearCart();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  }, [refetch]);

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPrice, 0),
    [items],
  );

  return {
    items,
    loading,
    error,
    itemCount,
    subtotal,
    add,
    update,
    remove,
    clear,
    refetch,
  };
}
