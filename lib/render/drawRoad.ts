import {
  ROAD_LENGTH,
  LANE_WIDTH,
  NUM_LANES,
  laneCenter,
  onrampY,
  offrampY,
  ONRAMP_START_X,
  ONRAMP_START_Y,
  ONRAMP_MERGE_X,
  OFFRAMP_START_X,
  OFFRAMP_END_X,
  OFFRAMP_END_Y,
} from "@/lib/sim/road";

function wx(worldX: number, scale: number) { return worldX * scale; }
function wy(worldY: number, scale: number) { return worldY * scale; }

export function drawRoad(ctx: CanvasRenderingContext2D, scale: number): void {
  const roadTop = (laneCenter(0) - LANE_WIDTH / 2) * scale;
  const roadBottom = (laneCenter(2) + LANE_WIDTH / 2) * scale;
  const roadLeft = 0;
  const roadRight = ROAD_LENGTH * scale;

  // Road surface
  ctx.fillStyle = "#374151";
  ctx.fillRect(roadLeft, roadTop, roadRight, roadBottom - roadTop);

  // On-ramp surface (trapezoid approximated by a filled path)
  ctx.beginPath();
  ctx.moveTo(wx(ONRAMP_START_X, scale), wy(ONRAMP_START_Y - LANE_WIDTH / 2, scale));
  for (let x = ONRAMP_START_X; x <= ONRAMP_MERGE_X; x += 1) {
    ctx.lineTo(wx(x, scale), wy(onrampY(x) - LANE_WIDTH / 2, scale));
  }
  for (let x = ONRAMP_MERGE_X; x >= ONRAMP_START_X; x -= 1) {
    ctx.lineTo(wx(x, scale), wy(onrampY(x) + LANE_WIDTH / 2, scale));
  }
  ctx.closePath();
  ctx.fillStyle = "#374151";
  ctx.fill();

  // Exit-ramp surface
  ctx.beginPath();
  ctx.moveTo(wx(OFFRAMP_START_X, scale), wy(offrampY(OFFRAMP_START_X) - LANE_WIDTH / 2, scale));
  for (let x = OFFRAMP_START_X; x <= OFFRAMP_END_X; x += 1) {
    ctx.lineTo(wx(x, scale), wy(offrampY(x) - LANE_WIDTH / 2, scale));
  }
  for (let x = OFFRAMP_END_X; x >= OFFRAMP_START_X; x -= 1) {
    ctx.lineTo(wx(x, scale), wy(offrampY(x) + LANE_WIDTH / 2, scale));
  }
  ctx.closePath();
  ctx.fill();

  // Lane dividers (dashed white)
  ctx.setLineDash([Math.round(scale * 8), Math.round(scale * 6)]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#9ca3af";
  for (let lane = 0; lane < NUM_LANES - 1; lane++) {
    const y = wy(laneCenter(lane as 0 | 1 | 2) + LANE_WIDTH / 2, scale);
    ctx.beginPath();
    ctx.moveTo(roadLeft, y);
    ctx.lineTo(roadRight, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Road edges (solid white)
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f1f5f9";
  ctx.beginPath();
  ctx.moveTo(roadLeft, roadTop);
  ctx.lineTo(roadRight, roadTop);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(roadLeft, roadBottom);
  ctx.lineTo(roadRight, roadBottom);
  ctx.stroke();

  // On-ramp centerline (dotted yellow)
  ctx.setLineDash([Math.round(scale * 3), Math.round(scale * 4)]);
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wx(ONRAMP_START_X, scale), wy(ONRAMP_START_Y, scale));
  for (let x = ONRAMP_START_X; x <= ONRAMP_MERGE_X; x += 1) {
    ctx.lineTo(wx(x, scale), wy(onrampY(x), scale));
  }
  ctx.stroke();

  // Exit-ramp centerline
  ctx.beginPath();
  ctx.moveTo(wx(OFFRAMP_START_X, scale), wy(offrampY(OFFRAMP_START_X), scale));
  for (let x = OFFRAMP_START_X; x <= OFFRAMP_END_X; x += 1) {
    ctx.lineTo(wx(x, scale), wy(offrampY(x), scale));
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // "On-ramp" / "Exit" labels
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("ON-RAMP", wx(ONRAMP_START_X + 30, scale), wy(ONRAMP_START_Y + 6, scale));
  ctx.fillText("EXIT", wx(OFFRAMP_END_X - 15, scale), wy(OFFRAMP_END_Y + 6, scale));
}
