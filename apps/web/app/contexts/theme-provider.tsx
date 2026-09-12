import {
  createContext,
  type ReactElement,
  useContext,
  useEffect,
  useState,
} from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => {},
};

// Storage is untrusted input: anything but the three theme values (or
// null) falls back to defaultTheme instead of reaching the DOM.
function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system';
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// SSR-safe by construction: the server render never touches localStorage
// (Bun has none), so state starts at defaultTheme and storage is read in
// a client-only effect. The pre-paint class is theme-init.js's job, so no
// flash happens in the window before this effect runs.
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'nocap-theme',
  ...props
}: ThemeProviderProps): ReactElement {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (isTheme(stored)) setTheme(stored);
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (next: Theme) => {
      try {
        localStorage.setItem(storageKey, next);
      } catch (error) {
        console.error('theme provider: storage unavailable', {
          message: String(error),
        });
      }
      setTheme(next);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
