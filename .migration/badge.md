# badge

2026-09-14, engine mode (legacy new-york style, exact classes preserved). Verdict: migrated; typecheck clean, biome zero-warning, 107 web tests pass.

## Changed

- `apps/web/app/components/ui/badge.tsx` — Radix `Slot` + `asChild` idiom replaced by Base UI's `useRender` hook (`@base-ui/react/use-render`): the standard Slot replacement for a non-button polymorphic element. `render` prop replaces `asChild`, `defaultTagName: 'span'` keeps the span default. Props type is `useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>`. cva `badgeVariants`, all classes, `data-slot`/`data-variant` unchanged. Pitfalls hit and fixed: `data-slot` must be a quoted key in the props object (hyphen is not a valid identifier), and the public `useRender` takes a single params object with `defaultTagName` — the two-arg `('span', {...})` form belongs to the internal `useRenderElement`. Leftover scan clean.

## Left alone

- All 7 consumers (`ChannelSidebar.tsx:52`, `post.tsx:147`, `ModPostsTable.tsx:85,104,106`, `PostCard.tsx:57`, `Embed.tsx:115`, `channel.tsx:38`): none used `asChild` on Badge, so the prop removal changes no call site — verified by grep and typecheck.
- `@radix-ui/react-slot` dependency removal deferred to the end of the whole-project migration.

## Behavior changes

- `asChild` prop removed from the public API; `render` replaces it. No in-repo consumer used it.
- Radix `Slot` merged exactly like `React.cloneElement`; Base UI `useRender` merge keeps the same semantics (handler chaining, className join, prop overwrite).

## Verify by hand

1. Post page and mod table: badges (provider tag, live/removed, counts) look unchanged — same pill shape, same colors.
2. Keyboard: badges are not interactive; tab order unchanged.
