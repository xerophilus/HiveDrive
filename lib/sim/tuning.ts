// v2 tuning constants — tweak values here without hunting through logic

// ACC headway
export const DESIRED_HEADWAY = 1.5;       // seconds of following gap (default)
export const GAP_CREATING_HEADWAY = 3.0;  // seconds when opening a merge gap

// Merge protocol
export const MERGE_ZONE_OFFSET = 50;      // metres before ONRAMP_MERGE_X to start broadcasting
export const MERGE_ZONE_BEHIND = 100;     // metres behind projectedMergeX for lookahead window
export const MERGE_ZONE_AHEAD = 30;       // metres ahead of projectedMergeX for lookahead window
export const GAP_CREATOR_TIMEOUT = 1.0;   // seconds to wait for gap-creating ack before fallback
export const MERGE_TRANSITION_DURATION = 2.0; // seconds for lateral merge transition

// Exit lane changes
export const EXIT_PLAN_DISTANCE = 200;    // metres before exit to start planning lane change
export const LANE_CHANGE_CLEARANCE_BACK = 15;  // metres clearance behind self
export const LANE_CHANGE_CLEARANCE_AHEAD = 30; // metres clearance ahead of self
export const LANE_CHANGE_DURATION = 1.5;  // seconds for lateral lane-change transition
