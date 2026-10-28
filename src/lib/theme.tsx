import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'kontho-theme';

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const ThemeContext = createContext<[ThemePref, (p: ThemePref) => void]>(['system', () => {}]);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePref>(read);

  useEffect(() => {
    apply(pref);
    try {
      if (pref === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, pref);
    } catch {
      // Storage unavailable (private mode); the choice just won't persist.
    }
    if (pref !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  return <ThemeContext.Provider value={[pref, setPref]}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
