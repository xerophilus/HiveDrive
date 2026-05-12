"use client";

import { useUIStore } from "@/lib/store/uiStore";

interface ControlsProps {
  onStep: () => void;
  onSpawnOnRamp: () => void;
  onMarkExit: () => void;
}

export default function Controls({ onStep, onSpawnOnRamp, onMarkExit }: ControlsProps) {
  const { playing, speedMultiplier, exitToast, setPlaying, setSpeedMultiplier } = useUIStore();

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-700 text-sm relative">
      <button
        onClick={() => setPlaying(!playing)}
        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono"
      >
        {playing ? "⏸ Pause" : "▶ Play"}
      </button>

      <button
        onClick={onStep}
        disabled={playing}
        className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white font-mono disabled:opacity-40"
      >
        ⏭ Step
      </button>

      <label className="flex items-center gap-2 text-gray-300 font-mono">
        Speed
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={speedMultiplier}
          onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
          className="w-28 accent-blue-500"
        />
        <span className="w-10 text-right">{speedMultiplier}x</span>
      </label>

      <div className="flex-1" />

      <button
        onClick={onSpawnOnRamp}
        className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-500 text-white font-mono"
      >
        + On-ramp car
      </button>

      <div className="relative">
        <button
          onClick={onMarkExit}
          className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white font-mono"
        >
          Mark random exit
        </button>
        {exitToast && (
          <div className="absolute right-0 top-9 z-10 px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs font-mono whitespace-nowrap shadow-lg">
            {exitToast}
          </div>
        )}
      </div>
    </div>
  );
}
