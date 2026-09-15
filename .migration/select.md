# select

2026-09-15, transformation engine (legacy `new-york` style, no base-registry counterpart). Last Radix wrapper in the project — after this, all `@radix-ui/*` deps removed. Two consumer files updated for the `Select.Value` raw-value rendering risk and the null-typed `onValueChange`.

## Changed

- `apps/web/app/components/ui/select.tsx` — rewired from `@radix-ui/react-select` to `@base-ui/react/select` (`Select as SelectPrimitive`).
  - Part mapping applied as researched: `Content` → `Portal > Positioner > Popup` (3-way split), `Viewport` → `List`, `Label` → `GroupLabel`, `ScrollUpButton`/`ScrollDownButton` → `ScrollUpArrow`/`ScrollDownArrow`; `Root`, `Trigger`, `Value`, `Icon`, `Portal`, `Item`, `ItemText`, `ItemIndicator` (NOT renamed, unlike dropdown-menu), `Group`, `Separator` keep their names.
  - `Select` is now a **bare re-export** (`const Select = SelectPrimitive.Root`): Base UI's `SelectRoot<Value, Multiple>` is generic, which breaks the `React.ComponentProps<typeof ...>` wrapper pattern (per `wrapper-shapes.md`). Root renders no HTML element, so the old `data-slot="select"` on it was dropped with it.
  - `SelectContent`: destructures `align` (kept the wrapper's explicit `'center'` default, which was already an override of Radix's own `'start'`), plus `side`/`sideOffset`/`alignOffset`/`alignItemWithTrigger`, routed to the `Positioner`; the rest go to the `Popup`. Per the wrapper-shapes convention for select (opposite of the menu family), `isolate z-50` lives on the **Popup**, the Positioner gets no class.
  - `position` prop (`"item-aligned"|"popper"`) is gone; `alignItemWithTrigger` replaces it. The old popper-only conditional classes (per-side `translate-*-1` static offsets on the panel, `h-(--anchor-height) min-w-(--anchor-width) scroll-my-1` on the List) now key off `alignItemWithTrigger === false`. During the open animation the `data-starting-style` per-side translate wins on specificity over the static offset, so popper mode still settles at its 4px gap.
  - CSS vars: `--radix-select-content-available-height` → `--available-height`, `--radix-select-content-transform-origin` → `--transform-origin`, `--radix-select-trigger-height` → `--anchor-height`, `--radix-select-trigger-width` → `--anchor-width` (Tailwind v4 `(--var)` shorthand).
  - Animation: `data-[state=open]:animate-in`/`data-[state=closed]:animate-out` + `slide-in-from-*` rewritten to the Base UI idiom used by dialog/dropdown-menu in this project: `transition-[opacity,transform] data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0` with per-side `data-[side=X]:data-starting-style:<translate>`.
  - `SelectPrimitive.Icon asChild><ChevronDownIcon/>` → `render={<ChevronDownIcon/>}`.
  - `SelectLabel`: wraps its `GroupLabel` in an internal `Group` (same pattern as the dropdown-menu migration) — Base UI's `GroupLabel` throws outside a `Group`, Radix's `Label` floated freely. No current consumer uses `SelectLabel`, so this is protective, not observed.
  - Scroll arrows: `absolute top-0 w-full` / `absolute bottom-0 w-full` added (per `wrapper-shapes.md`; Base UI arrows are plain divs, Radix positioned its buttons itself).
  - Leftover scan: `grep -n "radix-ui\|@radix-ui" select.tsx` → no matches, clean.
- `apps/web/app/components/ModPostsTable.tsx` — added an `items` array to `Select` (built from the same `{value: 'all'|slug, label}` pairs the menu already renders: `'All channels'` / `channelHandle(slug)`). Without it, Base UI's `Select.Value` renders the **raw value string** (`"all"`, the bare slug) in the closed trigger instead of the label — the visible-regression risk flagged during research. Also `onValueChange={setChannel}` → `onValueChange={(value) => setChannel(value ?? 'all')}`: Base UI's single-select callback is typed `(value: Value | null, ...)` and `null` can't occur here (no null-valued item), but the guard satisfies the type honestly instead of a cast.
- `apps/web/app/components/ReportDialog.tsx` — added `items={REPORT_REASONS}` (the const is already `{value: ReportReason, label: string}[]`, exactly Base UI's items shape; without it the trigger would show `'personal_info'` instead of `'Personal information'`). The existing `value as ReportReason` cast still compiles (`ReportReason | null` → `ReportReason`) and its "options come from REPORT_REASONS" comment still holds.
- `apps/web/app/components/ModPostsTable.test.tsx` — post-open `getByRole('option', ...)` → `await screen.findByRole('option', ...)` (pre-empted the async-popup flake the dropdown-menu migration hit; Base UI resolves Select positioning async via floating-ui). Reworded the two Radix-specific comments (jsdom shims kept — harmless; Base UI doesn't use pointer capture but scrollIntoView shimming is still what makes jsdom behave).
- `apps/web/app/components/ReportDialog.test.tsx` — same `getByRole('option')` → `findByRole` conversion (loop in the first test, single click in the second).
- `apps/web/package.json` + `bun.lock` — removed ALL `@radix-ui/*` deps (react-select plus the 8 already orphaned by earlier migrations: avatar, dialog, dropdown-menu, label, scroll-area, separator, slot, tabs). Verified zero `@radix-ui` references in `apps/` + `packages/` source first. `bun remove` run, lockfile saved.

## Left alone

- `components.json` — style is legacy `new-york`, which has no `base-` counterpart; per skill rules no flip applies. **Flagged**: `shadcn add` will keep delivering Radix variants of new components; the user decides whether to switch style or hand-migrate additions (see Behavior changes).
- Non-radix wrappers (cmdk/vaul/sonner/etc.) — not present in this project, nothing to skip.

## Behavior changes

- **Async popup mount** (same as dropdown-menu): Base UI resolves Select positioning asynchronously, so items queried right after opening may not be in the DOM in the same microtask. Tests updated to `findByRole`; confirmed stable across 3 repeated runs of both test files.
- **`Select.Value` renders raw values without `items`** — the headline risk of this migration. Both consumers now pass `items` on `Select`, so the closed trigger shows the friendly label. Any future consumer that skips `items` when value ≠ label will get the raw string — no typecheck error will catch it.
- **Scroll arrows unmount when not scrollable** (Base UI `keepMounted` default `false`; Radix kept its buttons mounted) and don't render on touch input. Invisible in current consumers (short lists).
- **`onValueChange` can now receive `null`** type-wise (Base UI single-select allows a null value); guarded at both call sites. Also gains a second `eventDetails` arg with `reason`/`cancel()` — unused by current consumers.
- **`shadcn add` still delivers Radix variants** (legacy `new-york` style; no base-new-york exists). Flagged, not fixed — switching style would restyle the app.

## Verify by hand

- Mod table (`/mod` or wherever ModPostsTable renders): open the channel filter, confirm the closed trigger shows "All channels" (not "all") before and after picking a channel; pick `nocap/sports`, confirm the table filters and the trigger shows the handle.
- Report dialog: open it, confirm the trigger shows "Spam" (not "spam"); switch to "Personal information", confirm the trigger updates and Report submits `personal_info`.
- Keyboard: open either select with Enter/Space, arrow through options, typeahead ("pe" jumps), Escape closes and returns focus to the trigger.
- Feel: popup fades/scales in from the trigger side and settles without jump; scroll arrows appear only if the list overflows.
