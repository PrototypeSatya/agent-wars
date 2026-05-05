import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/frontend/src/App';
import type { Product } from '../../src/frontend/src/types';

const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Test Headphones',
    description: 'Great sound quality.',
    price: 79.99,
    category: 'Electronics',
    stock: 10,
    imageUrl: 'https://example.com/headphones.jpg',
  },
];

vi.mock('../../src/frontend/src/hooks/useProducts');
vi.mock('../../src/frontend/src/hooks/useCart');

import { useProducts } from '../../src/frontend/src/hooks/useProducts';
import { CartApiError } from '../../src/frontend/src/api';
import { useCart } from '../../src/frontend/src/hooks/useCart';

const mockedUseProducts = vi.mocked(useProducts);
const mockedUseCart = vi.mocked(useCart);

const add = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const clear = vi.fn();
const refetch = vi.fn();

describe('App', () => {
  beforeEach(() => {
    add.mockReset();
    update.mockReset();
    remove.mockReset();
    clear.mockReset();
    refetch.mockReset();

    mockedUseCart.mockReturnValue({
      items: [],
      loading: false,
      error: null,
      itemCount: 0,
      subtotal: 0,
      add,
      update,
      remove,
      clear,
      refetch,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the header with shop name', () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: false, error: null });

    render(<App />);

    expect(screen.getByText('Mock Shop')).toBeInTheDocument();
  });

  it('renders the hero banner', () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: false, error: null });

    render(<App />);

    expect(screen.getByText(/discover quality products/i)).toBeInTheDocument();
  });

  it('renders the products section heading', () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: false, error: null });

    render(<App />);

    expect(screen.getByRole('heading', { name: /our products/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: true, error: null });

    render(<App />);

    expect(screen.getByText(/loading products/i)).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: false, error: 'Network error' });

    render(<App />);

    expect(screen.getByText(/error: network error/i)).toBeInTheDocument();
  });

  it('renders product list when loaded', () => {
    mockedUseProducts.mockReturnValue({ products: mockProducts, loading: false, error: null });

    render(<App />);

    expect(screen.getByText('Test Headphones')).toBeInTheDocument();
  });

  it('shows notification after adding to cart', async () => {
    mockedUseProducts.mockReturnValue({ products: mockProducts, loading: false, error: null });
    add.mockResolvedValue(undefined);

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /add test headphones to cart/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('"Test Headphones" added to cart!');
  });

  it('shows error notification when add to cart fails', async () => {
    mockedUseProducts.mockReturnValue({ products: mockProducts, loading: false, error: null });
    add.mockRejectedValue(new Error('Server error'));

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /add test headphones to cart/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Failed to add item to cart.');
  });

  it('shows API error message when cart add exceeds limit', async () => {
    mockedUseProducts.mockReturnValue({ products: mockProducts, loading: false, error: null });
    add.mockRejectedValue(new CartApiError(400, 'Cannot exceed maximum quantity of 5 per product.'));

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /add test headphones to cart/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Cannot exceed maximum quantity of 5 per product.');
  });

  it('opens cart drawer from header button', async () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: false, error: null });

    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /shopping cart with 0 items/i }));

    expect(screen.getByRole('dialog', { name: /your cart/i })).toBeInTheDocument();
  });

  it('uses cart hook item count for header badge', () => {
    mockedUseProducts.mockReturnValue({ products: [], loading: false, error: null });
    mockedUseCart.mockReturnValue({
      items: [],
      loading: false,
      error: null,
      itemCount: 4,
      subtotal: 100,
      add,
      update,
      remove,
      clear,
      refetch,
    });

    render(<App />);

    expect(screen.getByRole('button', { name: /shopping cart with 4 items/i })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
