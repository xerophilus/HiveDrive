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
  /** ids of cars currently within radioRange */
  radioPeers: string[];
}

export interface V2VMessage {
  fromCarId: string;
  timestamp: number;
  type: "state" | "intent" | "hazard";
  payload: unknown;
}
