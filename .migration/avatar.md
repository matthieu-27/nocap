# avatar

2026-09-14, engine mode (legacy new-york style, exact classes preserved). Verdict: migrated; typecheck clean, biome zero-warning, 107 web tests pass.

## Changed

- `apps/web/app/components/ui/avatar.tsx` — `@radix-ui/react-avatar` namespace replaced by `@base-ui/react/avatar` (`Avatar.Root` / `Avatar.Image` / `Avatar.Fallback`). Part mapping is 1:1 (Root→Root, Image→Image, Fallback→Fallback), so only the import and the three `React.ComponentProps<typeof …>` types changed (now `AvatarPrimitive.Root.Props` etc.). Local customizations kept untouched: the `size` prop with `data-size` classes, and the plain-element extras `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`. Leftover scan clean.

## Left alone

- `app/components/AccountMenu.tsx:42-44` and `app/components/CommentThread.tsx:219` — Avatar + AvatarFallback consumers, no prop changes needed.
- `AvatarImage` has no consumer yet (registry-complete export); it still migrates with the family so a future consumer gets the Base UI part.

## Behavior changes

- Both libraries use the same loading-status state machine (idle/loading/loaded/error) to decide fallback visibility; no consumer observes `onLoadingStatusChange`, so nothing else moves.
- Base UI Fallback does not take Radix's `delayMs` prop; nobody passed it.

## Verify by hand

1. Logged-in navbar: the initials fallback circle renders in the same 32px pill.
2. Comment thread: commenter initials keep the small size variant styling.
