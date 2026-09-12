// Referenced only from root.tsx's <script src> tag — invisible to static
// analysis, so fallow flags it unused. It IS the no-FOUC theme bootstrap.
// fallow-ignore-file unused-file
// Runs before first paint via <script blocking="render"> in the root Layout
// head — the modern replacement for inline theme scripts: no FOUC, and no
// inline-JS string hacks in the React tree.
try {
  const stored = window.localStorage.getItem('nocap-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // 'system' and no stored choice both follow the OS preference; only an
  // explicit 'light' or 'dark' overrides it.
  if (
    stored === 'dark' ||
    ((stored === null || stored === 'system') && prefersDark)
  ) {
    document.documentElement.classList.add('dark');
  }
} catch (error) {
  console.error('theme init: storage unavailable', {
    message: String(error),
  });
}
