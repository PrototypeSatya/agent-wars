import type { Product, AddToCartRequest, CartItem, UpdateCartItemRequest } from '../types';

const BASE_URL = '/api';

export class CartApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'CartApiError';
  }
}

async function buildApiError(response: Response, fallbackMessage: string): Promise<CartApiError> {
  let message = fallbackMessage;

  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = await response.json() as {
        detail?: string;
        title?: string;
        errors?: Record<string, string[]>;
      };
      const firstError = body.errors
        ? Object.values(body.errors).flat().find(Boolean)
        : null;
      message = firstError ?? body.detail ?? body.title ?? fallbackMessage;
    } else {
      const text = await response.text();
      if (text.trim()) {
        message = text;
      }
    }
  } catch {
    message = fallbackMessage;
  }

  return new CartApiError(response.status, message);
}

export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(`${BASE_URL}/products`);
  if (!response.ok) throw new Error('Failed to fetch products');
  return response.json();
}

export async function fetchProductById(id: number): Promise<Product> {
  const response = await fetch(`${BASE_URL}/products/${id}`);
  if (!response.ok) throw new Error(`Failed to fetch product ${id}`);
  return response.json();
}

export async function addToCart(request: AddToCartRequest): Promise<CartItem> {
  const response = await fetch(`${BASE_URL}/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to add item to cart');
  }
  return response.json();
}

export async function fetchCart(): Promise<CartItem[]> {
  const response = await fetch(`${BASE_URL}/cart`);
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to fetch cart');
  }

  return response.json();
}

export async function updateCartItem(productId: number, request: UpdateCartItemRequest): Promise<CartItem> {
  const response = await fetch(`${BASE_URL}/cart/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to update cart item');
  }

  return response.json();
}

export async function removeFromCart(productId: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/cart/${productId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to remove cart item');
  }
}

export async function clearCart(): Promise<void> {
  const response = await fetch(`${BASE_URL}/cart`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw await buildApiError(response, 'Failed to clear cart');
  }
}

