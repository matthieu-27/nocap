# label

2026-09-14, engine mode (legacy new-york style, exact classes preserved). Verdict: migrated to a native `<label>`; 107 web tests pass, typecheck clean.

## Changed

- `apps/web/app/components/ui/label.tsx` — `@radix-ui/react-label` dropped. Base UI has no Label counterpart, so the wrapper renders a plain `<label>`; the `select-none` class already in the class string covers the only behavior Radix added (`user-select: none`). Props type is now `React.ComponentProps<'label'>`. All classes and `data-slot` unchanged. Leftover scan clean.

## Left alone

- `app/components/AuthField.tsx`, `app/components/ReportDialog.tsx`, `app/components/ui/field.tsx:112-118` — Label consumers; `React.ComponentProps<typeof Label>` resolves to the new native prop shape with no call-site change, verified by typecheck.
- `@radix-ui/react-label` dependency removal deferred to the end of the whole-project migration.

## Behavior changes

None visible. Radix Label set `htmlFor` pass-through and pointer-events the same way a native label does; the disabled-state styling was already class-based (`peer-disabled:`, `group-data-[disabled=true]:`).

## Verify by hand

1. Login form: click a field label → focus lands in the matching input (htmlFor wiring unchanged).
2. Disabled input: its label dims and shows the not-allowed cursor.
