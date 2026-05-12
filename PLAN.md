# HiveDrive — v0 Scaffold Plan

## Project description

HiveDrive is a browser-based cooperative driving simulator. Cars share state with nearby cars over a simulated V2V mesh, propagating awareness of slowdowns, obstructions, and merge intent through a chain of vehicles. The goal is to prototype coordination algorithms (gap creation for merges, info propagation, cooperative speed adjustment) in a controlled environment before any hardware work.

This document specifies the **v0 scaffold only**. It does *not* specify the coordination algorithm — that is the interesting work that will happen on top of this foundation, and it should not be implemented yet.

## Goals for v0

- Running Next.js app with a single page that renders a Canvas 2D top-down view of a highway with on-ramp and exit ramp
- N cars (configurable, default 8) cruising at constant speeds, lane-keeping only, no coordination
- A V2V message bus stub: cars can publish messages and subscribe to messages from cars within a configurable radio range, but no messages are actually sent yet
- Debug overlay showing each car’s state (id, position, velocity, lane, radio peers in range)
- Pause / play / step controls and a speed slider (0.25x – 4x sim speed)
- Spawn controls: button to inject a new car onto the on-ramp, button to mark a random car as “wants to exit”

## Explicit non-goals for v0

Do **not** implement any of the following — they are intentionally deferred:

- Merge negotiation logic. New on-ramp cars just appear; existing cars do not yet react.
- Exit logic. The “wants to exit” flag is a marker only.
- Actual V2V message passing. The bus interface exists, but no car publishes or consumes messages yet.
- Supabase, Supabase Realtime, or any networking. Everything runs in a single browser tab.
- Any ML, RL, or learned policy.
- Persistence, auth, or multi-user.
- Mobile responsiveness beyond “it doesn’t crash on a phone.” Desktop-first.
- Sound, particles, fancy car sprites. Use colored rectangles.

## Stack

- **Framework:** Next.js 15, App Router, TypeScript, strict mode
- **Styling:** Tailwind CSS
- **State:** Zustand for UI-facing state only (controls, debug panel data). Simulation state lives in a plain TypeScript class held in a `useRef`, not in Zustand. Push to Zustand at 10Hz max for debug panel updates.
- **Rendering:** Canvas 2D, top-down view. `requestAnimationFrame` loop.
- **Simulation:** Fixed timestep (60Hz internal), decoupled from render frame rate. Accumulator pattern.
- **No 3D, no Three.js, no Supabase, no backend.**

## Architecture

### Directory structure

```
hivedrive/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Single page, renders <Simulator />
│   └── globals.css
├── components/
│   ├── Simulator.tsx             # Canvas + controls wrapper, owns the sim ref + RAF loop
│   ├── Controls.tsx              # Play/pause/step/speed/spawn buttons
│   └── DebugPanel.tsx            # Per-car state table, reads from Zustand
├── lib/
│   ├── sim/
│   │   ├── world.ts              # World class: owns cars, road, message bus; .tick(dt) method
│   │   ├── car.ts                # Car class: state + .update(dt, world) — pure motion only for v0
│   │   ├── road.ts               # Road geometry: lanes, on-ramp curve, exit-ramp curve
│   │   ├── messageBus.ts         # In-memory pub/sub with radio-range filtering (stub, unused in v0)
│   │   └── types.ts              # Shared types: CarState, Lane, V2VMessage, etc.
│   ├── render/
│   │   ├── renderer.ts           # Main draw function: takes World + ctx, draws everything
│   │   ├── drawRoad.ts
│   │   ├── drawCar.ts
│   │   └── drawDebug.ts          # Optional overlays (radio range circles, lane centers)
│   └── store/
│       └── uiStore.ts            # Zustand: sim controls, selected car id, debug panel data
├── PLAN.md                       # This file
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

### Simulation model

- **Coordinate system:** World units are meters. Origin at top-left of road section. X increases left-to-right (direction of travel). Y increases top-to-bottom across lanes.
- **Road:** A horizontal highway section ~500m long, 3 lanes. An on-ramp curves in from the bottom and merges into the rightmost lane around x=150m. An exit ramp peels off the rightmost lane around x=350m, curving down and off-screen.
- **Lane geometry:** Each lane has a centerline function `laneCenter(x): y`. For straight highway lanes this is constant. For the ramp transitions, use a smoothstep or cubic Bezier so cars don’t kink.
- **Car state:** `{ id, x, y, vx, vy, lane: 0|1|2|'onramp'|'offramp', targetSpeed, intent: 'cruise'|'merging'|'exiting', radioRange: number }`
- **Car update (v0):** Cars stay in their current lane, follow that lane’s centerline, hold their target speed. No collision avoidance, no following distance logic. If they reach the end of the road section, they wrap around to the start (toroidal world) — keeps the sim running indefinitely without spawning logic.
- **Tick rate:** 60Hz internal sim updates regardless of render fps. Use an accumulator so a 30fps render still steps the sim correctly.

### Message bus (stub)

Define the interface and the radio-range filtering, but nothing publishes or consumes yet:

```ts
interface V2VMessage {
  fromCarId: string;
  timestamp: number;
  type: 'state' | 'intent' | 'hazard';  // payload shape TBD in v1
  payload: unknown;
}

class MessageBus {
  publish(msg: V2VMessage, fromCar: Car): void;
  subscribe(car: Car, handler: (msg: V2VMessage) => void): () => void;
  // Internal: only delivers msgs from cars within fromCar.radioRange of subscribing car
}
```

Cars get a `radioRange` field (default 80m) and the bus filters delivery by Euclidean distance. Leave a `// TODO: v1 — wire up publishers/consumers` comment.

## Acceptance criteria

The scaffold is done when **all** of the following are true:

1. `npm install && npm run dev` starts the app cleanly on first try with zero TypeScript errors and zero console errors.
1. Opening `localhost:3000` shows a Canvas filling most of the viewport, with a control bar and debug panel.
1. The canvas shows a 3-lane highway running left-to-right, with a visible on-ramp curving in from below-left and an exit ramp curving off below-right.
1. 8 cars are visible at start, distributed across the 3 highway lanes, moving left-to-right at slightly different speeds (e.g., 25–32 m/s), wrapping at the right edge back to the left.
1. Cars are drawn as colored rectangles with their id rendered on top.
1. Play / pause toggles the sim. Step advances exactly one 60Hz tick when paused. Speed slider scales sim speed without affecting render fps.
1. “Spawn on-ramp car” button adds a new car at the start of the on-ramp; it follows the ramp curve onto the rightmost lane and continues (no merge logic — it just appears in the lane, even if it overlaps another car. This is expected for v0.)
1. “Mark random exit” button picks a random car in the rightmost lane and sets its intent to `'exiting'` — visualized by changing its color. (No actual exit behavior yet.)
1. Debug panel lists all cars with id, position (rounded), velocity, lane, intent, and current radio-peer count.
1. Clicking a car selects it; selected car shows its radio range as a translucent circle.
1. README.md at the root explains how to run it and points to PLAN.md for context.

## Out of scope reminders (please read before generating code)

If you find yourself reaching for any of these, stop and leave a `// TODO: v1` comment instead:

- Following-distance / ACC logic
- Any car reacting to another car’s presence
- Any message actually flowing through the bus
- Lane-change animations beyond the on-ramp curve
- Collision detection
- Any AI / ML / heuristics for car behavior beyond “follow lane centerline at target speed”

The whole point is to land a clean, boring foundation so the interesting coordination work has somewhere to live.

## After scaffold lands

Next steps (do **not** start these yet):

- v1: Implement basic following-distance behavior + actual state broadcasts on the message bus
- v2: Implement merge protocol — on-ramp car broadcasts merge intent, mainline cars in the rightmost lane create a gap
- v3: Info propagation chain — a lead car broadcasting a hazard reaches cars further back via relay
- v4: Mixed participation — some cars are “dumb” (no radio), system has to degrade gracefully
