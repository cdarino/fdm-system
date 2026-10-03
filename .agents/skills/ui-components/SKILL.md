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

## The "Rule of 2" for Long Utility Chains

Never write long inline Tailwind utility chains (e.g. `flex items-center gap-2 rounded-... bg-[color-mix...]`) for common visual archetypes. If a visual pattern appears in 2+ places or represents a recognized UI role (status pill, callout banner, icon container, filter toolbar), promote it to a primitive prop or variant in `components/ui/`.

## When to Extend vs. Create

- **Extend with variant/prop**: If it is an alternative visual style or state of an existing element (e.g. adding `quiet` to `Button`, `shape="pill"` to `Badge`, `responsive` boolean prop).
- **Add a subcomponent**: If it represents a recurring structural slot in a compound component (e.g. `CardToolbar`, `CardTableFooter` in `Card`).
- **Add a new primitive**: Only if it represents a distinct semantic HTML role or standalone composite not covered by shadcn primitives (e.g. `Alert`, `IconBox`).
- **No Redundant Overrides**: Do not pass inline classes that duplicate or contradict a component's built-in variants (e.g. do not pass `className="bg-primary hover:..."` to `<Button variant="default">`).

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
- **Variants**: `default`, `secondary`, `outline`, `success`, `warning`, `info`, `destructive`, `muted`
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
  - `danger`: Quiet outline with destructive text and soft red hover tint.
  - `success`: Solid green action button.
- **Responsive**: `responsive?: boolean` adds `w-full sm:w-auto` for mobile-friendly toolbars.

```tsx
// Calm secondary action in table toolbar:
<Button variant="quiet" onClick={onClear}>Clear filters</Button>

// Responsive primary trigger:
<Button responsive onClick={onOpenModal}>Create Client</Button>
```

### 3. Card & Compound Table Layouts (`components/ui/card.tsx`)
Encapsulates base borders (`border-border`), surfaces (`bg-card`), and elevation across containers.
- **Variants**: `default`, `section` (flex full height), `interactive` (hover shadow), `prominent` (rounded-2xl shadow-lg), `dashed` (dropzones).
- **Padding**: `none`, `default` (`p-6`), `lg` (`p-8`).
- **Subcomponents**:
  - `CardToolbar`: Standardizes responsive table filter bars (`px-4 pb-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between`).
  - `CardTableFooter`: Standardizes table bottom bars (`px-4 py-3 sm:px-6 border-t border-border flex items-center justify-between`).

```tsx
<Card variant="section" className="border-border">
  <div className="flex items-center justify-between p-4 sm:p-6">
    <CardTitle>Properties</CardTitle>
  </div>
  <CardToolbar>
    <StatusTabs value={status} onChange={setStatus} />
    <div className="flex items-center gap-2">
      <Input placeholder="Search..." />
    </div>
  </CardToolbar>
  <div className="flex-1 overflow-y-auto border-t border-border">
    <Table>...</Table>
  </div>
  <CardTableFooter>
    <p className="text-xs text-muted-foreground">Showing 10 records</p>
  </CardTableFooter>
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
- **Size**: `sm` (`h-7 w-7`), `default` (`h-8 w-8`), `md` (`h-9 w-9`), `lg` (`h-11 w-11`)
- **Shape**: `square` (`rounded-lg`), `circle` (`rounded-full`), `rounded-md`, `rounded-xl`

```tsx
<IconBox size="md" shape="square">
  <LandPlot className="h-4 w-4 text-muted-foreground" />
</IconBox>
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
- Provide instant clear affordances (`SearchX` or `X` icon button) inside search inputs when query is non-empty.
- Combine search inputs with segmented status tab controls inside `<CardToolbar>`.

## Reserved Pitfalls ("Don't"s)

Reserved strictly for critical pitfalls that cause visual breakage or code bloat:

- **DON'T use Tailwind slash-opacity (`bg-primary/90`)**: Causes invalid CSS syntax with hex variables in `globals.css`.
- **DON'T dynamically construct class names (`bg-[${tint}]`)**: Tailwind will not compile dynamic strings into CSS.
- **DON'T duplicate built-in variant classes**: Never pass `className="bg-card rounded-xl border-border"` to `<Card>` or `className="bg-primary"` to `<Button variant="default">`.
- **DON'T hand-roll modal backdrops or overlays**: Never render custom absolute/fixed overlay divs; always use `<Dialog>`.
- **DON'T create 2D combinatorial variant matrices on primitives**: Never define orthogonal axes (`variant` × `color`) with dozens of CVA combinations; use single purposeful variants with modifier props.

## Pattern Evolution & Pragmatism

Guidelines and patterns in this skill reflect established consensus, but they are living standards rather than immutable dogma:

1. **Autonomy to Adapt**: When novel requirements arise (e.g. specialized GIS map inspectors, complex multi-step financial wizards, bespoke chart cards) that do not neatly fit existing primitives, agents and developers are empowered to introduce modified or extended versions of existing patterns.
2. **Preserve Invariants**: When introducing new patterns, always preserve the fundamental invariants:
   - Zero broken CSS (no slash-opacity on hex tokens, unbroken `color-mix()` literals).
   - Domain-agnostic separation in `components/ui/`.
   - Accessible keyboard and screen reader primitives (`Dialog`, `Alert`, ARIA attributes).
3. **Promote Back to the System**: If a modified pattern proves recurring (used in 2+ places) or clearly superior to an older pattern, promote it to a primitive or variant and update this skill document accordingly.

