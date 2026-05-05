using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using MockEcommerce.Api.Models;

namespace MockEcommerce.Api.Tests.Endpoints;

public class CartEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public CartEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    private async Task ResetCartAsync()
    {
        await _client.DeleteAsync("/api/cart");
    }

    [Fact]
    public async Task GetCart_WhenEmpty_Returns200WithEmptyArray()
    {
        await ResetCartAsync();

        var response = await _client.GetAsync("/api/cart");

        response.EnsureSuccessStatusCode();
        var items = await response.Content.ReadFromJsonAsync<List<CartItem>>();
        Assert.NotNull(items);
        Assert.Empty(items);
    }

    [Fact]
    public async Task AddToCart_NewItem_Returns201()
    {
        await ResetCartAsync();

        var response = await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var item = await response.Content.ReadFromJsonAsync<CartItem>();
        Assert.NotNull(item);
        Assert.Equal(1, item.ProductId);
        Assert.Equal(2, item.Quantity);
    }

    [Fact]
    public async Task AddToCart_ExistingItem_IncrementsAndReturns200()
    {
        await ResetCartAsync();
        await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        var response = await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var item = await response.Content.ReadFromJsonAsync<CartItem>();
        Assert.NotNull(item);
        Assert.Equal(4, item.Quantity);
    }

    [Fact]
    public async Task AddToCart_OverMax_Returns400()
    {
        await ResetCartAsync();
        await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 3 });

        var response = await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 3 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Cannot exceed maximum quantity of 5 per product.", body);
    }

    [Fact]
    public async Task AddToCart_NonexistentProduct_Returns404()
    {
        await ResetCartAsync();

        var response = await _client.PostAsJsonAsync("/api/cart", new { productId = 999, quantity = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddToCart_InvalidQuantities_Return400()
    {
        await ResetCartAsync();

        var zero = await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 0 });
        var negative = await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = -1 });
        var six = await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 6 });

        Assert.Equal(HttpStatusCode.BadRequest, zero.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, negative.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, six.StatusCode);
    }

    [Fact]
    public async Task UpdateCartItem_Existing_Returns200WithNewQuantity()
    {
        await ResetCartAsync();
        await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        var response = await _client.PutAsJsonAsync("/api/cart/1", new { quantity = 5 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var item = await response.Content.ReadFromJsonAsync<CartItem>();
        Assert.NotNull(item);
        Assert.Equal(5, item.Quantity);
    }

    [Fact]
    public async Task UpdateCartItem_NotInCart_Returns404()
    {
        await ResetCartAsync();

        var response = await _client.PutAsJsonAsync("/api/cart/1", new { quantity = 2 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCartItem_NonexistentProduct_Returns404()
    {
        await ResetCartAsync();

        var response = await _client.PutAsJsonAsync("/api/cart/999", new { quantity = 2 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCartItem_InvalidQuantity_Returns400()
    {
        await ResetCartAsync();
        await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        var zero = await _client.PutAsJsonAsync("/api/cart/1", new { quantity = 0 });
        var six = await _client.PutAsJsonAsync("/api/cart/1", new { quantity = 6 });

        Assert.Equal(HttpStatusCode.BadRequest, zero.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, six.StatusCode);
    }

    [Fact]
    public async Task RemoveFromCart_Existing_Returns204()
    {
        await ResetCartAsync();
        await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        var response = await _client.DeleteAsync("/api/cart/1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task RemoveFromCart_Missing_Returns404()
    {
        await ResetCartAsync();

        var response = await _client.DeleteAsync("/api/cart/1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ClearCart_AlwaysReturns204()
    {
        await ResetCartAsync();
        await _client.PostAsJsonAsync("/api/cart", new { productId = 1, quantity = 2 });

        var populated = await _client.DeleteAsync("/api/cart");
        var empty = await _client.DeleteAsync("/api/cart");

        Assert.Equal(HttpStatusCode.NoContent, populated.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, empty.StatusCode);
    }
}
