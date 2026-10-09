<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Stack Notes

- **UI components**: This project uses [shadcn/ui](https://ui.shadcn.com). Prefer composing from existing primitives in `components/ui/` before creating new ones. For full variant extension recipes and composition guidelines, refer to `.agents/skills/ui-components/SKILL.md`.
- **Mapping & GIS**: Subdivision plat plans and vector maps use MapLibre GL via `useMapLibreMap`. For SSR safeguards and worker asset configuration, refer to `.agents/skills/maplibre-gl/SKILL.md`.
- **FDM Domain & Titling Rules**: Core operational invariants, billing formulas, and titling lifecycle rules live in `.agents/skills/fdm-domain/SKILL.md`.

## UI Composition Invariants

- **The "Rule of 2"**: Never write long inline Tailwind utility chains for common visual archetypes across 2+ places; promote them to a primitive prop or variant in `components/ui/`.
- **Three-Tier Separation**: Strictly separate Primitives (`components/ui/`), Domain Mappings (`lib/`), and Domain Views (`components/dashboard-*/`).
- **No Redundant Overrides**: Do not pass inline classes that duplicate or contradict a component's built-in variants (e.g. `<Card>` already includes `bg-card`, `border-border`, and `rounded-xl`).
- See `.agents/skills/ui-components/SKILL.md` for CVA variant patterns, subcomponents, and Card conventions.

## Folder Structure

> **Keep this section up to date.** If the folder structure changes significantly (new top-level directories, major reorganization), rewrite this section to reflect the current layout.

```
fdm-system/
├── .agents/                    # Workspace agent customizations
│   └── skills/                 # Domain skills (ui-components, backend-architecture, maplibre-gl, fdm-domain)
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Auth route group (login)
│   ├── (dashboard)/            # Protected dashboard pages
│   │   └── dashboard/
│   │       └── admin/          # Admin-only page
│   ├── (marketing)/            # Public-facing marketing pages
│   ├── api/                    # Route handlers (ArcGIS token server)
│   ├── auth/                   # Auth API routes (confirm, sign-up, forgot/update password, error)
│   └── demo/                   # Demo page
├── components/
│   ├── auth/                   # Authentication forms & session controls
│   ├── dashboard-admin/        # User management, roles checklist & admin modals
│   ├── dashboard-clients/      # Client management table, modals & dialogs
│   ├── dashboard-layout/       # Dashboard shell (sidebar, top-bar, skeletons, page-container)
│   ├── dashboard-overview/     # Role-aware overview, record follow-ups, portfolio charts & quick links
│   ├── dashboard-properties/   # Property lots table & subdivision map components
│   ├── dashboard-settings/     # Dashboard settings forms
│   ├── dashboard-titles/       # Land title records (Legal page)
│   ├── landing/                # Landing page components (navbar, hero, features)
│   ├── shared/                 # Global cross-cutting shared brand & utility components
│   └── ui/                     # shadcn/ui primitives and custom base components
├── lib/
│   ├── actions/                # Server actions & action scopes (action-handler, auth guards, clients, properties, admin, reports)
│   ├── arcgis/                 # ArcGIS REST integration & token service
│   ├── hooks/                  # Client-side React hooks
│   ├── storage/                # Cloud storage integration helpers (Backblaze B2)
│   ├── supabase/               # Supabase client factories (browser, server, admin, proxy)
│   ├── types/                  # Domain TypeScript types (client, property, title, report)
│   ├── validations/            # Zod validation schemas and transform utilities
│   └── pagination.ts           # Shared offset & pagination calculation
├── scripts/                    # Standalone scripts & test suite
│   ├── seed-baseline.ts        # Baseline superadmin & system_admin role seeding
│   ├── seed-admin.ts           # Admin user seeding script (delegates to seed-baseline)
│   ├── seed-dev.ts             # Full development seeding (baseline + sample sites)
│   ├── seed-production.ts      # Production baseline seeding with Vercel env & safety guards
│   ├── seed-sample-site.ts     # Sample development sites & property subdivisions
│   └── tests/                  # Vitest E2E integration test suite
│       ├── framework/          # Setup, session management, Next.js mocks
│       ├── admin/              # User management & role tests
│       ├── arcgis/             # ArcGIS token service & auth guard tests
│       ├── auth/               # Authentication & password tests
│       ├── clients/            # Client CRUD, search, area, archive, documents & interaction tests
│       ├── properties/         # Property lot, map layout & positioning tests
│       ├── titles/             # Land title CRUD & property relationship tests
│       ├── reports/            # Operational summary report tests
│       ├── permissions/        # Permission & guard tests
│       └── utils/              # Pure utilities & self-protection tests
└── supabase/
    └── migrations/             # Ordered SQL migration files
```

## Auth & RBAC

Permissions live in the `rbac` Postgres schema (not `public`). Roles are `system_admin`, `admin_staff`, `billing_staff`, `legal_staff`, and `accounting_staff`. Permissions follow the pattern `<resource>.<action>` (e.g. `billing.read`, `system.create`). Use `hasPermission()` and `getUserPermissions()` from `lib/permissions.ts`. Don't query `rbac.*` tables directly. For admin self-protection rules, see `.agents/skills/backend-architecture/SKILL.md`.

## Server Actions & Action Scopes (`createScope`)

All server actions in `lib/actions/` must use `createScope` from `lib/actions/action-handler.ts` for unified authorization, Supabase client injection, Zod parsing, and error handling.

- **Query vs. Mutation**: Use `scope.query` for data fetching (throwing on error) and `scope.run` for mutations (returning `ActionResult<T>`).
- **Partial Updates**: Always apply `stripUndefined` from `lib/validations/client.ts` to partial update schemas to prevent clearing unset fields in the database.
- **File Directives**: Use `import "server-only";` in action builders and helpers. Reserve `"use server";` strictly for files exporting actual `async` server actions.
- See `.agents/skills/backend-architecture/SKILL.md` for complete scope inheritance patterns, permission guards, and query/mutation boilerplate.

## Supabase Clients

Three clients exist. Use the right one for the context:

| Client | File | Use when |
|---|---|---|
| Server client | `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers. Respects RLS |
| Admin client | `lib/supabase/admin.ts` | Server Actions only. **Bypasses RLS**, never import in client components |
| Proxy client | `lib/supabase/proxy.ts` | Middleware only. Refreshes session cookies |

Always instantiate a new client per request/function call; never store in a global variable (handled automatically when using `createScope`). Refer to `.agents/skills/backend-architecture/SKILL.md`.

## Environment Variables

All required vars must be set in `.env.local`. See `.env.example` for the full list:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key (safe for client) |
| `SUPABASE_SECRET_KEY` | Service role key. Server only, never expose to client |
| `S3_ENDPOINT` | S3-compatible endpoint (Supabase S3 in dev, Backblaze B2 in prod) |
| `S3_REGION` | Storage bucket region (e.g. `ap-southeast-1` or `us-west-004`) |
| `S3_BUCKET` | Storage bucket name (defaults to `client-documents`) |
| `S3_ACCESS_KEY_ID` | S3 Access Key ID / Backblaze B2 `keyID` — server only |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Access Key / Backblaze B2 `applicationKey` — server only |

## Database Migrations & Pre-Flight Introspection

- **Pre-Flight Introspection**: Before creating new database migrations, modifying schemas, or implementing backend Server Actions/RPCs, inspect existing live schema, triggers, and functions (via `npx supabase db diff --linked --schema public,rbac` or the catalog inspection queries in `.agents/skills/backend-architecture/SKILL.md`) to prevent drift, duplicate procedures, or conflicting trigger logic.
- **Migration Standards**: Migration files live in `supabase/migrations/` and must follow the naming convention `YYYYMMDDHHMMSS_description.sql`. Apply with `supabase db push` (remote) or `supabase migration up` (local). Never edit an already-applied migration. Create a new one instead. See `.agents/skills/backend-architecture/SKILL.md` for RLS policy standards and function retrieval instructions.

## Middleware Route Guard

`lib/supabase/proxy.ts` redirects unauthenticated users to `/login` only for paths starting with `/dashboard`. If you add a new protected route outside of `/dashboard/**`, update the path check in `proxy.ts` accordingly.

## Design Tokens

Never use hardcoded hex colors in `components/`. Use Tailwind semantic token classes (`bg-primary`, `text-foreground`, `border-border`, `bg-success`, etc.). For non-Tailwind contexts like Recharts SVG props, use CSS variable strings directly (e.g. `stroke="var(--border)"`).

Avoid Tailwind slash-opacity modifiers (e.g. `bg-primary/90`, `bg-success/10`) because tokens in `globals.css` are hex values, causing invalid `rgb(#hex / alpha)` syntax in browsers. For tints and hover shades, use CSS `color-mix()` with complete, unbroken class literals (e.g. `bg-[color-mix(in_srgb,var(--success)_15%,white)]`). Never dynamically construct class names via interpolation (e.g. `bg-[${tint}]`), as Tailwind's static compiler will not detect them.

## `useMutation` Hook

`lib/hooks/use-mutation.ts` wraps any async function and returns `{ state, execute, reset }`. `state` is a discriminated union: `idle | pending | success | error`. The wrapped function must throw on failure. Do not return error objects. `execute` returns `Promise<boolean>` for imperative flow control when needed.

## Component Organization & Naming Conventions

All component folders must remain strictly **1 level deep** directly under `components/`. Never create nested subfolders inside component folders (e.g. do **NOT** create `components/dashboard-properties/maps/`).

- **Dashboard Domains**: Use the `dashboard-<plural-feature>` prefix (e.g. `dashboard-clients`, `dashboard-properties`, `dashboard-admin`, `dashboard-overview`, `dashboard-layout`, `dashboard-settings`).
- **Subcategories via Filename Prefixes**: If a feature has a distinct subcategory, prefix the filenames rather than nesting subfolders (e.g. `map-site.tsx`, `map-site-editor.tsx` inside `components/dashboard-properties/`).
- **Cross-App Assets**: Shared global brand/utility components live in `components/shared/`.
- **Auth Forms**: Public authentication, reset, and password recovery forms live in `components/auth/`.
- **Direct Imports**: Always import components directly from their file path without barrel `index.ts` files (e.g. `@/components/dashboard-clients/client-section`).

## Admin Panel Data Layer

`lib/hooks/use-admin-users.ts` is the sole file that imports server actions and calls `router.refresh()` for the admin panel. UI components under `components/dashboard-admin/` must not import from `lib/actions/` directly. Consume data and mutations through the `useAdminUsers()` context hook instead.

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
  - `npm run test:e2e`: run the full suite
  - `npm run test:e2e:watch`: run Vitest interactive watch mode on file changes
  - `npm run test:e2e:<suite>` (e.g. `test:e2e:clients`, `test:e2e:properties`, `test:e2e:auth`): run a specific suite