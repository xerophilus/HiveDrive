# HiveDrive

Browser-based cooperative driving simulator — v0 scaffold.

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
| Mark random exit | Flag a random lane-2 car as "exiting" (orange) |
| Click a car | Select it — shows radio range circle |

## Architecture & context

See [PLAN.md](./PLAN.md) for the full v0 spec, coordinate system, simulation model, and the list of things intentionally **not** implemented yet (coordination, message passing, exit/merge logic).
