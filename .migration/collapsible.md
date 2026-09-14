# collapsible

2026-09-14, engine mode. Verdict: migrated; typecheck clean, 107 web tests pass.

## Changed

- `apps/web/app/components/ui/collapsible.tsx` — unified-package `radix-ui` import replaced by `@base-ui/react/collapsible`. Part rename: `CollapsibleContent` wraps Base UI's `Panel` (Radix `Content` → Base UI `Panel`); Root and Trigger map 1:1. Export names and `data-slot` values unchanged. Leftover scan clean.
- `apps/web/app/components/CommentThread.tsx:295-299` — the one `CollapsibleTrigger asChild` site becomes `render={<Button …/>}` with children passed through the trigger.

## Left alone

- `CommentThread.tsx` is the only consumer family (the Replies collapse).
- `keepMounted`/`open`/`defaultOpen`/`onOpenChange` props all exist with the same names on Base UI Root; no call-site prop change needed.

## Behavior changes

- Data attributes: Radix set `data-state="open|closed"` on Root/Trigger/Content; Base UI sets `data-open`/`data-closed`. No app CSS or test queries those attributes (grep clean), so nothing breaks, but any future styling must use the Base UI names.
- Base UI Panel unmounts closed content by default, same as Radix Content — parity.

## Verify by hand

1. Comment thread with replies: "N replies" ghost button toggles the reply list open/closed.
2. Keyboard: focus the toggle button, Enter/Space collapse and expand; aria-expanded state flips.
