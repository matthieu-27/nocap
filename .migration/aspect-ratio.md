# aspect-ratio

2026-09-14, engine mode. Verdict: migrated to a CSS `aspect-ratio` div (no Base UI counterpart exists); typecheck clean, 107 web tests pass.

## Changed

- `apps/web/app/components/ui/aspect-ratio.tsx` — Radix `AspectRatio` (a padding-top hack under the hood) replaced by a plain `<div>` with `style={{ aspectRatio: String(ratio) }}`. The `ratio` prop API is kept (all consumers pass `ratio={16 / 9}`), consumer `style` props merge after the ratio so they still win. `data-slot` kept. Unified-package `radix-ui` import gone. Leftover scan clean.

## Left alone

- `app/components/Embed.tsx:52,65,105` — the only consumer family; passes `ratio` + `className` + children, unaffected by the swap (Radix rendered a div with a wrapper trick; the new div keeps the same box model because children were absolutely positioned against it — here children size themselves normally inside a CSS-ratio div, which is equivalent for the iframe/img cases used).

## Behavior changes

- DOM detail: Radix rendered two nested divs (outer with padding-top, inner absolutely positioned). The new wrapper is a single div. Any CSS in the app targeting the inner structure would notice; grep shows none does (only `data-slot` and Tailwind classes are used).
- SSR: CSS `aspect-ratio` renders identically server-side, whereas the Radix trick also did — parity.

## Verify by hand

1. Post page with a YouTube/TikTok embed: the 16:9 letterboxed frame keeps its shape at every viewport width.
2. Link-card fallback embed: content stays inside the rounded border, no layout shift on load.
