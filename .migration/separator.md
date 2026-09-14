# separator

2026-09-14, engine mode (legacy new-york style, exact classes preserved). Verdict: migrated; typecheck clean, 107 web tests pass, build passes.

## Changed

- `apps/web/app/components/ui/separator.tsx` — `@radix-ui/react-separator` replaced by `@base-ui/react/separator` (callable component, no namespace). `orientation` prop kept; the `decorative` prop is dropped — Base UI has no counterpart, its separator always renders with proper semantics and sets `data-orientation` from state, so the existing `data-[orientation=...]` classes keep working unchanged. All classes and `data-slot` unchanged. Leftover scan clean.

## Left alone

- `app/components/ui/field.tsx:175` — the only consumer of this wrapper; passes just a `className`, unaffected by the `decorative` removal. Verified by typecheck.
- `BreadcrumbSeparator` / `DropdownMenuSeparator` / `SelectSeparator` — separate primitives from their own packages (breadcrumb, dropdown-menu, select), not this wrapper; they migrate with their families.

## Behavior changes

- `decorative` prop no longer accepted. In Radix it controlled whether the separator was hidden from the accessibility tree (`decorative=true` default = aria-hidden). Base UI's separator always exposes `role="separator"` with orientation. Practical effect: screen readers now announce standalone decorative separators instead of skipping them. No consumer passed the prop, so no call-site change.

## Verify by hand

1. Auth forms (FieldSeparator, e.g. the "or continue with" rule): the horizontal line renders identically.
2. Screen reader pass over a form: separators may now be announced — that is the flagged delta above, decide later if it is noise.
