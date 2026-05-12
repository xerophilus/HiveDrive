import type { CarState, LaneId, Intent, KnownPeer, StateMessagePayload } from "./types";
import type { MessageBus } from "./messageBus";
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

// ACC constants
const ACC_LOOKAHEAD = 60;    // metres — sensor range
const CAR_LENGTH = 10;       // world units (matches drawCar CAR_W)
const DESIRED_HEADWAY = 1.5; // seconds of gap
const MAX_DECEL = 4;         // m/s²
const MAX_ACCEL = 2;         // m/s²
const ACC_KP = 0.3;          // proportional gain: deficit × kp → decel

// V2V publish rate
const PEER_STALE_TIME = 2.0; // seconds — drop peers not heard from

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

  // v1 additions
  knownPeers: Map<string, KnownPeer> = new Map();
  gapAhead: number | null = null;
  /** Set to true when car finishes exit ramp; world removes it next tick */
  shouldRemove = false;

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

  /**
   * Compute ACC acceleration given the current set of cars in the world.
   * Reads ground-truth positions — V2V data is not used for decisions in v1.
   * Also stores this.gapAhead as a side-effect for the debug panel.
   */
  acc(allCars: Car[]): number {
    let minDx = Infinity;

    for (const other of allCars) {
      if (other.id === this.id || other.lane !== this.lane) continue;

      let dx = other.x - this.x;

      // Toroidal wrap only applies to highway lanes
      if (typeof this.lane === "number") {
        if (dx < 0) dx += ROAD_LENGTH;
      }

      // Only consider cars ahead within the lookahead range
      if (dx > 0 && dx <= ACC_LOOKAHEAD) {
        if (dx < minDx) minDx = dx;
      }
    }

    if (minDx === Infinity) {
      this.gapAhead = null;
      // No car ahead — accelerate back toward target speed
      return Math.min(MAX_ACCEL, (this.targetSpeed - this.vx) * 1.0);
    }

    const gap = minDx - CAR_LENGTH;
    this.gapAhead = Math.max(0, gap);
    const desiredGap = DESIRED_HEADWAY * Math.max(this.vx, 1);

    if (gap < desiredGap) {
      const deficit = desiredGap - gap;
      return -Math.min(MAX_DECEL, deficit * ACC_KP);
    }
    return Math.min(MAX_ACCEL, (this.targetSpeed - this.vx) * 1.0);
  }

  /**
   * Publish a state V2V message. Called by World at 10 Hz.
   * Returns the number of cars that received the delivery (for rate accounting).
   */
  publishState(bus: MessageBus, simTime: number): number {
    const payload: StateMessagePayload = {
      carId: this.id,
      timestamp: simTime,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      lane: this.lane,
      intent: this.intent,
    };
    return bus.publish(
      { fromCarId: this.id, timestamp: simTime, type: "state", payload },
      { x: this.x, y: this.y },
    );
  }

  /** Called by the bus handler in World.addCar() when a V2V message arrives. */
  receiveV2VMessage(payload: StateMessagePayload, simTime: number): void {
    this.knownPeers.set(payload.carId, { lastMessage: payload, lastSeenAt: simTime });
  }

  /** Remove peers not heard from in the last PEER_STALE_TIME seconds. */
  cleanupStaleKnownPeers(simTime: number): void {
    for (const [id, peer] of this.knownPeers) {
      if (simTime - peer.lastSeenAt > PEER_STALE_TIME) {
        this.knownPeers.delete(id);
      }
    }
  }

  /**
   * Advance the car by dt seconds.
   * @param dt     Fixed timestep (1/60 s)
   * @param accel  Acceleration in m/s² from ACC (negative = decelerate)
   */
  update(dt: number, accel: number): void {
    // Apply acceleration; clamp speed to [0, 1.5 × targetSpeed]
    this.vx = Math.max(0, Math.min(this.targetSpeed * 1.5, this.vx + accel * dt));
    this.vy = 0;

    this.x += this.vx * dt;

    // Exiting cars in lane 2 branch onto the off-ramp at OFFRAMP_START_X
    if (this.lane === 2 && this.intent === "exiting" && this.x >= OFFRAMP_START_X) {
      this.lane = "offramp";
    }

    // Off-ramp: car has reached the end — flag for removal (no wrap)
    if (this.lane === "offramp" && this.x >= OFFRAMP_END_X) {
      this.shouldRemove = true;
      return;
    }

    // Snap y toward lane centerline
    const cy = targetY(this.lane, this.x);
    this.y += (cy - this.y) * Math.min(1, 5 * dt);

    // On-ramp cars transition to lane 2 once past the merge point
    if (this.lane === "onramp" && this.x >= ONRAMP_MERGE_X) {
      this.lane = 2;
    }

    // Toroidal wrap — only highway (non-ramp, non-exiting) cars
    if (
      typeof this.lane === "number" &&
      this.intent !== "exiting" &&
      this.x > ROAD_LENGTH
    ) {
      this.x -= ROAD_LENGTH;
    }

    // Keep on-ramp cars from going below their start x
    if (this.x < ONRAMP_START_X && this.lane === "onramp") {
      this.x = ONRAMP_START_X;
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
      knownPeerIds: Array.from(this.knownPeers.keys()),
      gapAhead: this.gapAhead,
    };
  }
}
