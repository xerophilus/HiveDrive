import { create } from "zustand";
import type { CarState } from "@/lib/sim/types";

interface UIState {
  playing: boolean;
  speedMultiplier: number;
  selectedCarId: string | null;
  cars: CarState[];

  setPlaying: (v: boolean) => void;
  setSpeedMultiplier: (v: number) => void;
  setSelectedCarId: (id: string | null) => void;
  setCars: (cars: CarState[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  playing: true,
  speedMultiplier: 1,
  selectedCarId: null,
  cars: [],

  setPlaying: (v) => set({ playing: v }),
  setSpeedMultiplier: (v) => set({ speedMultiplier: v }),
  setSelectedCarId: (id) => set({ selectedCarId: id }),
  setCars: (cars) => set({ cars }),
}));
