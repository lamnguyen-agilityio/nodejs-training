# Furniture E-Commerce

A production-ready Furniture E-Commerce backend built with **NestJS**, featuring dual authentication providers, secure payment processing via Stripe, and a full admin management system.

> **Project timeline:** Mar 17 – Apr 07, 2026 (3 weeks)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running with Docker](#running-with-docker)
- [Available Scripts](#available-scripts)
- [Development Guidelines](#development-guidelines)

---

## Overview

This platform allows users to browse furniture products, manage a shopping cart, and purchase items through a secure checkout flow. It supports both guest and authenticated sessions.

---

## Features

### Authentication
- Sign in via **Google** or **GitHub** — using email to identify the user — no manual registration required
- Account is auto-created on first login
- Dual-provider strategy: **Clerk** (primary) with **Auth0** as fallback
- Admins can switch the active auth provider system-wide; all users are prompted to re-login

### Product Browsing
- Browse products organized by category
- Search by product name
- Filter by category
- View detailed product pages

### Shopping Cart
- Add, remove, and update item quantities
- Clear the entire cart
- Guest cart is preserved and automatically merged on sign-in (higher quantity wins on duplicates)

### Checkout & Payment
- Payments processed via **Stripe**
- Users receive real-time success/failure status
- Purchased products are accessible immediately after payment

### Orders
- View full order history with status tracking
- Order status updates automatically at each stage of the purchase lifecycle

### Admin Panel
- Add, edit, and toggle visibility of products and categories
- View and manage all customer orders
- Manually update order status

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Framework | [NestJS](https://nestjs.com) v11 |
| Language | TypeScript 5.7 |
| Auth Provider (Primary) | [Clerk](https://clerk.com) |
| Auth Provider (Backup) | [Auth0](https://auth0.com) |
| ORM | [MikroORM](https://mikro-orm.io) |
| Database | PostgreSQL 16 |
| Payments | [Stripe SDK](https://stripe.com/docs) |
| Logger | [NestJS Pino](https://github.com/iamolegga/nestjs-pino) |
| Package Manager | [pnpm](https://pnpm.io) 10 |
| Runtime | Node.js 24 |
| Containerization | Docker + Docker Compose |
| Deployment | [Railway](https://railway.app) |

---

## Architecture

### Auth Provider Flow

```
Request arrives
     │
     ▼
AuthGuard reads active provider
     │
     ├── provider = clerk ──► Clerk JWT verified
     │
     └── provider = auth0 ──► Auth0 JWT verified
              │
              ▼
         User identity resolved
              │
              ▼
         Request proceeds with AuthenticatedUser
```
 
Admin can switch the active provider at runtime via `POST /auth/provider`.
All subsequent requests are validated against the new provider immediately —
no restart required.
 
---

### Guest Cart → Merge Flow
 
```
Guest user
     │
     ▼
Adds items to cart (stored in storage)
     │
     ▼
User signs in
     │
     ▼
FE sends POST /carts/merge
with guest cart items
     │
     ▼
BE merges guest cart into user cart
     │
     ├── Item already in user cart?
     │        │
     │        ▼
     │   Keep higher quantity
     │   (capped at available stock)
     │
     └── New item?
              │
              ▼
         Add to user cart
         (skip if out of stock)
     │
     ▼
Guest localStorage merged
     │
     ▼
User sees unified cart
```

---

### Payment Flow

```
User Checkout
     │
     ▼
Stock deducted atomically
     │
     ▼
Stripe Checkout Session created
     │
     ├──► User pays on Stripe page
     │         │
     │         ▼
     │    Stripe Webhook
     │         │
     │    ┌────┴────┐
     │    ▼         ▼
     │  Paid      Expired
     │    │         │
     │    ▼         ▼
     │ Order=paid  Stock rolled back
     │             Order=cancelled
     │
     └──► User redirected to success / cancel URL
              │
              ▼
         FE polls GET /payments/:orderId
              │
              ▼
         Show result to user
```

---

## Project Structure

```
furniture-ecommerce/
├── src/
│   ├── common/
│   │   ├── constants/           # Shared constants (app, db, error codes, messages, file, validation)
│   │   ├── database/            # DB retry policy & @Retryable decorator
│   │   ├── dtos/                # Shared DTOs (health-status, pagination)
│   │   ├── enums/               # Shared enums (env, role, status, provider, sort)
│   │   ├── filters/             # Global HTTP exception filter
│   │   ├── interfaces/          # Shared interfaces (error, pagination)
│   │   ├── logger/              # Pino logger config
│   │   ├── pipes/               # Shared pipes (parse-image-file)
│   │   └── utils/               # Shared utility helpers (pagination, text)
│   ├── config/                  # App configuration (env validation, cors, db, helmet, swagger, versioning)
│   ├── migrations/              # MikroORM database migrations
│   ├── modules/
│   │   ├── auth/                # Authentication module
│   │   │   ├── adapters/        # Auth provider adapters (Clerk, Auth0)
│   │   │   ├── decorators/      # @Auth, @CurrentUser, @Roles decorators
│   │   │   ├── dtos/            # Auth DTOs (authenticated-user, provider-status, switch-provider)
│   │   │   ├── guards/          # AuthGuard, RolesGuard
│   │   │   ├── interfaces/      # Auth interfaces (token, provider, authenticated-user)
│   │   │   ├── auth-provider.factory.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.module.ts
│   │   │   └── auth.service.ts
│   │   ├── carts/               # Shopping cart module
│   │   │   ├── dtos/            # Cart DTOs (add-cart-item, cart-response, merge-cart, etc.)
│   │   │   ├── entities/        # CartItem entity
│   │   │   ├── interfaces/
│   │   │   ├── carts.controller.ts
│   │   │   ├── carts.module.ts
│   │   │   ├── carts.repository.ts
│   │   │   └── carts.service.ts
│   │   ├── categories/          # Product categories module
│   │   │   ├── dtos/            # Category DTOs (create, update, response)
│   │   │   ├── entities/        # Category entity
│   │   │   ├── interfaces/
│   │   │   ├── categories.controller.ts
│   │   │   ├── categories.module.ts
│   │   │   ├── categories.repository.ts
│   │   │   └── categories.service.ts
│   │   ├── orders/              # Orders module
│   │   │   ├── dtos/            # Order DTOs (find-query, response, update-status, etc.)
│   │   │   ├── entities/        # Order & OrderItem entities
│   │   │   ├── interfaces/
│   │   │   ├── order-status.machine.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.repository.ts
│   │   │   └── orders.service.ts
│   │   ├── payments/            # Payments module
│   │   │   ├── dtos/            # Payment DTOs (checkout-response, payment-response)
│   │   │   ├── entities/        # Payment entity
│   │   │   ├── interfaces/
│   │   │   ├── providers/       # Stripe provider
│   │   │   ├── payment-provider.service.ts
│   │   │   ├── payments.controller.ts
│   │   │   ├── payments.module.ts
│   │   │   ├── payments.repository.ts
│   │   │   └── payments.service.ts
│   │   ├── products/            # Products module
│   │   │   ├── dtos/            # Product DTOs (create, update, response, query, paginated)
│   │   │   ├── entities/        # Product entity
│   │   │   ├── interfaces/
│   │   │   ├── products.controller.ts
│   │   │   ├── products.module.ts
│   │   │   ├── products.repository.ts
│   │   │   └── products.service.ts
│   │   ├── upload/              # File upload module
│   │   │   ├── providers/       # ImgBB upload provider
│   │   │   ├── image-upload.service.ts
│   │   │   └── upload.module.ts
│   │   ├── user-identities/     # Multi-provider identity linking
│   │   │   ├── entities/        # UserIdentity entity
│   │   │   ├── interfaces/      # Upsert identity interface
│   │   │   ├── user-identities.module.ts
│   │   │   ├── user-identities.repository.ts
│   │   │   └── user-identities.service.ts
│   │   ├── users/               # User module
│   │   │   ├── entities/        # User entity
│   │   │   ├── interfaces/      # Create/update user interfaces
│   │   │   ├── users.module.ts
│   │   │   ├── users.repository.ts
│   │   │   └── users.service.ts
│   │   └── webhook/             # Stripe webhook module
│   │       ├── handlers/        # Checkout completed & expired handlers
│   │       ├── webhook.controller.ts
│   │       ├── webhook.module.ts
│   │       └── webhook.service.ts
│   ├── test/                    # Shared test utilities & mocks
│   ├── app.module.ts            # Root application module
│   ├── app.controller.ts        # Health check controller
│   ├── app.service.ts
│   └── main.ts                  # Bootstrap entry point
├── docker/
│   ├── Dockerfile               # Multi-stage production build
│   ├── Dockerfile.dev           # Development build (hot-reload)
│   ├── docker-compose.base.yml
│   ├── docker-compose.dev.yml   # Development environment
│   └── docker-compose.yml       # Staging environment
├── run.sh                       # Unified CLI runner (dev / staging)
├── .env.example                 # Environment variable template
├── jest.config.ts
├── test-setup.ts
├── eslint.config.mjs
├── lint-staged.config.js
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

---

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com) + Docker Compose

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | API server port (default: `3000`) |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_PORT` | PostgreSQL port (default: `5432`) |
| `DATABASE_URL` | Full PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `AUTH0_DOMAIN` | Auth0 domain |
| `AUTH0_CLIENT_ID` | Auth0 client ID |
| `AUTH0_CLIENT_SECRET` | Auth0 client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

### Running with Docker

The project uses a `run.sh` script to manage Docker environments.

**Development** (hot-reload enabled):

```bash
# Start all services
./run.sh dev up

# Tail logs
./run.sh dev logs

# Tail logs for a specific service
./run.sh dev logs api

# Open a shell inside the api container
./run.sh dev exec api

# Restart a service
./run.sh dev restart api

# Stop all services
./run.sh dev down

# Remove all containers and volumes (wipes database)
./run.sh dev clean
```

**Staging** (production build):

```bash
cp .env.example .env.staging   # configure staging values

./run.sh staging up
./run.sh staging down
```

---

## Available Scripts

| Script | Description |
|---|---|
| `pnpm start` | Start the server |
| `pnpm start:dev` | Start in watch mode (hot-reload) |
| `pnpm start:debug` | Start in debug + watch mode |
| `pnpm start:prod` | Start from compiled `dist/` |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm format` | Format source files with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:cov` | Run tests with coverage report |

---

## Development Guidelines

### Git Hooks (via Husky)

The project enforces code quality automatically on each commit:

- **pre-commit** — runs `lint-staged`: ESLint fix + Prettier format on staged `src/**/*.ts` files
- **commit-msg** — enforces [Conventional Commits](https://www.conventionalcommits.org) format
- **pre-push** — runs type checking before any push

### Commit Message Format

```
<type>(<scope>): <short description>

Types: feat | fix | chore | docs | style | refactor | test | ci
```

Examples:
```
feat(auth): add Clerk provider integration
fix(cart): resolve duplicate item merge logic
chore(docker): update node version to 24
```

### Code Style

- **ESLint** with TypeScript rules and import ordering enforced
- **Prettier** for consistent formatting
- All rules are auto-applied on commit via `lint-staged`
