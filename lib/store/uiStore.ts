import { create } from "zustand";
import type { CarState } from "@/lib/sim/types";

interface UIState {
  playing: boolean;
  speedMultiplier: number;
  selectedCarId: string | null;
  cars: CarState[];

  // v1: global sim stats
  msgsSentPerSec: number;
  msgsReceivedPerSec: number;

  // v2: global sim stats
  activeMerges: number;
  activeLaneChanges: number;

  // transient toast
  exitToast: string | null;

  setPlaying: (v: boolean) => void;
  setSpeedMultiplier: (v: number) => void;
  setSelectedCarId: (id: string | null) => void;
  setCars: (cars: CarState[]) => void;
  setMsgRates: (sent: number, received: number) => void;
  setSimStats: (activeMerges: number, activeLaneChanges: number) => void;
  setExitToast: (msg: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  playing: true,
  speedMultiplier: 1,
  selectedCarId: null,
  cars: [],
  msgsSentPerSec: 0,
  msgsReceivedPerSec: 0,
  activeMerges: 0,
  activeLaneChanges: 0,
  exitToast: null,

  setPlaying: (v) => set({ playing: v }),
  setSpeedMultiplier: (v) => set({ speedMultiplier: v }),
  setSelectedCarId: (id) => set({ selectedCarId: id }),
  setCars: (cars) => set({ cars }),
  setMsgRates: (sent, received) => set({ msgsSentPerSec: sent, msgsReceivedPerSec: received }),
  setSimStats: (activeMerges, activeLaneChanges) => set({ activeMerges, activeLaneChanges }),
  setExitToast: (msg) => set({ exitToast: msg }),
}));
