import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme(theme) {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
      toggleTheme() {
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', next);
          return { theme: next };
        });
      },
    }),
    { name: 'veelocity-theme' }
  )
);
