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

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, height);

  drawRoad(ctx, scale);

  // Draw V2V peer lines for the selected car (behind cars so lines don't overlap labels)
  if (selectedCarId) {
    const selected = cars.find((c) => c.id === selectedCarId);
    if (selected && selected.knownPeerIds.length > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(96,165,250,0.3)";
      ctx.lineWidth = 1;
      for (const peerId of selected.knownPeerIds) {
        const peer = cars.find((c) => c.id === peerId);
        if (!peer) continue;
        ctx.beginPath();
        ctx.moveTo(selected.x * scale, selected.y * scale);
        ctx.lineTo(peer.x * scale, peer.y * scale);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  for (const car of cars) {
    drawCar(ctx, car, scale, car.id === selectedCarId);
  }
}
