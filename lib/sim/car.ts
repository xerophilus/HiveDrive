import type {
  CarState,
  LaneId,
  Intent,
  KnownPeer,
  StateMessagePayload,
  V2VMessage,
  MergeIntentPayload,
  GapCreatingPayload,
} from "./types";
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
import {
  DESIRED_HEADWAY,
  GAP_CREATING_HEADWAY,
  MERGE_ZONE_OFFSET,
  MERGE_ZONE_BEHIND,
  MERGE_ZONE_AHEAD,
  MERGE_TRANSITION_DURATION,
  GAP_CREATOR_TIMEOUT,
} from "./tuning";
import { decideGapCreator } from "./decisions/decideGapCreator";

let nextId = 0;

export function makeCarId(): string {
  return `C${String(nextId++).padStart(2, "0")}`;
}

export function resetIdCounter(): void {
  nextId = 0;
}

// ACC constants
const ACC_LOOKAHEAD = 60;  // metres — sensor range
const CAR_LENGTH = 10;     // world units (matches drawCar CAR_W)
const MAX_DECEL = 4;       // m/s²
const MAX_ACCEL = 2;       // m/s²
const ACC_KP = 0.3;        // proportional gain

// V2V peer tracking
const PEER_STALE_TIME = 2.0; // seconds

const MERGE_ZONE_START_X = ONRAMP_MERGE_X - MERGE_ZONE_OFFSET;

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

  // v1
  knownPeers: Map<string, KnownPeer> = new Map();
  gapAhead: number | null = null;
  shouldRemove = false;

  // v2: headway & gap creation
  desiredHeadway: number = DESIRED_HEADWAY;
  gapCreatingFor: string | null = null;

  // v2: lateral transitions
  laneChangeTarget: number | null = null;
  laneChangeProgress: number = 0;
  laneChangeFromY: number = 0;
  laneChangeToY: number = 0;
  laneChangeDuration: number = 0;

  // v2: merge state (on-ramp cars only)
  private mergeIntentStartTime: number = -1;
  private gapCreatingAckReceived: boolean = false;
  private mergeAbortLogged: boolean = false;

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
   * ACC: compute acceleration toward targetSpeed while keeping safe headway.
   * Uses effectiveLane (current or target) so transitioning cars see the right traffic.
   */
  acc(allCars: Car[]): number {
    const myEffLane: LaneId | number = this.laneChangeTarget ?? this.lane;
    let minDx = Infinity;

    for (const other of allCars) {
      if (other.id === this.id) continue;

      // Include other if they're in my current lane OR their effective lane matches mine
      const otherEffLane: LaneId | number = other.laneChangeTarget ?? other.lane;
      const inMyPath = other.lane === this.lane || otherEffLane === myEffLane;
      if (!inMyPath) continue;

      let dx = other.x - this.x;

      // Toroidal wrap only for highway (numeric) lanes
      if (typeof myEffLane === "number") {
        if (dx < 0) dx += ROAD_LENGTH;
      }

      if (dx > 0 && dx <= ACC_LOOKAHEAD) {
        if (dx < minDx) minDx = dx;
      }
    }

    if (minDx === Infinity) {
      this.gapAhead = null;
      return Math.min(MAX_ACCEL, (this.targetSpeed - this.vx) * 1.0);
    }

    const gap = minDx - CAR_LENGTH;
    this.gapAhead = Math.max(0, gap);
    const desiredGap = this.desiredHeadway * Math.max(this.vx, 1);

    if (gap < desiredGap) {
      const deficit = desiredGap - gap;
      return -Math.min(MAX_DECEL, deficit * ACC_KP);
    }
    return Math.min(MAX_ACCEL, (this.targetSpeed - this.vx) * 1.0);
  }

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

  publishMergeIntent(bus: MessageBus, simTime: number): void {
    if (this.mergeIntentStartTime < 0) {
      this.mergeIntentStartTime = simTime;
    }
    const speed = Math.max(this.vx, 1);
    const timeToMerge = (ONRAMP_MERGE_X - this.x) / speed;
    const payload: MergeIntentPayload = {
      targetLane: 2,
      projectedMergeX: ONRAMP_MERGE_X,
      projectedMergeTime: simTime + timeToMerge,
      currentSpeed: speed,
    };
    bus.publish(
      { fromCarId: this.id, timestamp: simTime, type: "merge-intent", payload },
      { x: this.x, y: this.y },
    );
  }

  publishGapCreating(bus: MessageBus, simTime: number, forCarId: string): void {
    const payload: GapCreatingPayload = {
      forCarId,
      expectedGapX: this.x + this.desiredHeadway * this.vx,
    };
    bus.publish(
      { fromCarId: this.id, timestamp: simTime, type: "gap-creating", payload },
      { x: this.x, y: this.y },
    );
  }

  /** Called by the bus handler in World.addCar() when any V2V message arrives. */
  receiveV2VMessage(msg: V2VMessage, simTime: number, bus: MessageBus): void {
    if (msg.type === "state") {
      const payload = msg.payload;
      this.knownPeers.set(payload.carId, { lastMessage: payload, lastSeenAt: simTime });

      // Gap creator: reset headway once our merger has finished merging
      if (this.gapCreatingFor === payload.carId && payload.intent !== "merging") {
        this.desiredHeadway = DESIRED_HEADWAY;
        this.gapCreatingFor = null;
      }
    } else if (msg.type === "merge-intent") {
      const payload = msg.payload;
      // Only lane-2 cars that aren't already gap-creating or lane-changing respond
      if (
        this.lane === 2 &&
        this.gapCreatingFor === null &&
        this.laneChangeTarget === null
      ) {
        const inWindow =
          this.x >= payload.projectedMergeX - MERGE_ZONE_BEHIND &&
          this.x <= payload.projectedMergeX + MERGE_ZONE_AHEAD;

        if (inWindow && decideGapCreator(this, payload, simTime)) {
          this.desiredHeadway = GAP_CREATING_HEADWAY;
          this.gapCreatingFor = msg.fromCarId;
          this.publishGapCreating(bus, simTime, msg.fromCarId);
        }
      }
    } else if (msg.type === "gap-creating") {
      // On-ramp merger receives acknowledgement that a gap is being prepared for it
      if (this.lane === "onramp" && msg.payload.forCarId === this.id) {
        this.gapCreatingAckReceived = true;
      }
    }
  }

  /** Remove peers not heard from in the last PEER_STALE_TIME seconds. */
  cleanupStaleKnownPeers(simTime: number): void {
    for (const [id, peer] of this.knownPeers) {
      if (simTime - peer.lastSeenAt > PEER_STALE_TIME) {
        this.knownPeers.delete(id);
      }
    }
    // Safety reset: if the merger we were helping has gone stale, release the gap
    if (this.gapCreatingFor !== null && !this.knownPeers.has(this.gapCreatingFor)) {
      this.desiredHeadway = DESIRED_HEADWAY;
      this.gapCreatingFor = null;
    }
  }

  startLaneChange(
    targetLane: number,
    fromY: number,
    toY: number,
    duration: number,
  ): void {
    this.laneChangeTarget = targetLane;
    this.laneChangeProgress = 0;
    this.laneChangeFromY = fromY;
    this.laneChangeToY = toY;
    this.laneChangeDuration = duration;
  }

  /**
   * Advance the car by dt seconds.
   * @param dt       Fixed timestep (1/60 s)
   * @param accel    Acceleration from ACC (m/s²)
   * @param simTime  Current sim clock (seconds)
   */
  update(dt: number, accel: number, simTime: number): void {
    // Apply acceleration; clamp speed
    this.vx = Math.max(0, Math.min(this.targetSpeed * 1.5, this.vx + accel * dt));
    this.vy = 0;

    this.x += this.vx * dt;

    // --- On-ramp merge logic ---
    if (this.lane === "onramp") {
      // Enter merge zone: flip intent to merging
      if (this.x >= MERGE_ZONE_START_X && this.intent !== "merging") {
        this.intent = "merging";
      }

      // Fallback: no ack within timeout → log and allow v1 snap
      if (
        this.intent === "merging" &&
        !this.gapCreatingAckReceived &&
        !this.mergeAbortLogged &&
        this.mergeIntentStartTime > 0 &&
        simTime - this.mergeIntentStartTime > GAP_CREATOR_TIMEOUT
      ) {
        console.warn(`Car ${this.id}: no gap creator found, falling back to v1 snap`);
        this.mergeAbortLogged = true;
      }

      // Start smooth lateral transition once ack received
      if (
        this.gapCreatingAckReceived &&
        this.laneChangeTarget === null &&
        this.x >= MERGE_ZONE_START_X
      ) {
        this.startLaneChange(2, this.y, laneCenter(2), MERGE_TRANSITION_DURATION);
      }
    }

    // --- Execute lateral transition (merge or lane change) ---
    if (this.laneChangeTarget !== null) {
      this.laneChangeProgress = Math.min(
        1,
        this.laneChangeProgress + dt / this.laneChangeDuration,
      );
      const ease = (1 - Math.cos(Math.PI * this.laneChangeProgress)) / 2;
      this.y = this.laneChangeFromY + (this.laneChangeToY - this.laneChangeFromY) * ease;

      if (this.laneChangeProgress >= 1) {
        this.lane = this.laneChangeTarget as LaneId;
        this.y = this.laneChangeToY;
        this.laneChangeTarget = null;
        if (this.intent === "merging") {
          this.intent = "cruise";
        }
      }
    } else {
      // Normal y-snap toward lane centerline (skip while transitioning)
      const cy = targetY(this.lane, this.x);
      this.y += (cy - this.y) * Math.min(1, 5 * dt);
    }

    // --- Exiting: branch onto off-ramp when in lane 2 ---
    if (this.lane === 2 && this.intent === "exiting" && this.x >= OFFRAMP_START_X) {
      this.lane = "offramp";
    }

    // Off-ramp: flag for removal at end
    if (this.lane === "offramp" && this.x >= OFFRAMP_END_X) {
      this.shouldRemove = true;
      return;
    }

    // On-ramp fallback snap: no smooth transition started, car has passed merge point
    if (this.lane === "onramp" && this.x >= ONRAMP_MERGE_X && this.laneChangeTarget === null) {
      this.lane = 2;
      this.intent = "cruise";
      this.y = laneCenter(2);
    }

    // Toroidal wrap — highway (non-ramp, non-exiting) cars only
    if (
      typeof this.lane === "number" &&
      this.intent !== "exiting" &&
      this.x > ROAD_LENGTH
    ) {
      this.x -= ROAD_LENGTH;
    }

    // Keep on-ramp cars from reversing past their start
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
      desiredHeadway: this.desiredHeadway,
      gapCreatingFor: this.gapCreatingFor,
      laneChangeTarget: this.laneChangeTarget,
      laneChangeProgress: this.laneChangeProgress,
    };
  }
}
