# SPEC — Cart View & Management

Feature: Users can open the cart from the header cart icon, see line items + totals, change quantities, remove items, and clear the cart. A new `PUT /api/cart/{productId}` endpoint sets an item's quantity. Maximum purchase quantity per product is **5**.

This spec resolves the ambiguities in the feature request and is the source of truth for [PLAN.md](PLAN.md).

---

## 1. Scope

In scope:
- Implement the previously stubbed `GET/POST/DELETE /api/cart` and `DELETE /api/cart/{productId}` endpoints in `src/backend/MockEcommerce.Api/Endpoints/CartEndpoints.cs`.
- Implement `InMemoryCartService` in `src/backend/MockEcommerce.Api/Services/InMemoryCartService.cs`.
- Add new endpoint `PUT /api/cart/{productId}` (set quantity).
- Add a frontend cart view (drawer) opened from the existing header cart button.
- Enforce max quantity = **5 per product** on every write path.

Out of scope: checkout, payments, persistence beyond process memory, authentication, multi-user carts (the cart remains a singleton; documented as a demo limitation).

---

## 2. Domain rules (the resolved decisions)

| # | Rule | Decision |
|---|---|---|
| R1 | Maximum quantity per product (single line) | **5** |
| R2 | Minimum quantity per line | **1** (a line with `Quantity = 0` must not exist; use DELETE to remove) |
| R3 | `POST /api/cart` when product is **not** in cart | Insert new line with `Quantity = request.Quantity`. Reject if `Quantity < 1` or `Quantity > 5`. Returns **201 Created**. |
| R4 | `POST /api/cart` when product **is** in cart | Increment: `newQty = existing.Quantity + request.Quantity`. If `newQty > 5`, reject the **entire** request — do not partially fill. Returns **200 OK** on success with updated line. |
| R5 | `PUT /api/cart/{productId}` semantics | **Set/replace**, not increment. Body: `{ "quantity": <int> }`. Reject if `quantity < 1` or `quantity > 5`. Returns **200 OK** with updated line. |
| R6 | `PUT /api/cart/{productId}` when product is **not** in cart | **404 Not Found** — PUT does not create. (Use POST to add.) |
| R7 | `PUT` / `POST` referencing a `productId` that does not exist in the catalog | **404 Not Found** with body `"Product {id} not found"`. |
| R8 | Negative, zero, or non-integer `quantity` in body | **400 Bad Request** via `ValidationProblem` (RFC 7807) with field-level errors. |
| R9 | `DELETE /api/cart/{productId}` for a product not in cart | **404 Not Found**. |
| R10 | `DELETE /api/cart` (clear) | Always **204 No Content**, even if cart is already empty. |
| R11 | `GET /api/cart` when cart is empty | **200 OK** with body `[]`. |
| R12 | Cart line snapshot fields | `ProductName` and `UnitPrice` are captured **at insert time** (POST) and **not** refreshed on subsequent PUT/POST-increments. The `Stock` field on the catalog product is **not** decremented (no inventory simulation). |
| R13 | Concurrency | All reads and writes on `InMemoryCartService` use the existing `private readonly Lock _lock = new();` to guarantee atomicity of compound check-then-act operations. |
| R14 | Casing on the wire | JSON is camelCase (ASP.NET default). Request bodies: `{ "productId": 1, "quantity": 2 }` (POST) and `{ "quantity": 3 }` (PUT). |

---

## 3. Backend API contract

Base path: `/api/cart`. All responses are JSON. Errors use `ProblemDetails` (RFC 7807) via `TypedResults.Problem` / `TypedResults.ValidationProblem`.

### 3.1 `GET /api/cart`
- **200** `CartItem[]` — possibly empty.

### 3.2 `POST /api/cart`
Request body: `AddToCartRequest { productId: int, quantity: int }`.

| Outcome | Status | Body |
|---|---|---|
| New line added | **201 Created** | `CartItem` |
| Existing line incremented (≤ 5) | **200 OK** | `CartItem` |
| `quantity < 1` or `quantity > 5` | **400** | `ValidationProblem` with errors on `quantity` |
| Adding would push existing line above 5 | **400** | `ValidationProblem` — message: `"Cannot exceed maximum quantity of 5 per product."` |
| `productId` not in catalog | **404** | `"Product {id} not found"` |

### 3.3 `PUT /api/cart/{productId:int}` *(new)*
Request body: `UpdateCartItemRequest { quantity: int }`.

| Outcome | Status | Body |
|---|---|---|
| Quantity set successfully | **200 OK** | `CartItem` |
| `quantity < 1` or `quantity > 5` | **400** | `ValidationProblem` on `quantity` |
| Item not in cart | **404** | `"Cart item for product {id} not found"` |
| `productId` not in catalog | **404** | `"Product {id} not found"` (catalog check runs first) |

### 3.4 `DELETE /api/cart/{productId:int}`
| Outcome | Status |
|---|---|
| Removed | **204 No Content** |
| Not in cart | **404 Not Found** |

### 3.5 `DELETE /api/cart`
- **204 No Content** — clears all items unconditionally.

### 3.6 Models (no changes to existing shapes)
- `CartItem`: `productId`, `productName`, `unitPrice`, `quantity`, `totalPrice` (computed `unitPrice * quantity`, already implemented).
- `AddToCartRequest(int ProductId, int Quantity)` — already exists in `CartEndpoints.cs`.
- New `UpdateCartItemRequest(int Quantity)` — declared in `CartEndpoints.cs` next to the existing record.

---

## 4. Frontend specification

### 4.1 UX approach: cart drawer

Clicking the existing header cart button (`Header.tsx`) opens a **right-side slide-in drawer** (full-height, ~400px wide on desktop, full-width on mobile). The drawer is implemented as a new `Cart` component inside `src/frontend/src/components/Cart/`. State for "is drawer open" lives in `App.tsx` (lifted alongside the existing `cartItemCount`). No router is introduced.

Rationale: a drawer keeps the implementation contained, avoids router churn, and matches the "see cart, manage selections, then close" flow described in the brief. A full `/cart` page is rejected as overscope.

### 4.2 Drawer contents

| State | Rendering |
|---|---|
| Loading (initial fetch) | "Loading cart…" |
| Fetch error | Inline error message + Retry button |
| Empty cart | "Your cart is empty." plus a "Continue shopping" close button |
| Non-empty cart | List of lines + summary footer (see below) |

Each line shows: thumbnail (from product `imageUrl`), name, unit price, a **quantity stepper** (`−` button, number, `+` button), line subtotal, and a remove (✕) button. The stepper:
- `+` calls `PUT /api/cart/{productId}` with `quantity = current + 1`. **Disabled when `quantity === 5`.**
- `−` calls `PUT /api/cart/{productId}` with `quantity = current − 1`. **Disabled when `quantity === 1`** (use the remove button to delete).
- A direct numeric input is **not** offered in v1 (keeps validation simple).

Footer: total item count, subtotal (sum of `totalPrice`), a disabled-and-labelled "Checkout (coming soon)" button, and a "Clear cart" link calling `DELETE /api/cart` after a `window.confirm`.

### 4.3 Header behavior changes
- The cart button becomes the drawer toggle (currently it has no `onClick`).
- `cartItemCount` in the badge is replaced by a derived value: sum of `quantity` across cart lines fetched from `GET /api/cart`. The current optimistic local counter in `App.tsx` is removed because it drifts from the backend.

### 4.4 Frontend data layer
Add to `src/frontend/src/api/index.ts`:
- `fetchCart(): Promise<CartItem[]>`
- `updateCartItem(productId: number, quantity: number): Promise<CartItem>` (PUT)
- `removeFromCart(productId: number): Promise<void>` (DELETE)
- `clearCart(): Promise<void>` (DELETE)

Add a `useCart()` hook in `src/frontend/src/hooks/useCart.ts`. It owns cart state (`items`, `loading`, `error`), exposes `add/update/remove/clear` actions, and refetches after each successful mutation (simple and correct; no optimistic updates in v1). Errors from the backend's `ProblemDetails` payloads are surfaced as inline messages near the offending control (e.g. "Cannot exceed maximum quantity of 5 per product." on the `+` button).

Add `CartItem` to `src/frontend/src/types/index.ts` (currently only declared inline in `api/index.ts`).

---

## 5. Edge cases (explicit)

1. **Add 3 of product 1, then add another 3** → 400 with "Cannot exceed maximum quantity of 5 per product." Cart still shows quantity 3.
2. **Add 6 in a single POST** → 400 (quantity > 5 validation), nothing added.
3. **Add 0 / −1 / "abc"** → 400 ValidationProblem (model binding handles non-int; range check handles 0/negative).
4. **PUT quantity=5 on existing line of 2** → 200 OK, line is now 5.
5. **PUT quantity=6** → 400 ValidationProblem.
6. **PUT on a productId that's in the catalog but not the cart** → 404 ("Cart item not found"). PUT does **not** create.
7. **PUT quantity=0** → 400 (use DELETE to remove). Decision is intentional: keeps PUT semantics one-thing-only.
8. **DELETE a productId not in the cart** → 404.
9. **DELETE /api/cart on an already-empty cart** → 204.
10. **GET cart while empty** → 200 with `[]`.
11. **POST with productId that doesn't exist in catalog** → 404 with `"Product {id} not found"`. Catalog check runs before quantity check.
12. **Two simultaneous POSTs that would each individually fit but together exceed 5** → resolved by the `Lock`: one wins (committed), the other sees the new state and is rejected with 400 if it would overflow.
13. **Catalog price changes after item added** (theoretical — catalog is hardcoded): cart line keeps its snapshot price (R12).
14. **Frontend: user clicks `+` rapidly** → each click fires its own PUT; the disabled-at-5 rule and refetch-after-success keep state consistent. No debouncing in v1.

---

## 6. Non-goals / non-changes

- No `Stock` decrement on the `Product` model.
- No persistence — restarting the API empties the cart.
- No auth; the cart is a singleton shared by all clients (this is preserved from the existing code; the existing TODO comment in `InMemoryCartService` stays accurate).
- No new frontend dependency (no router, no state library).
