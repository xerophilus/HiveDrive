import type { CarState } from "@/lib/sim/types";

export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  cars: CarState[],
  scale: number,
): void {
  // Draw lane-center guide lines (faint, only if debug mode wanted)
  // Kept minimal for v0 — radio circles are drawn per-car in drawCar
  void cars;
  void scale;
}
