import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Property } from '../types';

interface PropertyState {
  selectedPropertyId: string; // 'ALL' or specific property UUID
  selectedProperty: Property | null;
  setSelectedPropertyId: (id: string, property?: Property | null) => void;
  clearPropertySelection: () => void;
}

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set, get) => ({
      selectedPropertyId: 'ALL',
      selectedProperty: null,

      setSelectedPropertyId(id: string, property: Property | null = null) {
        set({
          selectedPropertyId: id || 'ALL',
          selectedProperty: property ?? (id === 'ALL' ? null : get().selectedProperty),
        });
      },

      clearPropertySelection() {
        set({ selectedPropertyId: 'ALL', selectedProperty: null });
      },
    }),
    {
      name: 'stayeaze_active_property',
      partialize: (s) => ({
        selectedPropertyId: s.selectedPropertyId,
        selectedProperty: s.selectedProperty,
      }),
    }
  )
);

// Multi-tab synchronization for property switching
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'stayeaze_active_property' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed?.state?.selectedPropertyId) {
          usePropertyStore.setState({
            selectedPropertyId: parsed.state.selectedPropertyId,
            selectedProperty: parsed.state.selectedProperty || null,
          });
        }
      } catch (ignored) {}
    }
  });
}
