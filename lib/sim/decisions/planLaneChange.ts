import type { Car } from "../car";
import { LANE_CHANGE_CLEARANCE_BACK, LANE_CHANGE_CLEARANCE_AHEAD } from "../tuning";

/**
 * Returns true if a lane change to `targetLane` is safe for `self`.
 *
 * Safe = no peer currently in targetLane (or transitioning to it) is within
 * [-CLEARANCE_BACK, +CLEARANCE_AHEAD] of self's x position.
 *
 * Uses ground-truth positions for reliability.
 */
export function planLaneChange(
  self: Car,
  targetLane: 0 | 1 | 2,
  allCars: Car[],
): boolean {
  for (const other of allCars) {
    if (other.id === self.id) continue;
    // Consider cars already in the target lane or currently transitioning into it
    if (other.lane !== targetLane && other.laneChangeTarget !== targetLane) continue;

    const dx = other.x - self.x;
    if (dx >= -LANE_CHANGE_CLEARANCE_BACK && dx <= LANE_CHANGE_CLEARANCE_AHEAD) {
      return false;
    }
  }
  return true;
}
