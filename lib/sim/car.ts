import type { CarState, LaneId, Intent } from "./types";
import {
  laneCenter,
  onrampY,
  offrampY,
  ROAD_LENGTH,
  ONRAMP_START_X,
  ONRAMP_MERGE_X,
  OFFRAMP_START_X,
  OFFRAMP_END_X,
} from "./road";

let nextId = 0;

export function makeCarId(): string {
  return `C${String(nextId++).padStart(2, "0")}`;
}

export function resetIdCounter(): void {
  nextId = 0;
}

function targetY(lane: LaneId, x: number): number {
  if (lane === "onramp") return onrampY(x);
  if (lane === "offramp") return offrampY(x);
  return laneCenter(lane as 0 | 1 | 2);
}

export class Car {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lane: LaneId;
  targetSpeed: number;
  intent: Intent;
  radioRange: number;
  radioPeers: string[] = [];

  constructor(opts: Partial<CarState> & { id?: string } = {}) {
    this.id = opts.id ?? makeCarId();
    this.lane = opts.lane ?? 0;
    this.x = opts.x ?? 0;
    this.targetSpeed = opts.targetSpeed ?? 28;
    this.vx = opts.vx ?? this.targetSpeed;
    this.y = opts.y ?? targetY(this.lane, this.x);
    this.vy = opts.vy ?? 0;
    this.intent = opts.intent ?? "cruise";
    this.radioRange = opts.radioRange ?? 80;
  }

  update(dt: number): void {
    // v0: pure lane-following at target speed, no coordination
    this.vx = this.targetSpeed;
    this.vy = 0;

    this.x += this.vx * dt;

    // Snap y toward lane centerline
    const cy = targetY(this.lane, this.x);
    this.y += (cy - this.y) * Math.min(1, 5 * dt);

    // On-ramp cars transition to lane 2 once past the merge point
    if (this.lane === "onramp" && this.x >= ONRAMP_MERGE_X) {
      this.lane = 2;
    }

    // TODO: v1 — off-ramp cars should peel away; for now, wrap like highway cars
    if (this.lane === "offramp" && this.x >= OFFRAMP_END_X) {
      this.x = 0;
      this.lane = 2;
      this.intent = "cruise";
    }

    // Toroidal wrap at end of road section
    if (this.x > ROAD_LENGTH) {
      this.x -= ROAD_LENGTH;
    }
    if (this.x < ONRAMP_START_X && this.lane === "onramp") {
      // keep on ramp start
    }
  }

  state(): CarState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      lane: this.lane,
      targetSpeed: this.targetSpeed,
      intent: this.intent,
      radioRange: this.radioRange,
      radioPeers: [...this.radioPeers],
    };
  }
}
