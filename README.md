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
| Mark random exit | Flag a random lane-2 car as "exiting" — it curves off the exit ramp and disappears |
| Click a car | Select it — shows radio range circle and V2V peer lines |

## What's working in v1

- **ACC (Adaptive Cruise Control):** each car detects the nearest car ahead in its lane (within 60 m, ground-truth only) and applies a simple proportional speed controller — decel cap 4 m/s², accel cap 2 m/s². Cars form natural platoons; no car drives through another.
- **V2V message bus wired:** every car broadcasts a `state` message at 10 Hz containing position, velocity, lane, and intent. Every car maintains a `knownPeers` map of cars heard within its 80 m radio range, expiring stale entries after 2 s. V2V data is **not yet used for decisions** (that's v2).
- **Peer visualisation:** selecting a car draws translucent lines to all cars it has heard from via V2V. The debug panel shows `tx / rx msg/s` live.
- **Exit logic:** marking a lane-2 car "exiting" causes it to follow the exit-ramp curve when it reaches the branch point, then be removed from the world. Total car count drops; spawning an on-ramp car increases it back.
- **"Mark random exit" button** only picks from lane-2 cars and shows a brief toast if none are available.

## Architecture & context

See [PLAN.md](./PLAN.md) for the full v0 spec and [V1_PLAN](./V1_PLAN) for v1 goals. Coordinate system, simulation model, and the roadmap for v2 (merge protocol, discretionary lane changes) are documented there.
