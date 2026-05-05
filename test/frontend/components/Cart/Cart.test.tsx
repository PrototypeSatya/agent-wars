import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Cart } from '../../../../src/frontend/src/components/Cart';
import type { CartItem } from '../../../../src/frontend/src/types';
import type { UseCartResult } from '../../../../src/frontend/src/hooks/useCart';
const update = vi.fn();
const remove = vi.fn();
const clear = vi.fn();
const refetch = vi.fn();

const lineItems: CartItem[] = [
  {
    productId: 1,
    productName: 'Wireless Headphones',
    unitPrice: 79.99,
    quantity: 5,
    totalPrice: 399.95,
  },
  {
    productId: 2,
    productName: 'Running Shoes',
    unitPrice: 59.99,
    quantity: 1,
    totalPrice: 59.99,
  },
];

function buildCart(overrides?: Partial<UseCartResult>): UseCartResult {
  return {
    items: lineItems,
    loading: false,
    error: null,
    itemCount: 6,
    subtotal: 459.94,
    add: vi.fn(),
    update,
    remove,
    clear,
    refetch,
    ...overrides,
  };
}

describe('Cart', () => {
  beforeEach(() => {
    update.mockReset();
    remove.mockReset();
    clear.mockReset();
    refetch.mockReset();
  });

  it('renders empty state', () => {
    render(<Cart open onClose={vi.fn()} cart={buildCart({ items: [], itemCount: 0, subtotal: 0 })} />);

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it('renders lines and totals', () => {
    render(<Cart open onClose={vi.fn()} cart={buildCart()} />);

    expect(screen.getByText('Wireless Headphones')).toBeInTheDocument();
    expect(screen.getByText('Running Shoes')).toBeInTheDocument();
    expect(screen.getByText('Subtotal: $459.94')).toBeInTheDocument();
  });

  it('disables plus at max quantity and minus at one', () => {
    render(<Cart open onClose={vi.fn()} cart={buildCart()} />);

    const plus = screen.getByRole('button', { name: /increase quantity for wireless headphones/i });
    const minus = screen.getByRole('button', { name: /decrease quantity for running shoes/i });

    expect(plus).toBeDisabled();
    expect(minus).toBeDisabled();
  });

  it('clicking plus sends update with incremented quantity', async () => {
    const user = userEvent.setup();
    render(<Cart open onClose={vi.fn()} cart={buildCart({
      items: [{ ...lineItems[0], quantity: 4, totalPrice: 319.96 }],
      itemCount: 4,
      subtotal: 319.96,
    })} />);
    await user.click(screen.getByRole('button', { name: /increase quantity for wireless headphones/i }));

    expect(update).toHaveBeenCalledWith(1, 5);
  });

  it('clicking remove calls delete action', async () => {
    const user = userEvent.setup();

    render(<Cart open onClose={vi.fn()} cart={buildCart()} />);
    await user.click(screen.getByRole('button', { name: /remove running shoes from cart/i }));

    expect(remove).toHaveBeenCalledWith(2);
  });

  it('shows inline error when update fails', async () => {
    const user = userEvent.setup();
    update.mockRejectedValue(new Error('Cannot exceed maximum quantity of 5 per product.'));
    render(<Cart open onClose={vi.fn()} cart={buildCart({
      items: [{ ...lineItems[0], quantity: 4, totalPrice: 319.96 }],
      itemCount: 4,
      subtotal: 319.96,
    })} />);
    await user.click(screen.getByRole('button', { name: /increase quantity for wireless headphones/i }));

    expect(await screen.findByText('Cannot exceed maximum quantity of 5 per product.')).toBeInTheDocument();
  });
});
