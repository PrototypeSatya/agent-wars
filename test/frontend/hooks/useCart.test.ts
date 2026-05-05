import { act, renderHook, waitFor } from '@testing-library/react';
import { useCart } from '../../../src/frontend/src/hooks/useCart';
import type { CartItem } from '../../../src/frontend/src/types';

vi.mock('../../../src/frontend/src/api', () => ({
  addToCart: vi.fn(),
  fetchCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
}));

import { addToCart, clearCart, fetchCart, removeFromCart, updateCartItem } from '../../../src/frontend/src/api';

const mockedAddToCart = vi.mocked(addToCart);
const mockedFetchCart = vi.mocked(fetchCart);
const mockedUpdateCartItem = vi.mocked(updateCartItem);
const mockedRemoveFromCart = vi.mocked(removeFromCart);
const mockedClearCart = vi.mocked(clearCart);

const sampleItems: CartItem[] = [
  {
    productId: 1,
    productName: 'Wireless Headphones',
    unitPrice: 79.99,
    quantity: 2,
    totalPrice: 159.98,
  },
];

describe('useCart', () => {
  beforeEach(() => {
    mockedFetchCart.mockResolvedValue(sampleItems);
    mockedAddToCart.mockResolvedValue(sampleItems[0]);
    mockedUpdateCartItem.mockResolvedValue(sampleItems[0]);
    mockedRemoveFromCart.mockResolvedValue(undefined);
    mockedClearCart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads cart items on mount', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.items).toEqual(sampleItems);
    expect(result.current.itemCount).toBe(2);
    expect(result.current.subtotal).toBeCloseTo(159.98);
  });

  it('add posts then refetches cart', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedFetchCart.mockResolvedValueOnce([...sampleItems, {
      productId: 2,
      productName: 'Running Shoes',
      unitPrice: 59.99,
      quantity: 1,
      totalPrice: 59.99,
    }]);

    await act(async () => {
      await result.current.add(2, 1);
    });

    expect(mockedAddToCart).toHaveBeenCalledWith({ productId: 2, quantity: 1 });
    await waitFor(() => {
      expect(result.current.itemCount).toBe(3);
    });
  });

  it('update sends put payload and refetches', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedFetchCart.mockResolvedValueOnce([
      {
        ...sampleItems[0],
        quantity: 5,
        totalPrice: 399.95,
      },
    ]);

    await act(async () => {
      await result.current.update(1, 5);
    });

    expect(mockedUpdateCartItem).toHaveBeenCalledWith(1, { quantity: 5 });
    await waitFor(() => {
      expect(result.current.items[0].quantity).toBe(5);
    });
  });

  it('exposes mutation error in state', async () => {
    mockedAddToCart.mockRejectedValue(new Error('Cannot exceed maximum quantity of 5 per product.'));
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await expect(result.current.add(1, 5)).rejects.toThrow('Cannot exceed maximum quantity of 5 per product.');
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Cannot exceed maximum quantity of 5 per product.');
    });
  });

  it('remove and clear call delete endpoints', async () => {
    const { result } = renderHook(() => useCart());

    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedFetchCart.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.remove(1);
    });
    expect(mockedRemoveFromCart).toHaveBeenCalledWith(1);

    mockedFetchCart.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.clear();
    });
    expect(mockedClearCart).toHaveBeenCalled();
  });
});
