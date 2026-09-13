<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Stack Notes

- **UI components**: This project uses [shadcn/ui](https://ui.shadcn.com). New UI components should follow shadcn conventions — prefer composing from existing primitives in `components/ui/` before creating new ones, and use the shadcn CLI (`npx shadcn@latest add <component>`) to add any missing ones.

## Folder Structure

> **Keep this section up to date.** If the folder structure changes significantly — new top-level directories, major reorganization — rewrite this section to reflect the current layout.

```
fdm-system/
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Auth route group (login)
│   ├── (dashboard)/            # Protected dashboard pages
│   │   └── dashboard/
│   │       └── admin/          # Admin-only page
│   ├── (marketing)/            # Public-facing marketing pages
│   ├── auth/                   # Auth API routes (confirm, sign-up, forgot/update password, error)
│   └── demo/                   # Demo page
├── components/
│   ├── dashboard/              # Dashboard-specific components (sidebar, charts, modals, etc.)
│   ├── landing/                # Landing page components (navbar, hero, features)
│   ├── tutorial/               # Tutorial/onboarding components
│   └── ui/                     # shadcn/ui primitives and custom base components
├── lib/
│   ├── actions/                # Server actions (auth guards, admin user/role management)
│   ├── hooks/                  # Client-side React hooks
│   ├── supabase/               # Supabase client factories (browser, server, admin, proxy)
│   └── pagination.ts           # Shared offset & pagination calculation
├── scripts/                    # Standalone scripts & test suite
│   ├── seed-admin.ts           # Admin user seeding script
│   └── tests/                  # Vitest E2E integration test suite
│       ├── framework/          # Setup, session management, Next.js mocks
│       ├── admin/              # User management & role tests
│       ├── auth/               # Authentication & password tests
│       ├── clients/            # Client CRUD & relationship tests
│       ├── properties/         # Property lot & assignment tests
│       ├── permissions/        # Permission & guard tests
│       └── utils/              # Pure utilities & self-protection tests
└── supabase/
    └── migrations/             # Ordered SQL migration files
```

## Auth & RBAC

Permissions live in the `rbac` Postgres schema (not `public`). Roles are `system_admin`, `admin_staff`, `billing_staff`, `legal_staff`, and `accounting_staff`. Permissions follow the pattern `<resource>.<action>` (e.g. `billing.read`, `system.create`). Use `hasPermission()` and `getUserPermissions()` from `lib/permissions.ts` — don't query `rbac.*` tables directly.

## Supabase Clients

Three clients exist — use the right one for the context:

| Client | File | Use when |
|---|---|---|
| Server client | `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers — respects RLS |
| Admin client | `lib/supabase/admin.ts` | Server Actions only — **bypasses RLS**, never import in client components |
| Proxy client | `lib/supabase/proxy.ts` | Middleware only — refreshes session cookies |

Always instantiate a new client per request/function call; never store in a global variable.

## Environment Variables

All required vars must be set in `.env.local`. See `.env.example` for the full list:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key (safe for client) |
| `SUPABASE_SECRET_KEY` | Service role key — server only, never expose to client |

## Database Migrations

Migration files live in `supabase/migrations/` and must follow the naming convention `YYYYMMDDHHMMSS_description.sql`. Apply with `supabase db push` (remote) or `supabase migration up` (local). Never edit an already-applied migration — create a new one instead.

## Middleware Route Guard

`lib/supabase/proxy.ts` redirects unauthenticated users to `/login` only for paths starting with `/dashboard`. If you add a new protected route outside of `/dashboard/**`, update the path check in `proxy.ts` accordingly.

## Design Tokens

Never use hardcoded hex colors in `components/`. Use Tailwind semantic token classes (`bg-primary`, `text-foreground`, `border-border`, `bg-success`, etc.). For non-Tailwind contexts like Recharts SVG props, use CSS variable strings directly (e.g. `stroke="var(--border)"`).

Avoid Tailwind slash-opacity modifiers (e.g. `bg-primary/90`, `bg-success/10`) because tokens in `globals.css` are hex values, causing invalid `rgb(#hex / alpha)` syntax in browsers. For tints and hover shades, use CSS `color-mix()` with complete, unbroken class literals (e.g. `bg-[color-mix(in_srgb,var(--success)_15%,white)]`). Never dynamically construct class names via interpolation (e.g. `bg-[${tint}]`), as Tailwind's static compiler will not detect them.

## `useMutation` Hook

`lib/hooks/use-mutation.ts` wraps any async function and returns `{ state, execute, reset }`. `state` is a discriminated union: `idle | pending | success | error`. The wrapped function must throw on failure — do not return error objects. `execute` returns `Promise<boolean>` for imperative flow control when needed.

## Admin Panel Data Layer

`lib/hooks/use-admin-users.ts` is the sole file that imports server actions and calls `router.refresh()` for the admin panel. UI components under `components/dashboard/` must not import from `lib/actions/` directly — consume data and mutations through the `useAdminUsers()` context hook instead.

## Forms & Validation

Use `react-hook-form` with `zod` via `@hookform/resolvers/zod`. Derive input types with `z.infer<typeof schema>` and pass field errors to `FormField`'s `error` prop.

## Modals & Dialogs

Always compose modals using `components/ui/dialog` (`Dialog`, `DialogContent`, etc.). Never hand-roll custom backdrop overlays.

## Pagination

Use `getPaginationOffsets()` and `buildPaginatedResult()` from `lib/pagination.ts` for database range queries and pagination metadata.

## Testing & E2E Test Suite

Tests use **Vitest** and **`@faker-js/faker`** located under `scripts/tests/`. Rather than mocking backend queries, tests directly import and execute functions in `lib/` (Server Actions, auth functions, permission guards) against a real database using emulated sessions and cookies.

- **Dual Environments**:
  - **Remote Managed (Default)**: Tests run via `.env.test` against the cloud Supabase project with zero local container storage footprint.
  - **Local Docker (Opt-in)**: Runs via `npm run test:e2e:local` pointing to `.env.test.local` if `supabase start` is running.
- **Sequential Pacing**: `vitest.config.ts` enforces `fileParallelism: false` and `maxConcurrency: 1` to prevent database race conditions on shared tables and avoid GoTrue auth rate limits.
- **Session & Headers Emulation**: `scripts/tests/framework/vitest.setup.ts` mocks `next/headers` (`cookies()`, `headers()`) and keeps an in-memory cookie jar synced with `@supabase/ssr`.
- **Commands**:
  - `npm run test:e2e` — run the full suite
  - `npm run test:e2e:watch` — run Vitest interactive watch mode on file changes
  - `npm run test:e2e:<suite>` (e.g. `test:e2e:clients`, `test:e2e:properties`, `test:e2e:auth`) — run a specific suite