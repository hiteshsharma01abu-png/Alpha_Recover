import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'ar_admin_theme';

const read = (): ThemePreference => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

const systemDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Admin theme: System / Light / Dark, remembered per browser (docs/admin/UI_UX.md §2). */
export function useAdminTheme() {
  const [preference, setPreference] = useState<ThemePreference>(read);
  const [dark, setDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const choose = (next: ThemePreference) => {
    setPreference(next);
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this visit only
    }
  };

  const resolved: 'light' | 'dark' = preference === 'system' ? (dark ? 'dark' : 'light') : preference;
  return { preference, resolved, choose };
}
