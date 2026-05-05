# Agent Wars Mock E-Commerce Site - Copilot Instructions

You are an expert assistant for the **mock-e-commerce-site** codebase. Your purpose is to help developers understand and work with this project by providing accurate, detailed answers about its architecture, structure, implementation, and testing capabilities.

## Core Project Knowledge

### 1. Technology Stack

#### Frontend
- **Framework:** React 19.2.4 with TypeScript 6.0.2
- **Build Tool:** Vite 8.0.4
- **State Management:** React Hooks (useState, useRef, useEffect)
- **HTTP Client:** Fetch API (custom wrapper in `src/api/index.ts`)
- **Testing:** Vitest 4.1.4 + React Testing Library 16.3.2
- **Linting:** ESLint 9.39.4 with React plugins
- **Styling:** CSS (traditional, located in `src/*.css`)

#### Backend
- **Framework:** ASP.NET Core 10.0 (Minimal APIs)
- **Language:** C# with nullable reference types enabled
- **Architecture:** Layered (Endpoints → Services → Models)
- **API Documentation:** OpenAPI/Swagger support
- **Testing Framework:** xUnit 2.9.3 + Microsoft.AspNetCore.Mvc.Testing 10.0.*
- **CORS Enabled:** Configured for localhost:5173 (frontend dev server)

#### Shared
- **Monorepo Setup:** Workspaces configured in root `package.json` for frontend
- **Source Structure:** Separate frontend and backend directories under `src/`
- **Test Structure:** Mirrored structure under `test/` directory

### 2. File Structure & Locations

#### Frontend Source (`src/frontend/src/`)
```
src/frontend/src/
├── App.tsx                    # Main application component
├── main.tsx                   # React DOM entry point
├── index.css                  # Global styles
├── App.css                    # App-level styles
├── api/
│   └── index.ts              # API integration (fetch wrapper for backend calls)
├── types/
│   └── index.ts              # Shared TypeScript type definitions
├── components/               # Reusable UI components
│   ├── Header/              # Site header with cart indicator
│   ├── HeroBanner/          # Hero section
│   ├── ProductCard/         # Individual product display
│   └── ProductList/         # Product grid container
├── hooks/
│   └── useProducts.ts       # Custom hook for fetching products from API
└── assets/                  # Static images and SVGs
```

#### Frontend Tests (`test/frontend/`)
```
test/frontend/
├── App.test.tsx
├── components/
│   ├── Header/Header.test.tsx
│   ├── HeroBanner/HeroBanner.test.tsx
│   ├── ProductCard/ProductCard.test.tsx
│   └── ProductList/ProductList.test.tsx
└── hooks/
    └── useProducts.test.ts
```

#### Backend Source (`src/backend/MockEcommerce.Api/`)
```
src/backend/MockEcommerce.Api/
├── Program.cs                # ASP.NET Core app configuration, DI setup, middleware
├── MockEcommerce.Api.csproj  # Project file
├── appsettings.json          # Configuration
├── appsettings.Development.json
├── Properties/
│   └── launchSettings.json   # Launch profiles (IIS Express, http)
├── Models/                   # Domain models
│   ├── Product.cs           # Product entity (Id, Name, Price, Category, Stock, etc.)
│   └── CartItem.cs          # Shopping cart item
├── Services/                # Business logic layer
│   ├── IProductService.cs           # Product service contract
│   ├── MockProductService.cs        # In-memory product catalog with 5 sample products
│   ├── ICartService.cs              # Cart service contract
│   └── InMemoryCartService.cs       # In-memory shopping cart implementation
└── Endpoints/              # Minimal API route handlers
    ├── ProductEndpoints.cs # Routes: GET /api/products, GET /api/products/{id}
    └── CartEndpoints.cs    # Cart-related endpoints
```

#### Backend Tests (`test/backend/MockEcommerce.Api.Tests/`)
```
test/backend/MockEcommerce.Api.Tests/
├── MockEcommerce.Api.Tests.csproj
├── Endpoints/
│   └── ProductEndpointTests.cs     # Tests for product endpoints
└── Services/
    └── MockProductServiceTests.cs  # Tests for product service
```

#### Configuration Files
- `src/frontend/vite.config.ts` - Frontend build config
- `src/frontend/tsconfig*.json` - TypeScript configurations
- `src/frontend/eslint.config.js` - Linting rules
- `src/backend/MockEcommerce.slnx` - Solution file
- Root: `package.json` (monorepo workspace)

### 3. Current Implementation State

#### Frontend Implementation
- ✅ **Fully Functional:** React UI with component-based architecture
- ✅ **Features Implemented:**
  - Product list display with ProductCard components
  - Product fetching via `useProducts` hook from backend API
  - Add-to-cart functionality with visual feedback (success message)
  - Cart item counter in header
  - Hero banner and branding
  - Responsive layout with styled components
- ✅ **API Integration:** Fetch-based HTTP client for backend communication
- ✅ **Test Coverage:** Unit tests for all major components and hooks

#### Backend Implementation
- ✅ **Fully Functional:** ASP.NET Core minimal API
- ✅ **Features Implemented:**
  - **Product Service:** Provides mock catalog of 5 products
  - **Cart Service:** In-memory cart storage per session
  - **Endpoints:**
    - `GET /api/products` - Returns all products
    - `GET /api/products/{id}` - Returns single product
    - Cart management endpoints (add, get, remove items)
  - **CORS:** Configured to allow frontend communication
  - **OpenAPI:** Swagger documentation enabled at `/openapi/v1.json`
- ✅ **Architecture:** Clean layered design (Endpoints → Services → Models)
- ✅ **Test Coverage:** Integration and unit tests for endpoints and services

### 4. Product Data

The backend includes a static mock catalog in `MockProductService.cs` with 5 sample products:

1. **Wireless Headphones** (Id: 1)
   - Price: $79.99
   - Category: Electronics
   - Stock: 25 units
   - Description: "Over-ear noise-cancelling wireless headphones with 30-hour battery life."

2. **Running Shoes** (Id: 2)
   - Price: $59.99
   - Category: Footwear
   - Stock: 40 units
   - Description: "Lightweight breathable running shoes for all-terrain use."

3. **Stainless Steel Water Bottle** (Id: 3)
   - Price: $24.99
   - Category: Accessories
   - Stock: 100 units
   - Description: "Insulated 32 oz water bottle that keeps drinks cold for 24 hours."

4. **Mechanical Keyboard** (Id: 4)
   - Price: $109.99
   - Category: Electronics
   - Stock: 15 units
   - Description: "Compact tenkeyless mechanical keyboard with Cherry MX Blue switches."

5. **Additional products** - Catalog continues in the service

**Product Data Structure:**
```csharp
public class Product
{
    public int Id { get; set; }                    // Unique identifier
    public string Name { get; set; }               // Display name
    public string Description { get; set; }        // Detailed description
    public decimal Price { get; set; }             // Unit price in USD
    public string Category { get; set; }           // Product category
    public int Stock { get; set; }                 // Available units
    public string ImageUrl { get; set; }           // Product image URL
}
```

**Cart Item Structure:**
```csharp
public class CartItem
{
    public int ProductId { get; set; }             // Reference to product
    public int Quantity { get; set; }              // Units in cart
}
```

### 5. Test Commands

#### Frontend Testing
```bash
# Run all frontend tests (single run)
npm run test
npm run test:frontend

# Run tests in watch mode (not currently configured, but possible)
# vitest watch

# Frontend specific scripts
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

#### Backend Testing
```bash
# Build the backend project
dotnet build src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj

# Run backend tests
dotnet test test/backend/MockEcommerce.Api.Tests/MockEcommerce.Api.Tests.csproj

# Run specific test class
dotnet test test/backend/MockEcommerce.Api.Tests/ --filter ProductEndpointTests

# Run with verbose output
dotnet test test/backend/MockEcommerce.Api.Tests/ --verbosity detailed

# Generate test coverage
dotnet test test/backend/MockEcommerce.Api.Tests/ /p:CollectCoverage=true
```

#### Backend Development
```bash
# Watch mode for development (rebuilds on file change)
dotnet watch run --project src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj

# Run the API (default at http://localhost:5000)
dotnet run --project src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj

# Publish for production
dotnet publish src/backend/MockEcommerce.Api/MockEcommerce.Api.csproj
```

#### Full Stack Testing
```bash
# Run all tests (frontend and backend)
# Frontend: npm run test
# Backend: dotnet test test/backend/MockEcommerce.Api.Tests/

# Recommended order: Backend first (slower), then frontend
```

## How to Use This Guide

When a user asks about the **mock-e-commerce-site** project:

1. **For tech stack questions:** Reference the Technology Stack section with version numbers
2. **For file locations:** Provide paths relative to `agent-wars/` root and clarify the layer (frontend, backend, tests)
3. **For implementation status:** Reference the Current Implementation State section
4. **For product/data questions:** Provide details from the Product Data section including IDs, prices, and categories
5. **For testing:** Provide exact command syntax from the Test Commands section

## Additional Context

- **Frontend-Backend Communication:** Frontend calls backend at `http://localhost:5000` (configurable in `src/frontend/src/api/index.ts`)
- **Development Server Port:** Frontend dev server runs on `http://localhost:5173` (default Vite)
- **API Base:** Backend API at `/api/*` route prefix
- **Development Workflow:** Start backend first (watch mode), then frontend dev server
- **Monorepo:** Frontend and backend are independent projects with shared root configuration
