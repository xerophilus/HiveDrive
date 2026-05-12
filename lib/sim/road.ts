export const ROAD_LENGTH = 500;  // world units (meters)
export const LANE_WIDTH = 15;    // meters per lane — wider for visual clarity
export const NUM_LANES = 3;
export const LANE_Y_BASE = 15;   // center of lane 0 in world-y

export function laneCenter(lane: 0 | 1 | 2): number {
  return LANE_Y_BASE + lane * LANE_WIDTH;
}

// On-ramp enters from below, merges into lane 2 around x=150
export const ONRAMP_START_X = 20;
export const ONRAMP_START_Y = 80;
export const ONRAMP_MERGE_X = 150;

// Exit ramp peels off lane 2 between x=350 and x=460
export const OFFRAMP_START_X = 350;
export const OFFRAMP_END_X = 460;
export const OFFRAMP_END_Y = 80;

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function onrampY(x: number): number {
  const t = (x - ONRAMP_START_X) / (ONRAMP_MERGE_X - ONRAMP_START_X);
  return ONRAMP_START_Y * (1 - smoothstep(t)) + laneCenter(2) * smoothstep(t);
}

export function offrampY(x: number): number {
  const t = (x - OFFRAMP_START_X) / (OFFRAMP_END_X - OFFRAMP_START_X);
  return laneCenter(2) * (1 - smoothstep(t)) + OFFRAMP_END_Y * smoothstep(t);
}

// World bounding box (for renderer scale computation)
export const WORLD_WIDTH = ROAD_LENGTH;
export const WORLD_HEIGHT = 95; // covers road + ramps below
