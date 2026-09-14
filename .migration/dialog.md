# dialog

2026-09-14, transformation engine (legacy `new-york` style, no base-registry counterpart).

## Changed

- `apps/web/app/components/ui/dialog.tsx` — rewired from `@radix-ui/react-dialog` to `@base-ui/react/dialog`.
  - Part renames: `Root→Root`, `Trigger→Trigger`, `Portal→Portal`, `Overlay→Backdrop`, `Content→Popup`, `Close→Close`, `Title→Title`, `Description→Description`.
  - `DialogOverlay`: animation classes `data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0` rewritten to the Base UI transition idiom: `transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0`.
  - `DialogContent`: same animation rewrite, restated as `transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0` (fade + zoom-95 intent preserved; existing `translate-x/y-[-50%]` centering utilities compose fine with `scale-95` since Tailwind's transform utilities share one CSS variable-driven `transform`).
  - Close button inside `DialogContent`: `data-[state=open]:bg-accent data-[state=open]:text-muted-foreground` → `data-open:bg-accent data-open:text-muted-foreground` (class-mapping rename). Note in Behavior changes below — this was likely already permanently-true dead styling in Radix too.
  - `DialogFooter`'s `DialogPrimitive.Close asChild><Button variant="outline">Close</Button></DialogPrimitive.Close>` → `<DialogPrimitive.Close render={<Button variant="outline" />}>Close</DialogPrimitive.Close>` (asChild → render; `Button` is the already-migrated real `@base-ui/react/button` primitive, so no `nativeButton` override needed).
  - Leftover scan: `grep -n "radix-ui\|@radix-ui" dialog.tsx` → no matches, clean.
- `apps/web/app/components/CreateChannelDialog.tsx:81-91` — `DialogTrigger asChild><Button>...</Button></DialogTrigger>` → `DialogTrigger render={<Button .../>}>...</DialogTrigger>`, moving the `Button`'s children (icon + label) up to become `DialogTrigger`'s `children` (merged into the rendered `Button` by Base UI). No `nativeButton` needed — `Button` already renders a real `<button>`.

## Left alone

- `apps/web/app/components/ReportDialog.tsx` — plain `Dialog`/`DialogContent`/... usage with `onOpenChange={onOpenChange}` (no `asChild`), compiles and runs unchanged since Base UI's richer `(open, eventDetails)` callback signature is a superset TS accepts a `(open: boolean) => void` handler against.

## Behavior changes

- **Dialog close reasons**: Radix's per-interaction callbacks (`onEscapeKeyDown`, `onPointerDownOutside`, `onInteractOutside`) aren't used anywhere in this wrapper or its consumers, so nothing needed porting to `onOpenChange`'s `eventDetails.reason` — flagging only because this is the mechanism to reach for if outside-press/escape cancellation is ever added later.
- **Close button `data-open:bg-accent` styling**: this class fires only while the dialog is open, which is always true while the button is mounted (it renders inside `Popup`, only present when open) — same inert-looking behavior as before the migration, not a regression, just carried forward as-is per the class-mapping rename rather than removed.

## Verify by hand

- `CreateChannelDialog`: open via the "Create channel" trigger button — confirm it still renders as a real `<button>` (not a wrapped div), the dialog opens/closes, and the icon+label layout is unchanged.
- `ReportDialog`: open, confirm fade/scale-in on open and fade/scale-out on close feel equivalent to the old animate-in/out, backdrop click and Escape both close it, focus returns to the trigger on close.
- Either dialog: tab through interactive content, confirm focus trap still works (`modal` defaults `true` in both Radix and Base UI).
