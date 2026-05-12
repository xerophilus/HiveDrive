"use client";

import { useEffect, useRef, useCallback } from "react";
import { World, TICK_DT } from "@/lib/sim/world";
import { render, computeScale } from "@/lib/render/renderer";
import { useUIStore } from "@/lib/store/uiStore";
import Controls from "./Controls";
import DebugPanel from "./DebugPanel";

const DEBUG_UPDATE_INTERVAL = 1000 / 10; // 10 Hz max
const EXIT_TOAST_MS = 3000;

export default function Simulator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumRef = useRef<number>(0);
  const lastDebugUpdateRef = useRef<number>(0);
  const scaleRef = useRef<number>(1);
  const exitToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    playing,
    speedMultiplier,
    selectedCarId,
    setSelectedCarId,
    setCars,
    setMsgRates,
    setSimStats,
    setExitToast,
  } = useUIStore();

  const playingRef = useRef(playing);
  const speedRef = useRef(speedMultiplier);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);

  const selectedRef = useRef(selectedCarId);
  useEffect(() => { selectedRef.current = selectedCarId; }, [selectedCarId]);

  const loop = useCallback((now: number) => {
    rafRef.current = requestAnimationFrame(loop);

    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = now;

    if (playingRef.current) {
      accumRef.current += dt * speedRef.current;
      while (accumRef.current >= TICK_DT) {
        world.tick();
        accumRef.current -= TICK_DT;
      }
    }

    const scale = scaleRef.current;
    render(ctx, world.snapshot(), selectedRef.current, scale);

    // Push to Zustand at max 10 Hz for debug panel
    if (now - lastDebugUpdateRef.current >= DEBUG_UPDATE_INTERVAL) {
      lastDebugUpdateRef.current = now;
      const snap = world.snapshot();
      setCars(snap);
      const s = world.stats();
      setMsgRates(s.msgsSentPerSec, s.msgsReceivedPerSec);
      setSimStats(s.activeMerges, s.activeLaneChanges);
    }
  }, [setCars, setMsgRates, setSimStats]);

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      scaleRef.current = computeScale(canvas.width, canvas.height);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => ro.disconnect();
  }, []);

  // Start world + RAF loop
  useEffect(() => {
    worldRef.current = new World(8);
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // Click on canvas to select car
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const world = worldRef.current;
      const canvas = canvasRef.current;
      if (!world || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      const scale = scaleRef.current;
      const wx = mx / scale;
      const wy = my / scale;

      const CAR_W = 10;
      const CAR_H = 7;

      const hit = world.snapshot().find((car) => {
        return (
          Math.abs(car.x - wx) <= CAR_W / 2 &&
          Math.abs(car.y - wy) <= CAR_H / 2
        );
      });

      setSelectedCarId(hit ? (hit.id === selectedCarId ? null : hit.id) : null);
    },
    [selectedCarId, setSelectedCarId],
  );

  const handleStep = useCallback(() => {
    worldRef.current?.tick();
    const snap = worldRef.current?.snapshot() ?? [];
    setCars(snap);
    const s = worldRef.current?.stats();
    if (s) {
      setMsgRates(s.msgsSentPerSec, s.msgsReceivedPerSec);
      setSimStats(s.activeMerges, s.activeLaneChanges);
    }
  }, [setCars, setMsgRates, setSimStats]);

  const handleSpawnOnRamp = useCallback(() => {
    worldRef.current?.spawnOnRamp();
  }, []);

  const handleMarkExit = useCallback(() => {
    const result = worldRef.current?.markRandomExit();
    if (result === null || result === undefined) {
      if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
      setExitToast("No cruising highway cars available");
      exitToastTimerRef.current = setTimeout(() => setExitToast(null), EXIT_TOAST_MS);
    }
  }, [setExitToast]);

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Controls
        onStep={handleStep}
        onSpawnOnRamp={handleSpawnOnRamp}
        onMarkExit={handleMarkExit}
      />
      <div className="flex flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="flex-1 min-w-0 cursor-crosshair"
          onClick={handleCanvasClick}
          style={{ display: "block" }}
        />
        <DebugPanel />
      </div>
    </div>
  );
}
