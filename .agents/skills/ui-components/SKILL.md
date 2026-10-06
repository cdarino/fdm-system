---
name: ui-components
description: Guidelines, composition rules, and variant extension recipes for shadcn/ui primitives, Tailwind CSS tokens, and domain UI views. Use this skill when creating, extending, or refactoring UI components, styling variants, or compound components.
---

# UI Components & Styling Guidelines

This skill provides architectural rules, composition patterns, and extension recipes for UI components across the application.

## Three-Tier Component Separation

Maintain strict separation between primitives, domain mappings, and views:

1. **Primitives (`components/ui/`)**: Strictly domain-agnostic props (`variant`, `shape`, `size`, `dot`). No business concepts (e.g. no "lot status" or "client badge").
2. **Domain Mapping (`lib/`)**: Dictionaries and helpers translating models to primitive props (e.g. `PROPERTY_STATUS_VARIANT` in `lib/status-colors.ts`).
3. **Domain Views (`components/dashboard-*/`)**: Compose primitives. Never hand-roll custom container `div`s when a primitive exists.

## Component Directory & File Naming Conventions

All component folders must remain strictly **1 level deep** directly under `components/`. Never create nested subfolders inside component folders (e.g. do **NOT** create `components/dashboard-properties/maps/`).

- **Dashboard Domains**: Use the `dashboard-<plural-feature>` prefix (e.g. `dashboard-clients`, `dashboard-properties`, `dashboard-admin`, `dashboard-overview`, `dashboard-layout`, `dashboard-settings`).
- **Subcategories via Filename Prefixes**: If a feature has a distinct subcategory, prefix the filenames rather than nesting subfolders (e.g. `map-site.tsx`, `map-site-picker.tsx` inside `components/dashboard-properties/`).
- **Cross-App Assets**: Shared global brand/utility components live in `components/shared/`.
- **Auth Forms**: Public authentication, reset, and password recovery forms live in `components/auth/`.
- **Direct Imports**: Always import components directly from their file path without barrel `index.ts` files (e.g. `@/components/dashboard-clients/client-section`).

## The "Rule of 2" for Long Utility Chains

Never write long inline Tailwind utility chains (e.g. `flex items-center gap-2 rounded-... bg-[color-mix...]`) for common visual archetypes. If a visual pattern appears in 2+ places or represents a recognized UI role (status pill, callout banner, icon container, filter toolbar), promote it to a primitive prop or variant in `components/ui/`.

## When to Extend vs. Create

- **Extend with variant/prop**: If it is an alternative visual style or state of an existing element (e.g. adding `quiet` or `canvas` to `Button`, `shape="pill"` to `Badge`, `responsive` boolean prop).
- **Add a subcomponent**: If it represents a recurring structural slot in a compound component (e.g. `CardToolbar`, `CardTableFooter` in `Card`).
- **Add a new primitive**: Only if it represents a distinct semantic HTML role or standalone composite not covered by shadcn primitives (e.g. `Alert`, `IconBox`).
- **No Redundant Overrides**: Do not pass inline classes that duplicate or contradict a component's built-in variants (e.g. do not pass `className="bg-primary hover:..."` to `<Button variant="default">` or `className="border-border-warm..."` to `<Button variant="quiet">`). If a pattern needs two or more overrides across elements, promote it to a variant in `components/ui/`.

## The Two-Surface Model: Card vs. Canvas Surfaces

The application architecture distinguishes between two primary surface archetypes:

1. **Card Surfaces (`bg-card` = `#FFFFFF`)**:
   - Containers living atop the beige page background.
   - Use standard cool border `--border` (`#E2E7EC`, `border-border`).
   - Use `--row-hover` (`#F5F3EC`, warm cream) for list and row hover tints.
   - Use `Button variant="quiet"` for calm secondary buttons.

2. **Canvas Surfaces (`bg-background` = `#F5F3EC`)**:
   - Elements placed directly on the page background outside of white cards (e.g. page-level sidebars, dividers, or canvas cards).
   - **Never use cool `--border` on canvas**: `#E2E7EC` clashes with warm cream and has an unreadable ~1.09:1 contrast ratio. Use `--border-warm` (`#D8D0C0`, `border-border-warm`), `--border-warm-subtle`, or `--border-warm-strong`.
   - **Never use `hover:bg-row-hover` directly on canvas**: `--row-hover` is `#F5F3EC`, resulting in zero contrast against the canvas background. Group canvas items inside `<Card variant="canvas">` so `bg-card` restores row hover contrast.
   - Use dedicated canvas primitive variants: `<Card variant="canvas">`, `<Button variant="canvas">`, `<Badge variant="outline-warm">`, and `<IconBox variant="canvas">`.

## CVA Variant Architecture & The Anti-Matrix Principle

When adding variants via `class-variance-authority` (CVA), avoid combinatorial 2D compound matrices (e.g. `variant` × `color` with dozens of `compoundVariants`).

### Why 2D Matrices Fail
- **Guesswork**: Callers must guess which colors look right with which variant styles (`soft` vs `solid`).
- **Boilerplate**: Matrices require 20+ lines of combinatorial CSS definitions that inflate bundle size.
- **Inconsistency**: Other primitives (`Button`, `Alert`) use a single purpose-driven `variant` list.

### Purposeful Variants with Orthogonal Modifiers
Use a single semantic `variant` list representing intent, and separate orthogonal layout/geometry concerns into independent props:

```tsx
// Good: Single purpose-driven variant list + orthogonal modifiers
<Badge variant="success" shape="pill" dot>Active</Badge>
<Badge variant="warning" shape="pill" dot>Sold</Badge>
<Badge variant="destructive" shape="pill" dot>Forfeited</Badge>
```

Domain models map directly to these variants in `lib/`:
```ts
// lib/status-colors.ts
export const PROPERTY_STATUS_VARIANT: Record<PropertyStatus, 'success' | 'info' | 'warning' | 'destructive'> = {
  Open: 'success',
  Reserved: 'info',
  Sold: 'warning',
  Forfeited: 'destructive',
};
```

## Design Tokens & Color Styling

- **Semantic Tokens**: Use Tailwind semantic token classes (`bg-primary`, `text-foreground`, `border-border`, `bg-success`). Never use hardcoded hex colors.
- **Hex Variable Constraint**: Tokens in `globals.css` are hex values (e.g. `#173f35`). Tailwind slash-opacity modifiers (`bg-primary/90`) compile to invalid `rgb(#hex / alpha)` in modern browsers.
- **CSS `color-mix()`**: For surface tints and hover shades, use CSS `color-mix()` with complete, unbroken class literals:
  ```tsx
  // Tint surface:
  className="bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success"
  
  // Hover darken:
  className="hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)]"
  ```
- **Unbroken Literals Only**: Never dynamically construct class names via string interpolation (e.g. `bg-[${color}]`), as Tailwind's static compiler cannot detect dynamic strings.
- **Non-Tailwind Contexts**: In Recharts SVG props or canvas elements, use CSS variable strings directly:
  ```tsx
  <XAxis stroke="var(--border)" tick={{ fill: 'var(--muted-foreground)' }} />
  ```

## UI Primitives Reference & Usage Recipes

### 1. Badge (`components/ui/badge.tsx`)
Encapsulates status indicators, category tags, and pill badges.
- **Variants**: `default`, `secondary`, `outline`, `outline-warm` (warm border for canvas), `canvas` (card fill with warm border), `success`, `warning`, `info`, `destructive`, `muted`
- **Shape**: `default` (`rounded-md`), `pill` (`rounded-full font-medium`)
- **Dot**: `dot?: boolean` automatically coordinates dot color with the chosen `variant`.

```tsx
import { Badge } from "@/components/ui/badge";
import { PROPERTY_STATUS_VARIANT } from "@/lib/status-colors";

<Badge variant={PROPERTY_STATUS_VARIANT[status]} shape="pill" dot>
  {status}
</Badge>
```

### 2. Button (`components/ui/button.tsx`)
Standard action trigger across interactive surfaces.
- **Variants**:
  - `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
  - `quiet`: Neutral surface outline (`border-border bg-card text-foreground hover:bg-row-hover`).
  - `canvas`: Warm border outline for elements on beige canvas (`border-border-warm bg-card text-foreground shadow-xs hover:bg-row-hover`).
  - `danger`: Quiet outline with destructive text and soft red hover tint.
  - `success`: Solid green action button.
- **Responsive**: `responsive?: boolean` adds `w-full sm:w-auto` for mobile-friendly toolbars.

```tsx
// Calm secondary action in table toolbar:
<Button variant="quiet" onClick={onClear}>Clear filters</Button>

// Calm action on beige background canvas:
<Button variant="canvas" size="sm">Record</Button>

// Responsive primary trigger:
<Button responsive onClick={onOpenModal}>Create Client</Button>
```

### 3. Card & Compound Table Layouts (`components/ui/card.tsx`)
Encapsulates base borders (`border-border` or `border-border-warm`), surfaces (`bg-card`), and elevation across containers.
- **Variants**: `default`, `section` (flex full height), `interactive` (hover shadow), `prominent` (rounded-2xl shadow-lg), `dashed` (dropzones), `canvas` (warm border and subtle shadow for placement directly on beige canvas).
- **Padding**: `none`, `sm` (`p-3`), `default` (`p-6`), `lg` (`p-8`).
- **Subcomponents**:
  - `CardToolbar`: Standardizes responsive table filter bars (`px-4 pb-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between`).
  - `CardTableFooter`: Standardizes table bottom bars (`px-4 py-3 sm:px-6 border-t border-border flex items-center justify-between`).

```tsx
<Card variant="canvas" padding="sm">
  <CardTitle size="sm">Client Profile</CardTitle>
</Card>
```

### 4. Alert (`components/ui/alert.tsx`)
Standard shadcn primitive for banners, validation summaries, and status feedback.
- **Components**: `Alert`, `AlertTitle`, `AlertDescription`
- **Variants**: `default`, `destructive`, `warning`, `success`, `info`

```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Validation Error</AlertTitle>
  <AlertDescription>{errorMessage}</AlertDescription>
</Alert>
```

### 5. IconBox (`components/ui/icon-box.tsx`)
Standard container for icon rings, thumbnails, and avatar placeholders.
- **Variants**: `default` (cool border ring), `canvas` (accent background with warm ring), `warm` (card background with warm ring)
- **Size**: `sm` (`h-7 w-7`), `default` (`h-8 w-8`), `md` (`h-9 w-9`), `lg` (`h-11 w-11`)
- **Shape**: `square` (`rounded-lg`), `circle` (`rounded-full`), `rounded-md`, `rounded-xl`

```tsx
<IconBox variant="canvas" size="lg" shape="rounded-xl">
  <UserRound className="h-5 w-5" />
</IconBox>
```

### 6. FilterToolbar (`components/ui/filter-toolbar.tsx`)
Declarative filter bar primitive unifying status tabs, clearable search inputs, dropdown/searchable filters (`single-select`, `multi-select`, `searchable`, `custom`), view mode toggles, and filter reset buttons. Also exports sub-parts (`FilterToolbarTabs`, `FilterToolbarSearch`, `FilterToolbarFilterControl`, `FilterToolbarViewToggle`) for custom layouts.
- **Variants**: `default` (horizontal responsive bar built on `CardToolbar`), `stacked` (compact multi-row layout for narrow sidebars like the map panel).

```tsx
<FilterToolbar
  tabs={{
    value: statusFilter,
    onChange: setStatusFilter,
    items: [
      { value: 'all', label: 'All', count: counts.all },
      { value: 'Active', label: 'Active', count: counts.Active },
    ],
  }}
  search={{
    value: search,
    onChange: setSearch,
    placeholder: 'Search records...',
  }}
  isFiltered={isFiltered}
  onClear={clearFilters}
/>
```

## Historical UI Patterns

These patterns were established in past refactoring commits and should be preserved:

### 1. Skeleton Loaders over Spinners (`components/dashboard-layout/page-skeletons.tsx`)
- Never use generic loading spinners for page-level or table-level data loads.
- Compose domain skeleton rows using `Skeleton` (`components/ui/skeleton.tsx`) to prevent layout shifts:
  ```tsx
  {isLoading ? <PropertyRowsSkeleton count={5} /> : data.map(...)}
  ```

### 2. Modals & Accessible Form Composition
- Always compose dialogs using `components/ui/dialog` (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`).
- Bind `react-hook-form` + `zod` via `@hookform/resolvers/zod`.
- Render field errors using `FormField` (`components/ui/form-field.tsx`) with the `error` prop:
  ```tsx
  <FormField label="Email Address" error={errors.email?.message} required>
    <Input {...register("email")} />
  </FormField>
  ```

### 3. Clearable Search & Filter Bar UX
- Prefer `<FilterToolbar>` (`components/ui/filter-toolbar.tsx`) for table and sidebar filter bars instead of hand-rolling local `StatusTabs` or search inputs.
- Provide instant clear affordances (`SearchX` or `X` icon button) inside search inputs when query is non-empty.

### 4. Dense Pane Action Invariant (Floating Popovers over Accordions)
- Never use inline expanding accordion forms for creating or recording entries inside narrow sidebars or scrollable timeline containers.
- Expanding forms push chronological logs down, displace scroll positions, and induce layout jitter.
- Secondary entity creation and rapid editing forms (e.g. "Record activity", "Add contact", "Quick note") must use anchored floating panels (`<Popover side="right" align="start" sideOffset={8}>`).

### 5. Operational Density in Multistep Wizards (Zero-Fluff Rule)
- Never consume vertical space with redundant title/subtitle banners inside embedded tab wizards when the parent tab list or page header already provides context.
- Consolidate selection triggers, in-flow creation buttons (e.g. `+ New Lot`), and selected item metadata chips (`150 sqm · ₱5,000/sqm`) into a single, compact header row.
- Ensure Step 2 and primary operational cards appear above the fold without requiring initial scrolling.

### 6. Modal Decoupling for Cross-Domain Flows
- Dialogs used to create entities within another domain's workflow (e.g. creating a property lot while assigning a client) must **never** depend on domain-specific React Context providers (such as `PropertyLotsProvider`).
- Implement cross-domain creation modals as standalone controlled components (`open`, `onOpenChange`, `onSuccess: (entity) => void`) that call backend Server Actions directly, update local state optimistically, and auto-select the newly created record.

## Reserved Pitfalls ("Don't"s)

Reserved strictly for critical pitfalls that cause visual breakage or code bloat:

- **DON'T use cool `--border` (`border-border`) on the beige background canvas**: Always use `--border-warm` (`border-border-warm`) or primitive canvas variants (`<Card variant="canvas">`, `<Button variant="canvas">`, `<Badge variant="outline-warm">`).
- **DON'T use `hover:bg-row-hover` directly on the canvas background**: `--row-hover` matches the `#F5F3EC` page background; wrap interactive rows in `<Card variant="canvas">` (`bg-card`) so row hover contrast is preserved.
- **DON'T use expanding accordion forms in dense sidebars**: Use anchored floating `<Popover>` components to preserve scroll and timeline stability.
- **DON'T introduce redundant banner titles in embedded wizards**: Consolidate selection, creation, and item metadata into a single compact header line.
- **DON'T couple cross-domain creation modals to page-specific context providers**: Keep modal dialogs decoupled and powered by server actions.
- **DON'T use Tailwind slash-opacity (`bg-primary/90`)**: Causes invalid CSS syntax with hex variables in `globals.css`.
- **DON'T dynamically construct class names (`bg-[${tint}]`)**: Tailwind will not compile dynamic strings into CSS.
- **DON'T duplicate built-in variant classes**: Never pass `className="bg-card rounded-xl border-border"` to `<Card>` or `className="bg-primary"` to `<Button variant="default">`.
- **DON'T hand-roll modal backdrops or overlays**: Never render custom absolute/fixed overlay divs; always use `<Dialog>`.
- **DON'T create 2D combinatorial variant matrices on primitives**: Never define orthogonal axes (`variant` × `color`) with dozens of CVA combinations; use single purposeful variants with modifier props.
- **DON'T nest subfolders inside component directories**: Keep all component folders strictly 1 level deep directly under `components/`. Use filename prefixes (e.g. `map-*` inside `dashboard-properties/`) for subcategories.
- **DON'T use barrel `index.ts` files**: Always import directly from component file paths (e.g. `@/components/dashboard-clients/client-section`) for tree-shaking and App Router boundary safety.

## Pattern Evolution & Pragmatism

Guidelines and patterns in this skill reflect established consensus, but they are living standards rather than immutable dogma:

1. **Autonomy to Adapt**: When novel requirements arise (e.g. specialized GIS map inspectors, complex multi-step financial wizards, bespoke chart cards) that do not neatly fit existing primitives, agents and developers are empowered to introduce modified or extended versions of existing patterns.
2. **Preserve Invariants**: When introducing new patterns, always preserve the fundamental invariants:
   - Zero broken CSS (no slash-opacity on hex tokens, unbroken `color-mix()` literals).
   - Domain-agnostic separation in `components/ui/`.
   - Accessible keyboard and screen reader primitives (`Dialog`, `Alert`, ARIA attributes).
3. **Promote Back to the System**: If a modified pattern proves recurring (used in 2+ places) or clearly superior to an older pattern, promote it to a primitive or variant and update this skill document accordingly.

