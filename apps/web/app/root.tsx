import type { ReactNode } from 'react';
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';
import './styles.css';

import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';

export function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NoCaP</title>
        <Meta />
        <Links />
        <script src="/theme-init.js" blocking="render" />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Toaster richColors position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): React.ReactElement {
  return <Outlet />;
}

// Route-level failures render through Layout: unknown channels, missing
// posts, and unmatched paths all land here with their status message.
export function ErrorBoundary(): React.ReactElement {
  const error = useRouteError();
  const isResponse = isRouteErrorResponse(error);
  const status = isResponse ? String(error.status) : 'Oops';
  const message =
    isResponse && error.statusText !== ''
      ? error.statusText
      : 'Something went wrong';
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-16 text-center">
      <h1 className="text-4xl font-bold">{status}</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild className="mt-2">
        <Link to="/">Back to the feed</Link>
      </Button>
    </section>
  );
}
