import type { ModPostDto } from '@nocap/shared';
import { ShieldAlert } from 'lucide-react';
import type { ReactElement } from 'react';
import { redirect } from 'react-router';

import { ModPostsTable } from '@/components/ModPostsTable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ApiError, apiFetch } from '@/lib/api';
import type { Route } from './+types/mod';

type LoaderData =
  | { posts: ModPostDto[]; forbidden?: undefined }
  | { posts: null; forbidden: true };

// Role-gate loader: three exit paths (posts, forbidden render, login
// redirect) plus the rethrow — the branching IS the contract.
// fallow-ignore-next-line complexity
export async function loader({
  request,
}: Route.LoaderArgs): Promise<LoaderData> {
  try {
    const posts = await apiFetch<ModPostDto[]>(request, '/api/mod/posts');
    return { posts };
  } catch (error) {
    // The SSR loader is the role gate: anonymous traffic goes to login,
    // authenticated non-mods get the access-denied render, anything else
    // (500, network) rethrows to the error boundary instead of masquerading
    // as a permission problem.
    if (error instanceof ApiError && error.status === 401) {
      throw redirect('/login');
    }
    if (error instanceof ApiError && error.status === 403) {
      return { posts: null, forbidden: true };
    }
    throw error;
  }
}

export default function ModRoute({
  loaderData,
}: Route.ComponentProps): ReactElement {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold">Moderation</h1>
      <p className="mt-1 mb-4 max-w-xl text-muted-foreground">
        Every post across all channels, including removed ones. Resolve reports
        from the moderation queue; this view is read-only.
      </p>
      {loaderData.forbidden ? (
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Moderator access required</AlertTitle>
          <AlertDescription>
            Your account does not have the mod or admin role.
          </AlertDescription>
        </Alert>
      ) : (
        <ModPostsTable posts={loaderData.posts ?? []} />
      )}
    </section>
  );
}
