# E2E Integration Test Suite

Modern end-to-end integration test suite for the FDM Property-Client System powered by **Vitest** and **`@faker-js/faker`**.

Tests import and execute the actual functions in `lib/`, validating session cookies, Supabase Auth flows, PostgreSQL RLS policies, and database transactions under real-world scenarios.

---

## Directory Structure

```text
scripts/tests/
├── framework/
│   ├── vitest.setup.ts       # Runtime polyfills (cookies, Next.js header mocks, rate-limit backoff)
│   ├── empty-server-only.ts  # Node stub for Next.js server-only boundary
│   └── session.ts            # Temporary user provisioning, admin login, and cleanup hooks
├── utils/
│   └── utils.test.ts         # Role labels, color-mix derivations, Tailwind utils, self-protection guards
├── auth/
│   └── auth.test.ts          # Login, logout, user info, password updates, reset flows
├── admin/
│   ├── admin-user.test.ts    # User registration, listing, role assignments, ban toggle, deletion
│   └── admin-roles.test.ts   # System roles, role assignments, admin inspection, sidebar sections
├── clients/
│   └── clients.test.ts       # Client CRUD, search, status filters, contact info, documents, audit logs
├── properties/
│   └── properties.test.ts    # Property lot CRUD, unique constraints, client assignments, status transitions
├── permissions/
│   └── permissions-guard.test.ts # Role permissions, authorized callers, and mutation guards
└── run-all.ts                # Forwarder script for Vitest runner execution
```

---

## Running Tests

### 1. Remote Managed Supabase (Default)
Tests run against your remote managed Supabase project defined in `.env.test`. No local Docker containers or storage overhead required.

```bash
# Run all test suites
npm run test:e2e

# Run with interactive watch mode on file change
npm run test:e2e:watch

# Run a specific suite
npm run test:e2e:clients
npm run test:e2e:properties
npm run test:e2e:auth
npm run test:e2e:admin-user
npm run test:e2e:admin-roles
npm run test:e2e:permissions
npm run test:e2e:utils
```

### 2. Local Supabase Docker (Opt-In)
If you have Docker installed and sufficient local drive space (~3–5 GB), you can opt in to run tests against a local Supabase stack.

1. Start your local Supabase stack:
   ```bash
   npx supabase start
   ```

2. Run tests against the local instance:
   ```bash
   npm run test:e2e:local
   ```

3. When finished, reclaim disk space immediately:
   ```bash
   npx supabase stop --no-backup
   ```

---

## Dual Environment Configuration

| Profile | Config File | Invocation | Notes |
|---|---|---|---|
| **Remote Managed (Default)** | `.env.test` | `npm run test:e2e` | Uses remote project; rate-limit protected with auto-backoff |
| **Local Docker (Opt-in)** | `.env.test.local` | `npm run test:e2e:local` | Uses local Docker (`http://127.0.0.1:54321`); zero network latency |

`vitest.config.ts` automatically switches environment configurations based on the `TEST_ENV=local` flag.

