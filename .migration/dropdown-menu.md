# dropdown-menu

2026-09-14, transformation engine (legacy `new-york` style, no base-registry counterpart). Most involved migration so far (menu-family part restructuring); required fixes in three consumer files and two test files.

## Changed

- `apps/web/app/components/ui/dropdown-menu.tsx` — rewired from `@radix-ui/react-dropdown-menu` to `@base-ui/react/menu` (`Menu as DropdownMenuPrimitive`).
  - Part mapping: `Content` → `Portal > Positioner > Popup` (positioning props — `side`/`sideOffset`/`align`/`alignOffset` — moved from Content to the new `Positioner`, per `menus.md`). `Label` → `GroupLabel`, `ItemIndicator` → `CheckboxItemIndicator`/`RadioItemIndicator` (split per item type), `Sub` → `SubmenuRoot`, `SubTrigger` → `SubmenuTrigger`.
  - `DropdownMenuContent`: now destructures `align`/`alignOffset`/`side`/`sideOffset` (routed to `Positioner`) separately from the rest of the props (routed to `Popup`). `Positioner` gets `className="isolate z-50 outline-none"` per the wrapper-shapes convention (no `data-slot`), `Popup` keeps `data-slot="dropdown-menu-content"`.
  - CSS vars: `--radix-dropdown-menu-content-available-height` → `--available-height`, `--radix-dropdown-menu-content-transform-origin` → `--transform-origin`.
  - Animation classes (`data-[state=open|closed]:animate-in/out`, `fade-*`, `zoom-*`, `slide-in-from-*`) rewritten to the Base UI transition idiom: `transition-[opacity,transform] data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95`, with the per-side slide direction preserved by chaining `data-[side=X]:data-starting-style:<translate>` (kept the `data-[side=...]` parameterization per `class-mapping.md`).
  - `DropdownMenuSubContent`: kept the "duplicate full content class list" shape (per `wrapper-shapes.md`'s note that dropdown-menu's SubContent doesn't compose from the public Content wrapper, unlike context-menu). `Positioner` set to the documented submenu defaults: `align="start" alignOffset={-3} side="right" sideOffset={0}` — these are load-bearing for visual alignment with the parent menu.
  - `DropdownMenuSubTrigger`: `data-[state=open]:bg-accent data-[state=open]:text-accent-foreground` → `data-popup-open:bg-accent data-popup-open:text-accent-foreground` (submenu-trigger-open is its own named attribute in Base UI, not the generic `data-open` rename).
  - `DropdownMenuCheckboxItem` / `DropdownMenuRadioItem`: added `closeOnClick = true` (destructured with a default, forwarded explicitly, overridable by callers). Base UI flips the default to `false` on these two item types; Radix always closed on select, so this preserves the original behavior.
  - `DropdownMenuLabel`: **wraps its `GroupLabel` in an internal `Group`** (`<Group><GroupLabel .../></Group>`) — Base UI's `GroupLabel` throws (`MenuGroupContext is missing`) if rendered outside a `Group`, unlike Radix's `Label` which could float freely. Caught by the `AccountMenu` test, which uses `DropdownMenuLabel` standalone (not wrapping a list of items). This keeps every existing call site working unchanged; the label just gets a group of its own rather than sharing one with sibling items.
  - Leftover scan: `grep -n "radix-ui\|@radix-ui" dropdown-menu.tsx` → no matches, clean.
- `apps/web/app/components/AccountMenu.tsx` — `DropdownMenuTrigger asChild><Button ...><Avatar>...</Avatar></Button></DropdownMenuTrigger>` → `render={<Button variant="ghost" size="icon" aria-label="Account menu" />}` with the `Avatar` moved to become the trigger's `children`; `DropdownMenuItem onSelect={onSignOut}` → `onClick={onSignOut}` (Item's Radix `onSelect` has no Base UI equivalent — renamed to `onClick`).
- `apps/web/app/components/ThemeToggle.tsx` — same `asChild` → `render` conversion on `DropdownMenuTrigger` wrapping the `Button` with the sun/moon icons as children. Its `DropdownMenuItem onClick={...}` handlers needed no change (already the right prop name).
- `apps/web/app/components/AccountMenu.test.tsx`, `apps/web/app/components/ThemeToggle.test.tsx` — see Behavior changes below; switched post-open `getByRole('menuitem', ...)` queries to `findByRole` (async) since the popup now commits asynchronously.

## Left alone

- Nothing else in this file's family references dropdown-menu.

## Behavior changes

- **Async popup mount**: Base UI's `Menu` resolves its floating-ui position asynchronously, so the `Popup`'s content is not necessarily in the DOM in the same microtask as the trigger click resolving, even after `await user.click(...)`. Under Radix this was synchronous. This is flagged, not silently patched: the tests were updated to `findByRole` (which polls) instead of `getByRole` (which doesn't) for menu items queried right after opening — the correct/idiomatic fix for an async-appearing element, not a workaround for a bug. Confirmed stable across 3 repeated full runs of both test files after the fix (was intermittently failing before, in both directions — sometimes passing, sometimes not — consistent with a race rather than a deterministic break).
- **`DropdownMenuLabel` standalone usage**: now always sits inside its own `Group` (see Changed above). Functionally equivalent in this app (no consumer relies on the Label sharing a `Group`/`aria-labelledby` with sibling items), but flagging since it's a structural DOM change from "Label floats freely" to "Label wrapped in Group" — inspect if a future consumer expects `DropdownMenuGroup` to encompass a `DropdownMenuLabel` it renders directly (rather than via this wrapper).
- **`onSelect` → `onClick` rename** (`AccountMenu`'s Log out item): functionally identical for a plain synchronous handler; only matters if a future consumer relied on Radix's `event.preventDefault()`-to-keep-open behavior, which is now `closeOnClick={false}` on `DropdownMenuItem` instead.

## Verify by hand

- `AccountMenu`: open, confirm the user handle label and "Log out" render correctly, log out fires and closes the menu.
- `ThemeToggle`: open, confirm Light/Dark/System items are present and clicking each applies the theme and closes the menu; confirm fade/scale-in and fade/scale-out feel equivalent to the old animate-in/out.
- Keyboard: open either menu with the keyboard, arrow through items, Escape closes and returns focus to the trigger.
- If a submenu (`DropdownMenuSub`/`SubTrigger`/`SubContent`) is ever adopted by a consumer: confirm it opens to the right of its trigger item, vertically aligned, and both fade/scale in from the correct side.
