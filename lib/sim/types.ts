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
}

export interface V2VMessage {
  fromCarId: string;
  timestamp: number;
  type: "state" | "intent" | "hazard";
  payload: unknown;
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

export interface KnownPeer {
  lastMessage: StateMessagePayload;
  lastSeenAt: number; // sim time in seconds
}
