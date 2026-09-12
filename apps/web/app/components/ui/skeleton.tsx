// Registry primitive (shadcn skeleton): loading placeholders land with
// future feed states; static analysis cannot see that yet.
// fallow-ignore-file unused-file
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-accent', className)}
      {...props}
    />
  );
}

export { Skeleton };
