import type { CarState } from "@/lib/sim/types";
import { drawRoad } from "./drawRoad";
import { drawCar } from "./drawCar";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/lib/sim/road";

export function computeScale(canvasW: number, canvasH: number): number {
  return Math.min(canvasW / WORLD_WIDTH, canvasH / WORLD_HEIGHT);
}

export function render(
  ctx: CanvasRenderingContext2D,
  cars: CarState[],
  selectedCarId: string | null,
  scale: number,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, height);

  drawRoad(ctx, scale);

  for (const car of cars) {
    drawCar(ctx, car, scale, car.id === selectedCarId);
  }
}
