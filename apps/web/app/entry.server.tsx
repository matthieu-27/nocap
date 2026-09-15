import { renderToReadableStream } from 'react-dom/server';
import type { EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';

// The web service runs under Bun (the workspace monorepo needs Bun to
// install), and Bun's react-dom/server replacement exports no
// renderToPipeableStream — the stream the compiled default entry uses.
// This entry renders with renderToReadableStream instead, which both
// Node's and Bun's react-dom/server provide, so the same build serves
// under either runtime. Bots get the fully-rendered shell too: fine for
// a smoke-test deploy (crawlers only lose progressive streaming).
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: unknown,
): Promise<Response> {
  if (request.method.toUpperCase() === 'HEAD') {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }
  const shell = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    { signal: request.signal },
  );
  responseHeaders.set('Content-Type', 'text/html');
  return new Response(shell, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
