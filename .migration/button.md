# button

2026-09-14, engine mode (legacy new-york style: classification only, transformation on the project's own files, exact classes preserved). Verdict: migrated; all 107 web tests pass, build passes.

## Changed

- `apps/web/app/components/ui/button.tsx` — `@radix-ui/react-slot` Slot idiom (`asChild ? Slot : 'button'`) replaced by the REAL `@base-ui/react/button` primitive per the skill hard rule. `render` prop replaces `asChild`. cva `buttonVariants`, all classes, `data-slot`/`data-variant`/`data-size` attributes unchanged. Props type is `ButtonPrimitive.Props & VariantProps<typeof buttonVariants>`. Leftover scan clean: `grep -n "radix-ui\|@radix-ui"` finds nothing.
- 8 consumer call sites that used `<Button asChild><Link …/></Button>` became plain `<Link className={buttonVariants(…)}>` instead of `render`:
  - `app/components/AccountMenu.tsx:28-33` (guest Log in / Sign up)
  - `app/components/CommentComposer.tsx:69` (login CTA)
  - `app/root.tsx:62` (error boundary CTA)
  - `app/components/FeedList.tsx:117,153,162` (empty-state CTA + pagination Newer/Load more)
  - `app/components/FeedControls.tsx:77-85` (top-window chips)
  Why not `render={<Link/>}`: Base UI's `useButton` hard-sets `type="button"` on the rendered element when `nativeButton` is true (default) — a bogus attribute on an `<a>` — and sets `role="button"` + Space activation when `nativeButton={false}`. Both options fight the link semantics these sites need (project tests assert `getByRole('link')`; a11y: navigation links should stay links). `buttonVariants` on the real `<Link>` keeps look identical, semantics correct, and no dev warning. This is a deliberate deviation from the mechanical asChild→render mapping, flagged here.
- `app/components/AccountMenu.test.tsx:18-20` — comment updated to describe the new Link+buttonVariants shape; assertions unchanged (they already expected role `link`).

## Left alone

- `CreateChannelDialog.tsx`, `AuthCard.tsx`, `VoteArrows.tsx`, `ReportDialog.tsx`, `CommentThread.tsx`, `PostCard.tsx`, `Embed.tsx`, `ThemeToggle.tsx`, `post.tsx`, `dialog.tsx` — Button consumers that never used `asChild`; explicit `type="submit"` sites were already safe.
- `@radix-ui/react-slot` dependency still installed; removed at the end of the whole-project migration with the other radix deps.

## Behavior changes

- Buttons that rendered a link via `asChild` now render a bare `<a>` (from react-router `Link`) with the same button classes — same look, same hrefs, no Base UI button semantics attached. Radix Slot also produced a bare anchor, so end-user behavior is unchanged.
- Base UI `Button` defaults `type="submit"`→`type="button"`? No — it defaults `type="button"` on native buttons; every form submit site in this app passes an explicit `type="submit"`, verified pre-migration, so no form regressions.
- Dev-console warning gone for link sites (they no longer use ButtonPrimitive at all).

## Verify by hand

1. Feed → click a window chip (Day/Week/Month) under Top: URL changes, chip stays styled.
2. Feed pagination: Load more and Newer navigate with correct `?offset=`.
3. Logged out: navbar Log in / Sign up look like buttons, are announced as links by the screen reader, focus ring works.
4. Any form (login/signup/comment): submit still posts — Enter key and button click both work.
