using MockEcommerce.Api.Models;

namespace MockEcommerce.Api.Services;

/// <summary>
/// Thread-safe in-memory cart storage. Registered as Singleton for demo purposes;
/// all users share a single cart. Replace with a per-user scoped implementation
/// when authentication is added.
/// </summary>
public class InMemoryCartService : ICartService
{
    private readonly List<CartItem> _cart = [];
    private readonly Lock _lock = new();

    /// <inheritdoc />
    public IEnumerable<CartItem> GetAll()
    {
        lock (_lock)
        {
            return _cart.ToList();
        }
    }

    /// <inheritdoc />
    public CartItem? GetByProductId(int productId)
    {
        lock (_lock)
        {
            return _cart.FirstOrDefault(item => item.ProductId == productId);
        }
    }

    /// <inheritdoc />
    public CartItem Add(CartItem item)
    {
        lock (_lock)
        {
            var existing = _cart.FirstOrDefault(cartItem => cartItem.ProductId == item.ProductId);
            if (existing is not null)
            {
                existing.Quantity += item.Quantity;
                return existing;
            }

            _cart.Add(item);
            return item;
        }
    }

    /// <inheritdoc />
    public bool Remove(int productId)
    {
        lock (_lock)
        {
            var existing = _cart.FirstOrDefault(item => item.ProductId == productId);
            if (existing is null)
            {
                return false;
            }

            _cart.Remove(existing);
            return true;
        }
    }

    /// <inheritdoc />
    public CartItem? SetQuantity(int productId, int quantity)
    {
        lock (_lock)
        {
            var existing = _cart.FirstOrDefault(item => item.ProductId == productId);
            if (existing is null)
            {
                return null;
            }

            existing.Quantity = quantity;
            return existing;
        }
    }

    /// <inheritdoc />
    public void Clear()
    {
        lock (_lock)
        {
            _cart.Clear();
        }
    }
}
