import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { DEFAULT_SETTINGS, type AppSettings } from '@/db/schema';

interface SettingsContextValue {
  settings: AppSettings;
  /** False until the first read from IndexedDB completes. */
  loaded: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(getSettings, [], undefined);
  const settings = stored ?? DEFAULT_SETTINGS;
  const update = useCallback((patch: Partial<AppSettings>) => updateSettings(patch), []);

  useThemeClass(settings.theme);

  const value = useMemo(() => ({ settings, loaded: stored !== undefined, update }), [settings, stored, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return context;
}

function useThemeClass(theme: AppSettings['theme']) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && Boolean(media?.matches));
      root.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1612' : '#1f4d36');
    };
    apply();
    if (theme !== 'system' || !media) return undefined;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
