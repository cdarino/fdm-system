---
name: backend-architecture
description: Comprehensive backend architecture guide for Next.js, Supabase, Server Actions (createScope), RBAC permissions, database migrations, Route Handlers, and external service integrations (ArcGIS, Backblaze B2). Use this skill when implementing, refactoring, or testing any backend service, data mutation, database migration, API route, or authorization check.
---

# Backend Architecture & Services

This skill provides guidelines, architectural patterns, and security practices for the entire backend layer of the application.

---

## 1. Server Actions & Action Scopes (`createScope`)

All Server Actions in `lib/actions/` must use `createScope` from `lib/actions/action-handler.ts` for unified authorization, request-bound Supabase client creation, input validation, and standardized responses.

### Scope Definition & Inheritance
Define a base scope per domain resource and extend it for mutations:
```ts
import "server-only";
import { createScope } from "@/lib/actions/action-handler";

const client = createScope(["clients.read"]);
const clientWrite = client.extend(["clients.update"]);
```

### Data Queries (`scope.query`)
Used for data fetching (Server Components or client hooks). Verifies scope permissions, injects `{ supabase, userId }`, and returns data directly or throws on error:
```ts
export async function getClientById(id: string) {
  return client.query(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  });
}
```

### Mutations (`scope.run`)
Used for mutations returning `ActionResult<T>`. Parses Zod schemas (returns `actionZodError` on failure), injects `{ supabase, userId }`, and automatically wraps returns in `actionSuccess` or `actionError`:
```ts
export async function updateClient(clientId: string, input: unknown) {
  return clientWrite.run({
    schema: updateClientSchema,
    input,
    handler: async (data, { supabase }) => {
      const { data: updated, error } = await supabase
        .from("clients")
        .update(data)
        .eq("id", clientId)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
  });
}
```

### Action-Specific Permissions
Pass `permissions` to `scope.run(...)` or `scope.query(...)` for additive permissions:
```ts
export async function deleteClient(clientId: string) {
  return clientWrite.run({
    permissions: ["clients.delete"],
    handler: async (_data, { supabase }) => {
      // delete logic
    },
  });
}
```

### Partial Updates & Undefined Stripping
Always use `stripUndefined` from `lib/validations/client.ts` on partial Zod schemas (e.g. `schema.partial().transform(stripUndefined)`) to avoid wiping unset database columns.

### File Directives
- **Action helpers / builders**: Use `import "server-only";`, NOT `"use server";`.
- **Action endpoints**: Reserve `"use server";` exclusively for files exporting actual `async` server action entrypoints.

---

## 2. Auth, RBAC & Security Guards

### RBAC Schema
- Permissions live in the `rbac` Postgres schema (not `public`).
- **Roles**: `system_admin`, `admin_staff`, `billing_staff`, `legal_staff`, `accounting_staff`.
- **Permission Pattern**: `<resource>.<action>` (e.g. `billing.read`, `system.create`, `clients.delete`).
- **Resolution**: Use `hasPermission()` and `getUserPermissions()` from `lib/permissions.ts`. Never query `rbac.*` tables directly in application code.

### Self-Protection & Guard Utilities
Admin operations must enforce safeguards from `lib/self-protection.ts`:
- `checkSelfDelete(currentUserId, targetUserId)`
- `checkSelfDeactivate(currentUserId, targetUserId, nextStatus)`
- `checkSelfDemote(currentUserId, targetUserId, newRoles)`

---

## 3. Supabase Clients & Data Access

Three distinct client factories exist. Choose the right one for the execution context:

| Client | File | Purpose & Lifecycle |
|---|---|---|
| **Server Client** | `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers. **Respects RLS policies**. |
| **Admin Client** | `lib/supabase/admin.ts` | Server Actions & seed scripts only. **Bypasses RLS** using service role key. Never import in client components. |
| **Proxy Client** | `lib/supabase/proxy.ts` | Middleware only. Refreshes auth session cookies on protected route requests. |

*Always instantiate a new client per request/function invocation; never store clients in module-level global variables (handled automatically by `createScope`).*

---

## 4. Database Migrations & Schemas

### Migration Standards
- **Location**: `supabase/migrations/`
- **Naming**: Must follow `YYYYMMDDHHMMSS_description.sql`.
- **Immutability**: Never edit an already-applied migration. Create a new forward migration instead.
- **Row Level Security**: Every table in the `public` and `rbac` schemas must enable RLS (`alter table <name> enable row level security;`) with explicit policies for authenticated and service-role access.
- **Multi-Schema Scope**: Tables and functions span both `public` and `rbac` schemas. Ensure both schemas are targeted in migrations, diffs, and CLI operations.

### Declarative Schema & Introspection
While `supabase/migrations/` remains the authoritative source of truth for applied database changes, the linked remote database can be inspected declaratively:

- **Modular Declarative Tree (`pg-delta`)**:
  Generates a full declarative schema tree (tables, functions, types, cluster extensions) organized by schema without modifying migration history:
  ```bash
  npx supabase db schema declarative generate --linked --output-dir ./supabase/schemas
  ```
- **Consolidated DDL Dump**:
  Dumps the current live schema (DDL statements, RLS policies, indexes) into a single SQL snapshot:
  ```bash
  npx supabase db dump --linked --schema public,rbac -f supabase/schema.sql
  ```

### Drift Detection & Type Generation
- **Schema Drift Check**:
  Compare local migrations against the linked remote database to detect uncommitted or remote-only changes:
  ```bash
  npx supabase db diff --linked --schema public,rbac
  ```
- **TypeScript Type Generation**:
  Generate TypeScript database types directly from the linked remote project:
  ```bash
  npx supabase gen types typescript --linked --schema public,rbac > lib/types/database.ts
  ```

### Retrieving Postgres Functions & RPCs

To inspect or extract all Postgres functions (stored procedures and RPCs) from a Supabase project:

1. **System Catalog SQL Query (Complete Definitions & Signatures)**:
   Run in the Supabase SQL Editor or via a query client to list all functions with arguments, return types, and complete source code:
   ```sql
   select
     n.nspname as schema_name,
     p.proname as function_name,
     pg_get_function_arguments(p.oid) as arguments,
     pg_get_function_result(p.oid) as return_type,
     l.lanname as language,
     pg_get_functiondef(p.oid) as definition
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   join pg_language l on l.oid = p.prolang
   where n.nspname in ('public', 'rbac')
   order by schema_name, function_name;
   ```

2. **Supabase CLI Declarative Extraction**:
   Extracts all functions into individual `.sql` files organized under `supabase/schemas/<schema>/functions/`:
   ```bash
   npx supabase db schema declarative generate --linked --output-dir ./supabase/schemas
   ```

3. **PostgREST OpenAPI Introspection**:
   Fetch all callable RPC endpoints exposed over the REST API by requesting the root OpenAPI schema:
   ```bash
   curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" \
     -H "apikey: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}" \
     -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}"
   ```

---

## 5. Route Handlers & External Service Integrations

### Next.js Route Handlers (`app/api/`)
- Used for external webhooks, token exchanges, and non-action HTTP endpoints (e.g. `app/api/arcgis/token/route.ts`).
- Validate incoming headers, cookies, or auth tokens before processing requests.

### ArcGIS Integration (`lib/arcgis/`)
- Integrates with ArcGIS REST services for GIS mapping, layer token generation, and geospatial geometry fetching.
- Securely stores client secrets on the server and generates short-lived OAuth tokens.

### Cloud Storage (`lib/storage/`)
- Backblaze B2 / S3-compatible storage helpers for client document uploads, land titles, and OCR attachments.
- Generates presigned URLs for secure client uploads and private file downloads.

---

## 6. Client Consumption Pattern (`useMutation`)

Client components consume backend mutations through `lib/hooks/use-mutation.ts`:
- Returns `{ state, execute, reset }` where `state` is `idle | pending | success | error`.
- Server action calls wrapped by `useMutation` must throw on error.
- `execute` returns `Promise<boolean>` for imperative flow control in forms and dialogs.

---

## 7. Extension & In-Depth Rules (To be expanded)

<!-- Add in-depth learnings, transaction patterns, RPC definitions, and complex query optimizations here -->
