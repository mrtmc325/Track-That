import { create } from 'zustand';

interface GeoState {
  lat: number | null;
  lng: number | null;
  radius: number;
  setLocation: (lat: number, lng: number) => void;
  setRadius: (radius: number) => void;
  clearLocation: () => void;
}

export const useGeoStore = create<GeoState>((set) => ({
  lat: null,
  lng: null,
  radius: 25,
  setLocation: (lat, lng) => set({ lat, lng }),
  setRadius: (radius) => set({ radius }),
  clearLocation: () => set({ lat: null, lng: null }),
}));
