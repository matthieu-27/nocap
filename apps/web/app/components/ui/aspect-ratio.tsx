import type * as React from 'react';

// Base UI has no AspectRatio counterpart; a CSS aspect-ratio div replaces
// the Radix primitive (which was itself a padding-top trick). The ratio prop
// API is kept so consumers are untouched.
function AspectRatio({
  ratio,
  style,
  ...props
}: React.ComponentProps<'div'> & { ratio?: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      style={{ aspectRatio: String(ratio), ...style }}
      {...props}
    />
  );
}

export { AspectRatio };
