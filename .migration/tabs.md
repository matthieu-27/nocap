# tabs

2026-09-14, transformation engine (legacy `new-york` style, no base-registry counterpart).

## Changed

- `apps/web/app/components/ui/tabs.tsx` — rewired from `@radix-ui/react-tabs` to `@base-ui/react/tabs`.
  - `TabsPrimitive.Root/List/Trigger/Content` → `Tabs.Root/List/Tab/Panel` (part renames).
  - `data-[state=active]` selectors in `TabsTrigger` classes → `data-[active]` (Base UI uses boolean-presence `data-active`, not an enum `data-state`).
  - Added `activateOnFocus` on `TabsList` — Base UI 1.6+ defaults `List` to manual tab activation, inverting Radix's `activationMode="automatic"` default. Set explicitly to preserve the original click/arrow-key auto-activate behavior this app already relied on.
  - Dropped the redundant manual `data-orientation={orientation}` prop on `Tabs` — Base UI's `Root` sets `data-orientation` itself from the `orientation` prop, same as Radix did.
  - Leftover scan: `grep -n "radix-ui\|@radix-ui" tabs.tsx` → no matches, clean.
- `apps/web/app/components/FeedControls.tsx:69-75` — `TabsTrigger` consumer used `asChild` wrapping a `<Link>`; converted to `render={<Link to={...} />}` with `{tab.label}` as the component's `children` (Base UI merges it into the rendered element). Also set `nativeButton={false}` — `Tabs.Tab` defaults to `nativeButton: true` and warns at runtime when its `render` target isn't a real `<button>` (caught by the existing test suite's console output, not by typecheck).

## Left alone

- `apps/web/app/components/CommentThread.tsx:121-131` — plain `Tabs`/`TabsList`/`TabsTrigger` usage (`value`, `onValueChange`, string tab values), no `asChild`, no custom classes touching `data-state`. Compiles and behaves unchanged.

## Behavior changes

- **Tab activation on focus**: preserved via the explicit `activateOnFocus` flag above (not silently defaulted) — flagging because Base UI's own default here is the opposite of Radix's.
- **`Tabs.Indicator`** (new Base UI part for sliding-highlight underlines) was not adopted — the existing `after:` pseudo-element highlight in `TabsTrigger` classes still works off `data-[active]` and needed no rewrite, so this stays CSS-only rather than switching to the primitive part.

## Verify by hand

- `FeedControls`: click each sort tab (`Link`-rendered triggers) — confirm navigation still happens and the active tab's underline/background highlight (`data-[active]` styles) tracks the current route's `sort` value.
- `CommentThread`: switch between "Best"/"New" — confirm `onValueChange` fires and active-tab styling updates.
- Keyboard: arrow through tabs in both components, confirm focus moves and (per `activateOnFocus`) the panel/trigger activates automatically on arrow-key focus, matching prior Radix behavior.
