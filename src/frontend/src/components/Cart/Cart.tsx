import { useEffect, useMemo, useState } from 'react';
import type { UseCartResult } from '../../hooks/useCart';
import './Cart.css';

interface CartProps {
  open: boolean;
  onClose: () => void;
  cart: Pick<UseCartResult, 'items' | 'loading' | 'error' | 'itemCount' | 'subtotal' | 'update' | 'remove' | 'clear' | 'refetch'>;
}

export function Cart({ open, onClose, cart }: CartProps) {
  const { items, loading, error, itemCount, subtotal, update, remove, clear, refetch } = cart;
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      void refetch();
    }
  }, [open, refetch]);

  const productImages = useMemo(() => new Map([
    [1, 'https://placehold.co/80x80?text=Headphones'],
    [2, 'https://placehold.co/80x80?text=Running+Shoes'],
    [3, 'https://placehold.co/80x80?text=Water+Bottle'],
    [4, 'https://placehold.co/80x80?text=Keyboard'],
    [5, 'https://placehold.co/80x80?text=Yoga+Mat'],
  ]), []);

  if (!open) {
    return null;
  }

  async function handleStep(productId: number, quantity: number) {
    try {
      await update(productId, quantity);
      setLineErrors((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update quantity.';
      setLineErrors((prev) => ({
        ...prev,
        [productId]: message,
      }));
    }
  }

  async function handleRemove(productId: number) {
    await remove(productId);
    setLineErrors((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  async function handleClear() {
    if (!window.confirm('Clear all items from your cart?')) {
      return;
    }

    await clear();
    setLineErrors({});
  }

  return (
    <div className="cart" role="dialog" aria-modal="true" aria-label="Your cart">
      <button className="cart__overlay" aria-label="Close cart" onClick={onClose} />
      <aside className="cart__panel">
        <header className="cart__header">
          <h2>Your cart</h2>
          <button className="cart__close" onClick={onClose} aria-label="Close cart">
            X
          </button>
        </header>

        {loading && <p className="cart__state">Loading cart...</p>}

        {!loading && error && (
          <div className="cart__state cart__state--error">
            <p>{error}</p>
            <button onClick={() => void refetch()} className="cart__retry">Retry</button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="cart__state">
            <p>Your cart is empty.</p>
            <button className="cart__continue" onClick={onClose}>Continue shopping</button>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <ul className="cart__list">
              {items.map((item) => (
                <li key={item.productId} className="cart__line">
                  <img
                    className="cart__thumb"
                    src={productImages.get(item.productId) ?? 'https://placehold.co/80x80?text=Product'}
                    alt={item.productName}
                    width={80}
                    height={80}
                  />
                  <div className="cart__details">
                    <p className="cart__name">{item.productName}</p>
                    <p className="cart__price">${item.unitPrice.toFixed(2)} each</p>
                    <div className="cart__controls">
                      <div className="cart__stepper" aria-label={`Quantity controls for ${item.productName}`}>
                        <button
                          onClick={() => void handleStep(item.productId, item.quantity - 1)}
                          disabled={item.quantity === 1}
                          aria-label={`Decrease quantity for ${item.productName}`}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => void handleStep(item.productId, item.quantity + 1)}
                          disabled={item.quantity === 5}
                          aria-label={`Increase quantity for ${item.productName}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="cart__remove"
                        onClick={() => void handleRemove(item.productId)}
                        aria-label={`Remove ${item.productName} from cart`}
                      >
                        X
                      </button>
                    </div>
                    {lineErrors[item.productId] && (
                      <p className="cart__line-error">{lineErrors[item.productId]}</p>
                    )}
                  </div>
                  <p className="cart__line-total">${item.totalPrice.toFixed(2)}</p>
                </li>
              ))}
            </ul>

            <footer className="cart__footer">
              <p>Total items: {itemCount}</p>
              <p>Subtotal: ${subtotal.toFixed(2)}</p>
              <button className="cart__checkout" disabled>Checkout (coming soon)</button>
              <button className="cart__clear" onClick={() => void handleClear()}>Clear cart</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
