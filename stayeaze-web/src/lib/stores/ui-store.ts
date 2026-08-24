import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  compactMode: boolean;
  sidebarCollapsedByDefault: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setCompactMode: (v: boolean) => void;
  setSidebarCollapsedByDefault: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      compactMode: false,
      sidebarCollapsedByDefault: false,
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light';
          applyTheme(next);
          return { theme: next };
        }),
      setTheme: (t) => {
        applyTheme(t);
        set({ theme: t });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setCompactMode: (v) => {
        applyCompactMode(v);
        set({ compactMode: v });
      },
      setSidebarCollapsedByDefault: (v) => set({ sidebarCollapsedByDefault: v, sidebarCollapsed: v }),
    }),
    {
      name: 'stayeaze-ui',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        compactMode: s.compactMode,
        sidebarCollapsedByDefault: s.sidebarCollapsedByDefault,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme);
        if (state?.compactMode) applyCompactMode(state.compactMode);
      },
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function applyCompactMode(compact: boolean) {
  const root = document.documentElement;
  if (compact) root.classList.add('compact-mode');
  else root.classList.remove('compact-mode');
}
