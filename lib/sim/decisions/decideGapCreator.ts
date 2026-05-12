import type { Car } from "../car";
import type { MergeIntentPayload } from "../types";

/**
 * Returns true if `self` is the lane-2 car that should open a gap for the incoming merger.
 *
 * Election rule: among lane-2 cars whose projected position at projectedMergeTime
 * is at or behind projectedMergeX, elect the one closest behind (highest projected x).
 * Ties break by lower carId.
 *
 * Uses V2V-known peer data — may lag up to ~100 ms, which is acceptable.
 */
export function decideGapCreator(
  self: Car,
  payload: MergeIntentPayload,
  simTime: number,
): boolean {
  if (self.lane !== 2) return false;

  const selfDt = Math.max(0, payload.projectedMergeTime - simTime);
  const selfProjectedX = self.x + self.vx * selfDt;

  // We'd arrive ahead of the merge point — not the right car to create a gap behind
  if (selfProjectedX > payload.projectedMergeX + 5) return false;

  // Check all known lane-2 peers: if any would be closer behind the merger, defer to them
  for (const [peerId, peer] of self.knownPeers) {
    if (peer.lastMessage.lane !== 2) continue;

    // Project peer forward from their last known state timestamp
    const peerDt = Math.max(0, payload.projectedMergeTime - peer.lastMessage.timestamp);
    const peerProjectedX = peer.lastMessage.x + peer.lastMessage.vx * peerDt;

    if (peerProjectedX > payload.projectedMergeX + 5) continue; // peer would be ahead — skip

    if (peerProjectedX > selfProjectedX) return false; // peer is closer behind → not us
    if (peerProjectedX === selfProjectedX && peerId < self.id) return false; // tie: lower id wins
  }

  return true;
}
