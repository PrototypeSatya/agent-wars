# PLAN — Cart View & Management

Implementation plan for [SPEC.md](SPEC.md). Sequenced bottom-up: **models → service → endpoints → frontend → tests**, with tests added alongside each backend layer and as the final step for the frontend. Each step is small enough that another developer can pick it up cold.

Conventions: all paths are repo-relative. Backend lives under `src/backend/MockEcommerce.Api/`; backend tests under `test/backend/MockEcommerce.Api.Tests/`. Frontend lives under `src/frontend/src/`; frontend tests under `test/frontend/`. Run frontend tests from the repo root with `npm test`. Run backend tests with `dotnet test src/backend/MockEcommerce.slnx`.

---

## Phase 0 — Prep (5 min)

1. Read [SPEC.md](SPEC.md) and confirm the rules table (R1–R14).
2. Verify .NET 10 SDK is installed (`dotnet --list-sdks`) and Node 20+ for the frontend.
3. From repo root: `npm install` (installs frontend workspace deps) and `dotnet restore src/backend/MockEcommerce.slnx`.
4. Sanity check current state: `dotnet test src/backend/MockEcommerce.slnx` (only Products tests exist) and `npm test` should pass.

---

## Phase 1 — Models (backend) (10 min)

Goal: add the new request DTO so service + endpoint signatures compile.

1. **Add `UpdateCartItemRequest`** record at the bottom of `src/backend/MockEcommerce.Api/Endpoints/CartEndpoints.cs`, next to the existing `AddToCartRequest`:
   ```csharp
   public record UpdateCartItemRequest(int Quantity);
   ```
2. **Add a domain constant** for the max quantity. Create `src/backend/MockEcommerce.Api/Models/CartLimits.cs`:
   ```csharp
   namespace MockEcommerce.Api.Models;
   public static class CartLimits { public const int MaxQuantityPerProduct = 5; }
   ```
   Use `CartLimits.MaxQuantityPerProduct` everywhere instead of a literal `5`.
3. No changes to `Product.cs` or `CartItem.cs`.

---

## Phase 2 — Service: `InMemoryCartService` (30 min)

Goal: replace every `NotImplementedException` in `src/backend/MockEcommerce.Api/Services/InMemoryCartService.cs` with thread-safe logic. The class already has `private readonly List<CartItem> _cart = [];` and `private readonly Lock _lock = new();`.

Implement the existing `ICartService` methods. Note: the interface defines `Add`, `Remove`, `Clear`, `GetByProductId`, `GetAll`. Per SPEC R4 the service must support increment-on-existing — extend the interface with an explicit setter for PUT.

1. **Extend `ICartService`** (`Services/ICartService.cs`) with:
   ```csharp
   /// <summary>Sets the quantity of an existing cart item. Returns null if the item is not in the cart.</summary>
   CartItem? SetQuantity(int productId, int quantity);
   ```
2. **Implement all six methods** in `InMemoryCartService`. Take `_lock` for **every** method (reads included — `List<T>` enumeration is not safe under concurrent mutation):
   - `GetAll()` → return a snapshot copy (`_cart.ToList()`) inside the lock.
   - `GetByProductId(int)` → linear search inside lock; return reference (it's a class, callers shouldn't mutate but the snapshot semantics are documented).
   - `Add(CartItem item)` → if a line with the same `ProductId` exists, **increment** its `Quantity` by `item.Quantity` and return it. Otherwise append `item` and return it. **Caller is responsible for the catalog lookup and the ≤5 check** — keep the service dumb. (The endpoint layer enforces SPEC R4; the service just persists.)
   - `SetQuantity(int productId, int quantity)` → find existing line; if missing return `null`; else set `Quantity` and return it.
   - `Remove(int productId)` → returns `false` if no matching line, otherwise removes and returns `true`.
   - `Clear()` → `_cart.Clear()`.
3. **Tests** in `test/backend/MockEcommerce.Api.Tests/Services/InMemoryCartServiceTests.cs` (new file). xUnit, no fixtures needed:
   - `Add_NewProduct_AppendsLine`
   - `Add_ExistingProduct_IncrementsQuantity`
   - `SetQuantity_ExistingItem_UpdatesQuantity`
   - `SetQuantity_MissingItem_ReturnsNull`
   - `Remove_ExistingItem_ReturnsTrue` / `Remove_MissingItem_ReturnsFalse`
   - `Clear_EmptiesCart_AndIsIdempotent`
   - `GetAll_ReturnsSnapshot_NotLiveReference`
4. Run `dotnet test src/backend/MockEcommerce.slnx` — all green.

---

## Phase 3 — Endpoints (backend) (45 min)

Goal: implement all five cart endpoints in `src/backend/MockEcommerce.Api/Endpoints/CartEndpoints.cs`.

1. **Register the new PUT route** in `MapCartEndpoints`:
   ```csharp
   group.MapPut("/{productId:int}", UpdateCartItem)
        .WithName("UpdateCartItem")
        .WithSummary("Sets the quantity of an existing cart item.");
   ```
2. **Implement `GetCart`** — return `TypedResults.Ok(cartService.GetAll())`. (200 with `[]` when empty satisfies SPEC R11.)
3. **Implement `AddToCart`** (POST) per SPEC §3.2:
   - Validate `request.Quantity` is in `[1, CartLimits.MaxQuantityPerProduct]`. If not, `TypedResults.ValidationProblem` with errors keyed on `"quantity"`.
   - Lookup product via `IProductService.GetById`. If null → `TypedResults.NotFound("Product {id} not found")`.
   - Compute `existing = cartService.GetByProductId(request.ProductId)`. Compute `newQty = (existing?.Quantity ?? 0) + request.Quantity`. If `newQty > 5`, return `ValidationProblem` with the cap message (SPEC R4 / §3.2 row 4).
   - If `existing == null`: build `new CartItem { ProductId = product.Id, ProductName = product.Name, UnitPrice = product.Price, Quantity = request.Quantity }`, call `cartService.Add(item)`, return `TypedResults.Created($"/api/cart/{product.Id}", item)`.
   - Else (existing): call `cartService.Add(new CartItem { ProductId = ..., Quantity = request.Quantity, ... })` (the service increments). Return `TypedResults.Ok(updated)`.
   - Update the handler's return type union to: `Results<Created<CartItem>, Ok<CartItem>, NotFound<string>, ValidationProblem>` — already declared correctly.
4. **Implement `UpdateCartItem`** (PUT) per SPEC §3.3:
   - Signature: `Results<Ok<CartItem>, NotFound<string>, ValidationProblem> UpdateCartItem(int productId, UpdateCartItemRequest request, IProductService products, ICartService carts)`.
   - Validate `quantity ∈ [1, 5]` → `ValidationProblem` if not.
   - Catalog lookup; 404 with `"Product {productId} not found"` if absent (SPEC R7, runs first).
   - `carts.SetQuantity(productId, request.Quantity)`; if null → 404 `"Cart item for product {productId} not found"` (SPEC R6).
   - Else 200 with the updated `CartItem`.
5. **Implement `RemoveFromCart`** (DELETE one) — `cartService.Remove(productId)` ? `TypedResults.NoContent()` : `TypedResults.NotFound()`.
6. **Implement `ClearCart`** — `cartService.Clear(); return TypedResults.NoContent();`.
7. **Tests** in `test/backend/MockEcommerce.Api.Tests/Endpoints/CartEndpointTests.cs` (new). Use `WebApplicationFactory<Program>` like `ProductEndpointTests.cs`. **Important:** `InMemoryCartService` is a singleton, so tests must clear the cart between cases. Use a class fixture and `IAsyncLifetime` calling `DELETE /api/cart` in `InitializeAsync`, OR mark each test with explicit setup. Sample cases:
   - `GetCart_WhenEmpty_Returns200WithEmptyArray`
   - `AddToCart_NewItem_Returns201`
   - `AddToCart_ExistingItem_IncrementsAndReturns200`
   - `AddToCart_OverMax_Returns400`
   - `AddToCart_NonexistentProduct_Returns404`
   - `AddToCart_QuantityZero_Returns400` / `QuantityNegative_Returns400` / `QuantitySix_Returns400`
   - `UpdateCartItem_Existing_Returns200WithNewQuantity`
   - `UpdateCartItem_NotInCart_Returns404`
   - `UpdateCartItem_NonexistentProduct_Returns404`
   - `UpdateCartItem_QuantitySix_Returns400`
   - `UpdateCartItem_QuantityZero_Returns400`
   - `RemoveFromCart_Existing_Returns204` / `Missing_Returns404`
   - `ClearCart_EmptyOrNot_Returns204`
8. Run `dotnet test src/backend/MockEcommerce.slnx`. All green. Manually smoke-test with `curl` against `dotnet run --project src/backend/MockEcommerce.Api`:
   ```bash
   curl -i -X POST http://localhost:5063/api/cart -H 'Content-Type: application/json' -d '{"productId":1,"quantity":3}'
   curl -i -X PUT  http://localhost:5063/api/cart/1 -H 'Content-Type: application/json' -d '{"quantity":5}'
   curl -i -X PUT  http://localhost:5063/api/cart/1 -H 'Content-Type: application/json' -d '{"quantity":6}'   # 400
   curl -i        http://localhost:5063/api/cart
   ```

---

## Phase 4 — Frontend data layer (20 min)

Goal: lift `CartItem` into shared types, extend `api/index.ts`, and add `useCart`.

1. **Move `CartItem` to `src/frontend/src/types/index.ts`** (it's currently inline in `api/index.ts`):
   ```ts
   export interface CartItem {
     productId: number;
     productName: string;
     unitPrice: number;
     quantity: number;
     totalPrice: number;
   }
   export interface UpdateCartItemRequest { quantity: number; }
   ```
2. **Extend `src/frontend/src/api/index.ts`** with `fetchCart`, `updateCartItem`, `removeFromCart`, `clearCart`. For non-2xx responses, parse the body as JSON and surface either `problemDetails.detail`, the first validation error, or the raw text. Throw a typed `CartApiError extends Error` with `status` and `message` so the UI can branch on the 400 cap message vs. generic failure.
3. **Create `src/frontend/src/hooks/useCart.ts`**:
   ```ts
   export function useCart(): {
     items: CartItem[];
     loading: boolean;
     error: string | null;
     itemCount: number;          // sum of quantities
     subtotal: number;           // sum of totalPrice
     add(productId: number, quantity?: number): Promise<void>;
     update(productId: number, quantity: number): Promise<void>;
     remove(productId: number): Promise<void>;
     clear(): Promise<void>;
     refetch(): Promise<void>;
   }
   ```
   Implementation: `useState` + `useEffect` initial `fetchCart()`. After every mutation, await the response and call `refetch()` (no optimistic updates). On error, set `error` to the parsed message and re-throw so callers can decide to show inline UI.

---

## Phase 5 — Frontend cart drawer (45 min)

Goal: build the drawer and wire it into `App.tsx` and `Header.tsx`.

1. **Create `src/frontend/src/components/Cart/Cart.tsx`** (and `index.ts` barrel). Props: `{ open: boolean; onClose: () => void; }`. Internally calls `useCart()`. Renders an overlay + slide-in panel; closes on overlay click, Escape key, or close button. Inside:
   - Header row: "Your cart" + close button.
   - Body branches per SPEC §4.2 (loading / error / empty / list).
   - Each line: thumbnail, name, unit price, stepper (`−`/qty/`+`), line total, remove (✕). Disable `+` when `quantity === 5`; disable `−` when `quantity === 1`. On stepper click, call `update(productId, newQty)` and on error set a per-line message (e.g. "Maximum 5 per product").
   - Footer: total quantity, subtotal, disabled "Checkout (coming soon)" button, "Clear cart" link with `window.confirm`.
2. **Add minimal CSS** in `src/frontend/src/components/Cart/Cart.css` (drawer position, overlay, list, stepper). Import it from `Cart.tsx`. Match the BEM-ish class naming used by existing components (`cart`, `cart__overlay`, `cart__panel`, `cart__line`, `cart__stepper`, etc.).
3. **Update `src/frontend/src/components/Header/Header.tsx`**:
   - Replace `cartItemCount: number` prop with `onCartClick: () => void` (and keep `cartItemCount` as a derived prop). Wire the cart button's `onClick` to `onCartClick`.
4. **Update `src/frontend/src/App.tsx`**:
   - Remove the local `cartItemCount` state and the optimistic increment in `handleAddToCart`.
   - Add `const [cartOpen, setCartOpen] = useState(false);` and `const cart = useCart();`.
   - Pass `cartItemCount={cart.itemCount}` and `onCartClick={() => setCartOpen(true)}` to `<Header>`.
   - Replace `addToCart(...)` direct call inside `handleAddToCart` with `cart.add(product.id, 1)`. On caught error from the cap, set `cartMessage` to the API error message instead of a generic string.
   - Render `<Cart open={cartOpen} onClose={() => setCartOpen(false)} />` at the end of the app tree.
5. Manual verification (both servers running): add items, open drawer, increment to 5 (button disables), try clicking `+` once more → inline cap message; decrement to 1 (button disables), remove via ✕, clear cart, close drawer.

---

## Phase 6 — Frontend tests (30 min)

Goal: cover the drawer, the hook, and the API layer. Place files under `test/frontend/` mirroring `src/frontend/src/`.

1. **`test/frontend/hooks/useCart.test.ts`** — mock `fetch`. Cases: initial load populates `items`; `add` POSTs and refetches; `update` PUTs and refetches; cap error from server is exposed in `error`; `remove` and `clear` work.
2. **`test/frontend/components/Cart/Cart.test.tsx`** — render with mocked fetch:
   - Empty cart message renders.
   - Lines render with correct totals.
   - `+` disables at quantity 5; `−` disables at 1.
   - Clicking `+` issues `PUT /api/cart/{id}` with `quantity = current + 1`.
   - Clicking ✕ issues `DELETE /api/cart/{id}` and removes the line on refetch.
   - Server 400 with cap detail surfaces as inline text.
3. **Update `test/frontend/App.test.tsx`** — header cart click opens drawer; `cartItemCount` reflects sum of `useCart` items, not a local optimistic counter.
4. **Update `test/frontend/components/Header/Header.test.tsx`** — new `onCartClick` prop is invoked.
5. Run `npm test` from repo root. All green.

---

## Phase 7 — Full-stack smoke + finalise (15 min)

1. Start backend: `dotnet run --project src/backend/MockEcommerce.Api` (port 5063).
2. Start frontend: `cd src/frontend && npm run dev` (port 5173, proxies `/api`).
3. Walk the golden path:
   - Add 3× Wireless Headphones via the product card → drawer count = 3.
   - Open drawer → see one line, qty 3, subtotal $239.97.
   - `+` twice → qty 5, subtotal $399.95, `+` button disabled.
   - Try one more `+` (force-enable in devtools or hit the API directly) → 400 with cap message; UI surfaces it.
   - Edit URL: `curl -X PUT .../api/cart/1 -d '{"quantity":1}'` → drawer refetches on next interaction (or refresh) and shows qty 1.
   - Remove the line → empty state.
   - Clear cart on a populated cart → empty state.
4. Run all tests one more time: `dotnet test src/backend/MockEcommerce.slnx && npm test`.
5. Update `.github/copilot-instructions.md` so the "stubbed" callouts now read "implemented" — the doc should match reality after the change.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Singleton cart leaks state across backend tests | Use a per-class `WebApplicationFactory` fixture and clear the cart in `InitializeAsync` (DELETE `/api/cart`). |
| `Lock` (System.Threading.Lock, .NET 9+) requires .NET 10 SDK | Already required by the project — fail fast in Phase 0 if missing. |
| Refetch-after-mutation feels sluggish on slow networks | Acceptable for v1 (local dev); document optimistic-updates as a follow-up. |
| Frontend `BASE_URL = '/api'` hardcoded | Out of scope — keeping current behavior. |
| Browser cache on `GET /api/cart` | None expected (no `Cache-Control` set, fetch defaults are fine), but verify with DevTools Network tab during smoke test. |

---

## Definition of done

- All five cart endpoints return the statuses in [SPEC.md](SPEC.md) §3.
- Backend `dotnet test` passes with new endpoint and service tests covering every row of SPEC §5 (edge cases).
- Frontend `npm test` passes with `useCart`, `Cart`, updated `App` and `Header` tests.
- The drawer opens from the header cart icon, supports add/update/remove/clear, enforces max-5 in both UI affordances and surfaced API errors.
- `.github/copilot-instructions.md` no longer claims the cart is stubbed.
- No new runtime dependencies added on either side.
