# HiveDrive

Browser-based cooperative driving simulator.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Controls

| Control | Action |
|---|---|
| Play / Pause | Toggle simulation |
| Step | Advance one 60 Hz tick (only when paused) |
| Speed slider | 0.25x – 4x simulation speed |
| + On-ramp car | Spawn a new car at the on-ramp |
| Mark random exit | Flag any cruising highway car as "exiting" — it lane-changes to lane 2, then curves off the exit ramp |
| Click a car | Select it — shows radio range circle and V2V peer lines |

## What's working in v1

- **ACC (Adaptive Cruise Control):** each car detects the nearest car ahead in its lane (within 60 m, ground-truth only) and applies a simple proportional speed controller — decel cap 4 m/s², accel cap 2 m/s². Cars form natural platoons; no car drives through another.
- **V2V message bus wired:** every car broadcasts a `state` message at 10 Hz containing position, velocity, lane, and intent. Every car maintains a `knownPeers` map of cars heard within its 80 m radio range, expiring stale entries after 2 s. V2V data is **not yet used for decisions** (that's v2).
- **Peer visualisation:** selecting a car draws translucent lines to all cars it has heard from via V2V. The debug panel shows `tx / rx msg/s` live.
- **Exit logic:** marking a lane-2 car "exiting" causes it to follow the exit-ramp curve when it reaches the branch point, then be removed from the world. Total car count drops; spawning an on-ramp car increases it back.
- **"Mark random exit" button** only picks from lane-2 cars and shows a brief toast if none are available.

## What's working in v2

- **Cooperative merge protocol:** on-ramp cars broadcast `merge-intent` at 10 Hz once they enter the merge zone (50 m before the highway join point). Lane-2 cars within the lookahead window self-elect a single gap creator — the one whose projected position would be immediately behind the merger at merge time. The elected car bumps its ACC headway to 3.0 s, opening a gap, and sends a `gap-creating` ack. When the merger receives the ack it begins a smooth cosine lateral transition into lane 2 over ~2 s instead of snapping in. Gap creator's headway resets to 1.5 s once the merger's intent returns to `cruise`.
- **Abort path:** if no ack arrives within 1 s (e.g. no lane-2 cars in radio range), the merger logs a warning and falls back to the v1 snap-in at the merge point.
- **Discretionary lane changes for exiting cars:** "Mark random exit" now picks any cruising highway car, not just lane-2 cars. Cars in lane 0 or 1 plan a right-lane change when within 200 m of the exit, checking a 15 m / 30 m clearance window with ground-truth positions. Each hop (0→1, 1→2) uses a 1.5 s cosine lateral transition. If the car reaches the exit without making it to lane 2, it logs a warning and reverts to `cruise`.
- **Debug panel additions:** per-car columns for `hdwy` (desired headway — yellowed at 3.0), `gapFor` (which merger a car is opening space for), and `lcTo` (lane-change target and % progress). Header shows global `merges` and `lane-changes` counts.
- **Visual cues:** gap-creating cars get a yellow tint and outline; mid-lane-change cars show a white arrow pointing toward their target lane.
- **Tuning knobs:** all threshold values live in `lib/sim/tuning.ts` — headways, zone sizes, clearances, durations.

## Known awkward behaviours (tweaking targets)

- **Gap size (3.0 s headway):** may feel too large at highway speeds. Tune `GAP_CREATING_HEADWAY` in `tuning.ts`.
- **Lookahead window (100 m back / 30 m forward):** can be too narrow if traffic is light, causing the election to miss. Tune `MERGE_ZONE_BEHIND` / `MERGE_ZONE_AHEAD`.
- **Lane-change clearance (15 m / 30 m):** tighter than real human merges but prevents rear-end surprises. Tune `LANE_CHANGE_CLEARANCE_*`.
- **Transition durations (2 s merge, 1.5 s lane change):** purely feel — tune `MERGE_TRANSITION_DURATION` / `LANE_CHANGE_DURATION`.
- **Fallback snap:** when the abort path fires the merger still jumps into lane 2 at x=150, which can overlap another car. A future improvement would queue it on the ramp instead.
- **Two simultaneous on-ramp cars:** both broadcast merge-intent; each may elect a different gap creator. Works in practice but isn't explicitly coordinated.

## Architecture & context

See [PLAN.md](./PLAN.md) for the full v0 spec and [V2_PLAN.md](./V2_PLAN.md) for v2 goals and architectural details. Decision logic lives in `lib/sim/decisions/`; all tuning constants are in `lib/sim/tuning.ts`.
