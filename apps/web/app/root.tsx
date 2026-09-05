import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import './styles.css';

// No-FOUC: runs before first paint; honors stored choice, falls back to system.
const themeInit = `try{var t=localStorage.getItem('nocap-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){/* ignore: storage unavailable (private mode); system theme applies */}`;

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
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme-init constant defined above, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): React.ReactElement {
  return <Outlet />;
}
