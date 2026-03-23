// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

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
