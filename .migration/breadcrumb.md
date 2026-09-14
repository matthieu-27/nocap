# breadcrumb

2026-09-14, engine mode. Verdict: migrated; typecheck clean, 107 web tests pass.

## Changed

- `apps/web/app/components/ui/breadcrumb.tsx` — unified-package `radix-ui` import (`Slot`) gone. `BreadcrumbLink`'s `asChild` idiom replaced by Base UI `useRender` with `render` prop and `defaultTagName: 'a'` — the skill's worked example for a non-button polymorphic anchor. All other parts were already plain elements (nav/ol/li/span) and are untouched. Leftover scan clean.
- `apps/web/app/routes/post.tsx:125-127` — the one consumer of `BreadcrumbLink asChild` becomes `render={<Link …/>}` with children passed to the wrapper (useRender merges them onto the Link).

## Left alone

- No other consumer imports this family (only `post.tsx`).
- The unified `radix-ui` package dependency removal deferred to the end of the migration.

## Behavior changes

- None for users: Slot and useRender merge identically (children land inside the Link, classes/refs/handlers compose).

## Verify by hand

1. Post page: breadcrumb shows `channel / post title`; the channel segment is a working link to `/d/<slug>` with the hover color transition.
2. Screen reader: nav keeps `aria-label="breadcrumb"`, current page keeps `aria-current`.
