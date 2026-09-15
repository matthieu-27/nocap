// Registry primitive (shadcn label). Base UI has no Label counterpart; the
// wrapper renders a native <label> and the select-none class covers the only
// extra Radix provided (user-select: none on labels).
import type * as React from 'react';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // htmlFor and control children arrive from call sites via props spread —
    // the static association check cannot see them here.
    // biome-ignore lint/a11y/noLabelWithoutControl: wrapper forwards htmlFor
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
