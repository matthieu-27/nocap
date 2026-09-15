// Registry primitive (shadcn breadcrumb): the exported family is intentionally
// complete — members light up as screens consume them.
// fallow-ignore-file unused-export

import { useRender } from '@base-ui/react/use-render';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-sm break-words text-muted-foreground sm:gap-2.5',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  render,
  className,
  ...props
}: useRender.ComponentProps<'a'>) {
  const element = useRender({
    render,
    defaultTagName: 'a',
    props: {
      ...props,
      'data-slot': 'breadcrumb-link',
      className: cn('transition-colors hover:text-foreground', className),
    },
  });
  return element;
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: registry primitive — the current page is intentionally non-interactive (aria-disabled)
    // biome-ignore lint/a11y/useSemanticElements: registry primitive — keeps the shadcn breadcrumb markup stable against upstream updates
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal text-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
