export type LaneId = 0 | 1 | 2 | "onramp" | "offramp";

export type Intent = "cruise" | "merging" | "exiting";

export interface CarState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lane: LaneId;
  targetSpeed: number;
  intent: Intent;
  radioRange: number;
  /** ids of cars currently within radioRange (ground-truth, updated each tick) */
  radioPeers: string[];
  /** ids of cars known via V2V messages (may lag up to 2 s) */
  knownPeerIds: string[];
  /** distance in metres to the nearest car ahead in the same lane, null if none within 60 m */
  gapAhead: number | null;
  // v2 additions
  desiredHeadway: number;
  gapCreatingFor: string | null;
  laneChangeTarget: number | null;
  laneChangeProgress: number;
}

export interface StateMessagePayload {
  carId: string;
  timestamp: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lane: LaneId;
  intent: Intent;
}

export interface MergeIntentPayload {
  targetLane: number;
  projectedMergeX: number;
  projectedMergeTime: number; // sim time in seconds
  currentSpeed: number;
}

export interface GapCreatingPayload {
  forCarId: string;
  expectedGapX: number;
}

export type V2VMessage =
  | { fromCarId: string; timestamp: number; type: "state"; payload: StateMessagePayload }
  | { fromCarId: string; timestamp: number; type: "merge-intent"; payload: MergeIntentPayload }
  | { fromCarId: string; timestamp: number; type: "gap-creating"; payload: GapCreatingPayload };

export interface KnownPeer {
  lastMessage: StateMessagePayload;
  lastSeenAt: number; // sim time in seconds
}
