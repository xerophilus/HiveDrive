import type { CarState } from "@/lib/sim/types";

const CAR_W = 10;  // world units
const CAR_H = 7;

const LANE_COLORS: Record<string, string> = {
  "0": "#60a5fa",
  "1": "#34d399",
  "2": "#a78bfa",
  onramp: "#fbbf24",
  offramp: "#f87171",
};

const INTENT_COLORS: Record<string, string> = {
  exiting: "#f97316",
  merging: "#ec4899",
};

export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: CarState,
  scale: number,
  selected: boolean,
): void {
  const sx = car.x * scale;
  const sy = car.y * scale;
  const sw = CAR_W * scale;
  const sh = CAR_H * scale;

  const color = INTENT_COLORS[car.intent] ?? LANE_COLORS[String(car.lane)] ?? "#94a3b8";

  // Radio range circle (selected only) — drawn in screen space
  if (selected) {
    ctx.beginPath();
    ctx.arc(sx, sy, car.radioRange * scale, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(96,165,250,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(96,165,250,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh);

  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh);
  }

  // ID label in screen-space pixels
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold ${Math.max(8, Math.round(sh * 0.55))}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(car.id, sx, sy);
}
