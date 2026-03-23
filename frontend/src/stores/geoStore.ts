// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { create } from 'zustand';

interface GeoState {
  lat: number | null;
  lng: number | null;
  radius: number;
  zipCode: string | null;
  setLocation: (lat: number, lng: number) => void;
  setRadius: (radius: number) => void;
  setZipCode: (zip: string) => void;
  clearLocation: () => void;
}

// Restore from localStorage on load
function loadSaved(): Partial<GeoState> {
  try {
    const saved = localStorage.getItem('track-that-geo');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function persist(state: Partial<GeoState>) {
  try {
    localStorage.setItem('track-that-geo', JSON.stringify({
      lat: state.lat, lng: state.lng, radius: state.radius, zipCode: state.zipCode,
    }));
  } catch { /* ignore */ }
}

const saved = loadSaved();

export const useGeoStore = create<GeoState>((set) => ({
  lat: (saved.lat as number) ?? null,
  lng: (saved.lng as number) ?? null,
  radius: (saved.radius as number) ?? 25,
  zipCode: (saved.zipCode as string) ?? null,
  setLocation: (lat, lng) => set((s) => { const next = { ...s, lat, lng }; persist(next); return { lat, lng }; }),
  setRadius: (radius) => set((s) => { const next = { ...s, radius }; persist(next); return { radius }; }),
  setZipCode: (zipCode) => set((s) => { const next = { ...s, zipCode }; persist(next); return { zipCode }; }),
  clearLocation: () => set(() => { localStorage.removeItem('track-that-geo'); return { lat: null, lng: null, zipCode: null }; }),
}));
