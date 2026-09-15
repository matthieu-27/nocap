# scroll-area

2026-09-14, transformation engine (legacy `new-york` style, no base-registry counterpart). Migrated cleanly, no consumers yet in the app.

## Changed

- `apps/web/app/components/ui/scroll-area.tsx` — rewired from `@radix-ui/react-scroll-area` to `@base-ui/react/scroll-area`.
  - `ScrollAreaPrimitive.Root/Viewport/ScrollAreaScrollbar/ScrollAreaThumb/Corner` → `ScrollArea.Root/Viewport/Scrollbar/Thumb/Corner` (part renames per Base UI anatomy).
  - Wrapped `children` in the new `ScrollArea.Content` part inside `Viewport` (Base UI addition for horizontal-overflow measurement); no visual change, matches idiomatic Base UI shape.
  - No `type`, `scrollHideDelay`, or `dir` props were in use, so nothing to drop/replace there.
  - Leftover scan: `grep -n "radix-ui\|@radix-ui" scroll-area.tsx` → no matches, clean.

## Left alone

- Nothing else in this file's family; no other files reference `ScrollArea`/`ScrollBar` yet (registry file, "members light up as screens consume them").

## Behavior changes

- Scrollbar visibility: Radix's `type="hover"` default doesn't exist as a Base UI prop; visibility is CSS-driven off `[data-hovering]`/`[data-scrolling]`/`[data-has-overflow-x/y]` data attributes. Current classes don't style these yet — scrollbar will show/hide per Base UI's default mount behavior (mounts only when scrollable), not per the old Radix hover-delay behavior. Flagging since no consumer exists yet to verify visually.

## Verify by hand

- Once a consumer mounts `<ScrollArea>` with overflowing content: confirm the scrollbar appears only when content overflows, thumb drags correctly, and horizontal scrollbar (if used) works via the new `Content` wrapper.
