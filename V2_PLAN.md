# HiveDrive — v2 Plan

## Context

v0 + v1 are done. We have a 3-lane highway, on/off ramps, ACC keeping cars from colliding, V2V messages flowing at 10Hz, exits working for lane-2 cars. What’s missing: cars don’t actually *cooperate*. Merges are snap-in collisions, exits require manual lane selection, slowdowns ripple as shockwaves.

v2 is where HiveDrive earns its name. Cars use V2V data to coordinate gap creation for merges, change lanes intelligently, and execute smoother transitions.

## Goals for v2

### 1. Cooperative merge protocol (the big one)

When a car is on the on-ramp, it broadcasts a `merge-intent` message. Cars in lane 2 (the receiving lane) within a lookahead window negotiate which one creates the gap, then open it *before* the merger arrives.

**Protocol steps:**

1. **Intent broadcast.** When an on-ramp car’s `x` reaches a “merge zone start” point (say, 50m before the ramp joins the highway), it begins broadcasting `merge-intent` at 10Hz alongside its normal state messages. Payload: `{ targetLane: 2, projectedMergeX, projectedMergeTime, currentSpeed }`.
1. **Gap selection.** Each lane-2 car receiving a `merge-intent` computes whether it’s the “gap creator” — defined as: *the lane-2 car that will be immediately behind the merger at `projectedMergeX`*. Uses peer data from V2V messages to know other lane-2 cars’ positions. Exactly one car should self-elect (handle ties by lower carId).
1. **Gap creation.** The elected car increases its desired headway from 1.5s to 3.0s, which makes ACC slow it gently. This opens space in front of it. It broadcasts a `gap-creating` ack message so the merger knows the gap is being prepared.
1. **Merger lateral transition.** Once the merger receives a `gap-creating` ack AND its projected arrival aligns with the open gap, it begins a smooth lateral transition from the on-ramp curve into lane 2 (use a cosine or smoothstep over ~2 seconds, not a snap).
1. **Resume.** Once the merger’s `intent` flips from `merging` back to `cruise` (post-merge, ~1 second after lane 2 entry), the gap creator’s desired headway returns to 1.5s and the platoon re-tightens naturally.
1. **Abort cases.**
- If no lane-2 car self-elects within 1 second (e.g., no peers in range), merger falls back to v1 behavior (snap in — accept the imperfection) but logs a warning.
- If gap creator’s headway-3.0 still doesn’t produce enough gap by `projectedMergeTime` (e.g., car ahead of it is too close), merger delays entry by extending its time on the ramp curve until gap is sufficient. Worst case, it runs out of ramp and falls back to snap.

### 2. Discretionary lane changes for exit routing

Cars marked `exiting` that are not already in lane 2 navigate there.

- A car in lane 0 or 1 with `intent === 'exiting'` plans a lane change one lane to the right when it’s within 200m of the exit point
- Lane change requires: target lane has no peer within `[-15m, +30m]` relative to self at change time (15m back, 30m ahead clearance)
- Lane change executes as a smooth lateral transition over ~1.5 seconds (cosine ramp)
- If no safe gap is found, car defers and tries again next tick; if it reaches the exit point without making it to lane 2, log a warning and let it pass the exit (de-mark it back to `cruise`)
- “Mark random exit” button can now pick any car, not just lane-2 cars

### 3. Smoother lane transitions everywhere

Replace any remaining snap-in lane changes (on-ramp curve completion, exit-ramp entry) with cosine/smoothstep blends. Cars should glide between lane centerlines, not teleport.

## Explicit non-goals for v2

- **Hazard / slowdown propagation.** A lead car seeing an obstruction does not yet broadcast a hazard message that propagates through the chain. That’s v3 — and it’s the feature you originally described to me, so it gets its own dedicated increment.
- **Mixed participation.** All cars still have radios. Degrading gracefully when some cars are “dumb” is v4.
- **Sensor noise, dropped messages, latency.** Still perfect-world. v5.
- **Multi-car merges.** Only one on-ramp car merging at a time. If two are on the ramp simultaneously, the second one waits behind the first using normal ACC.
- **Cooperative speed harmonization** beyond merge gaps. Cars don’t yet collectively adjust speed to absorb shockwaves preemptively. Could be v3 or later.
- **Any actual ML.** Still hand-written heuristics. ML is a later phase once the protocol logic is stable enough to define a reward signal.
- **Negotiating priority between merger and exiter** if both want the same lane-2 space. v2 just lets them fight via the normal rules; if it looks bad in practice, we’ll add explicit priority in v3.

## Architecture changes

### New message types

```ts
type V2VMessage =
  | { type: 'state'; payload: StatePayload }
  | { type: 'merge-intent'; payload: MergeIntentPayload }
  | { type: 'gap-creating'; payload: GapCreatingPayload };

interface MergeIntentPayload {
  targetLane: number;
  projectedMergeX: number;
  projectedMergeTime: number;  // sim time, seconds
  currentSpeed: number;
}

interface GapCreatingPayload {
  forCarId: string;  // the merger this gap is for
  expectedGapX: number;
}
```

### Car state additions

```ts
interface CarState {
  // ...existing fields
  desiredHeadway: number;        // default 1.5, bumps to 3.0 when creating gap
  gapCreatingFor: string | null; // carId we're opening space for
  laneChangeTarget: number | null; // target lane during transition
  laneChangeProgress: number;    // 0..1 during transition
}
```

### New decision functions

Live in `lib/sim/decisions/`:

- `decideGapCreator(self, mergeIntent, peers): boolean` — am I the one to open the gap?
- `planLaneChange(self, world): { targetLane, safe: boolean } | null` — for exiting cars
- `executeLateralTransition(self, dt): void` — smooth blend between lane centerlines

ACC stays where it is in `car.ts`. Decision functions are pure and testable.

### Lookahead window for merge intent reception

Lane-2 cars consider themselves “in the merge zone” if they’re within `[projectedMergeX - 100m, projectedMergeX + 30m]`. Outside that window, they ignore merge-intent messages — keeps gap selection local.

## Debug panel additions

- Per-car: show current `desiredHeadway` (1.5 or 3.0), `gapCreatingFor` if set, `laneChangeTarget` if mid-change
- Global: `active merges` count, `active lane changes` count
- Visual: when a gap creator is opening space, render a yellow tint or outline on it. When a car is mid-lane-change, render an arrow showing target lane.

## Acceptance criteria

v2 is done when **all** of these are true:

1. On-ramp cars no longer collide with or snap into lane-2 cars. The merge looks visibly *cooperative* — you can see the gap open before the merger arrives.
1. Selecting an on-ramp car shows its `merge-intent` propagating; selecting the gap-creating lane-2 car shows it’s running headway 3.0 and tinted.
1. Marking exit on a lane-0 or lane-1 car causes it to traverse lanes to lane 2 before the exit point, then take the exit normally. Smooth lateral transitions, not snaps.
1. Shockwaves are reduced — a merge should cause less than 50% of the slowdown trickle visible in v1 (eyeball test, no formal measurement needed).
1. With 25+ cars and frequent merges/exits triggered by holding the buttons, sim stays at 60Hz, no crashes, no NaN propagation.
1. Abort paths actually work: spawn an on-ramp car when lane 2 is empty within radio range → it falls back to v1 snap and logs warning. Mark an exit on a car with no safe gap to its right → it tries, defers, eventually gives up at exit point.
1. Zero new TypeScript errors, zero new console errors (warnings from abort paths are expected and fine).
1. README updated with “What’s working in v2” section and a short “Known awkward behaviors” list noting things you want to tweak.

## Things that will likely feel awkward and need tweaking after you see it run

This is your tweaking targets list:

- **Gap size:** 3.0s headway may feel too aggressive (huge gaps) or too tight. Knob to tune.
- **Lookahead window:** 100m back / 30m forward for gap-creator selection. Could be too narrow on a fast highway or too wide for tight traffic.
- **Lane-change clearance:** 15m back / 30m forward. Real human merges are tighter.
- **Lateral transition speed:** 2s for merge, 1.5s for lane change. Pure feel — might want faster or slower.
- **Abort fallback to snap:** ugly but honest. You may want to make the merger queue up on the ramp instead.
- **Tie-breaking on gap selection:** lowest carId is arbitrary. Position-based (closest to merge point) might feel more natural but introduces edge cases.

Leave these as easy-to-find constants in a `lib/sim/tuning.ts` file so you can iterate on values without hunting through logic.

## What’s after v2

For your reference, so v2 hooks make sense:

- **v3:** Hazard propagation. Lead car detects slowdown/obstacle, broadcasts `hazard` message. Receiving cars relay to peers beyond the originator’s range (multi-hop). Downstream cars preemptively slow, absorbing the shockwave before it forms. *This is the feature you originally pitched.*
- **v4:** Mixed participation. Some cars have radios, some don’t. The system has to fall back to onboard-sensor-only behavior for non-participating cars while still benefiting cooperators.
- **v5:** Realism. Packet loss, latency, position noise. See how the protocol degrades.
