using Microsoft.AspNetCore.Http.HttpResults;
using MockEcommerce.Api.Models;
using MockEcommerce.Api.Services;

namespace MockEcommerce.Api.Endpoints;

/// <summary>
/// Maps shopping cart endpoints under <c>/api/cart</c>.
/// </summary>
public static class CartEndpoints
{
    /// <summary>Registers cart-related routes on the given endpoint route builder.</summary>
    public static void MapCartEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("api/cart")
            .WithTags("Cart");

        group.MapGet("/", GetCart)
            .WithName("GetCart")
            .WithSummary("Returns all items currently in the cart.");

        group.MapPost("/", AddToCart)
            .WithName("AddToCart")
            .WithSummary("Adds a product to the cart or increments quantity if already present.");

        group.MapPut("/{productId:int}", UpdateCartItem)
            .WithName("UpdateCartItem")
            .WithSummary("Sets the quantity of an existing cart item.");

        group.MapDelete("/{productId:int}", RemoveFromCart)
            .WithName("RemoveFromCart")
            .WithSummary("Removes a single product from the cart by its product ID.");

        group.MapDelete("/", ClearCart)
            .WithName("ClearCart")
            .WithSummary("Removes all items from the cart.");
    }

    /// <summary>Returns all items currently in the cart.</summary>
    internal static Ok<IEnumerable<CartItem>> GetCart(ICartService cartService)
    {
        return TypedResults.Ok(cartService.GetAll());
    }

    /// <summary>Adds a product to the cart or increments quantity if already present.</summary>
    internal static Results<Created<CartItem>, Ok<CartItem>, NotFound<string>, ValidationProblem> AddToCart(
        AddToCartRequest request,
        IProductService productService,
        ICartService cartService)
    {
        if (request.Quantity < 1 || request.Quantity > CartLimits.MaxQuantityPerProduct)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["quantity"] = [$"Quantity must be between 1 and {CartLimits.MaxQuantityPerProduct}."]
            });
        }

        var product = productService.GetById(request.ProductId);
        if (product is null)
        {
            return TypedResults.NotFound($"Product {request.ProductId} not found");
        }

        var existing = cartService.GetByProductId(request.ProductId);
        var newQuantity = (existing?.Quantity ?? 0) + request.Quantity;
        if (newQuantity > CartLimits.MaxQuantityPerProduct)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["quantity"] = [$"Cannot exceed maximum quantity of {CartLimits.MaxQuantityPerProduct} per product."]
            });
        }

        var cartItem = new CartItem
        {
            ProductId = product.Id,
            ProductName = product.Name,
            UnitPrice = product.Price,
            Quantity = request.Quantity
        };

        var updated = cartService.Add(cartItem);
        if (existing is null)
        {
            return TypedResults.Created($"/api/cart/{product.Id}", updated);
        }

        return TypedResults.Ok(updated);
    }

    /// <summary>Sets quantity for an existing cart item.</summary>
    internal static Results<Ok<CartItem>, NotFound<string>, ValidationProblem> UpdateCartItem(
        int productId,
        UpdateCartItemRequest request,
        IProductService productService,
        ICartService cartService)
    {
        if (request.Quantity < 1 || request.Quantity > CartLimits.MaxQuantityPerProduct)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["quantity"] = [$"Quantity must be between 1 and {CartLimits.MaxQuantityPerProduct}."]
            });
        }

        var product = productService.GetById(productId);
        if (product is null)
        {
            return TypedResults.NotFound($"Product {productId} not found");
        }

        var updated = cartService.SetQuantity(productId, request.Quantity);
        if (updated is null)
        {
            return TypedResults.NotFound($"Cart item for product {productId} not found");
        }

        return TypedResults.Ok(updated);
    }

    /// <summary>Removes a single product from the cart by its product ID.</summary>
    internal static Results<NoContent, NotFound> RemoveFromCart(int productId, ICartService cartService)
    {
        return cartService.Remove(productId)
            ? TypedResults.NoContent()
            : TypedResults.NotFound();
    }

    /// <summary>Removes all items from the cart.</summary>
    internal static NoContent ClearCart(ICartService cartService)
    {
        cartService.Clear();
        return TypedResults.NoContent();
    }
}

/// <summary>Request body for adding a product to the cart.</summary>
public record AddToCartRequest(int ProductId, int Quantity);

/// <summary>Request body for setting quantity on an existing cart item.</summary>
public record UpdateCartItemRequest(int Quantity);
