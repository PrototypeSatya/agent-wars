using MockEcommerce.Api.Models;
using MockEcommerce.Api.Services;

namespace MockEcommerce.Api.Tests.Services;

public class InMemoryCartServiceTests
{
    private readonly InMemoryCartService _service = new();

    [Fact]
    public void Add_NewProduct_AppendsLine()
    {
        var item = new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 2 };

        var added = _service.Add(item);

        Assert.Equal(1, added.ProductId);
        Assert.Equal(2, added.Quantity);
        Assert.Single(_service.GetAll());
    }

    [Fact]
    public void Add_ExistingProduct_IncrementsQuantity()
    {
        _service.Add(new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 2 });

        var updated = _service.Add(new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 3 });

        Assert.Equal(5, updated.Quantity);
        Assert.Single(_service.GetAll());
    }

    [Fact]
    public void SetQuantity_ExistingItem_UpdatesQuantity()
    {
        _service.Add(new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 2 });

        var updated = _service.SetQuantity(1, 4);

        Assert.NotNull(updated);
        Assert.Equal(4, updated.Quantity);
    }

    [Fact]
    public void SetQuantity_MissingItem_ReturnsNull()
    {
        var updated = _service.SetQuantity(999, 2);

        Assert.Null(updated);
    }

    [Fact]
    public void Remove_ExistingItem_ReturnsTrue()
    {
        _service.Add(new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 2 });

        var removed = _service.Remove(1);

        Assert.True(removed);
        Assert.Empty(_service.GetAll());
    }

    [Fact]
    public void Remove_MissingItem_ReturnsFalse()
    {
        var removed = _service.Remove(1);

        Assert.False(removed);
    }

    [Fact]
    public void Clear_EmptiesCart_AndIsIdempotent()
    {
        _service.Add(new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 2 });

        _service.Clear();
        _service.Clear();

        Assert.Empty(_service.GetAll());
    }

    [Fact]
    public void GetAll_ReturnsSnapshot_NotLiveReference()
    {
        _service.Add(new CartItem { ProductId = 1, ProductName = "Product", UnitPrice = 10m, Quantity = 2 });

        var snapshot = _service.GetAll().ToList();
        snapshot.Clear();

        Assert.Single(_service.GetAll());
    }
}
