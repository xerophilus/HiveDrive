import { Car, makeCarId, resetIdCounter } from "./car";
import { MessageBus } from "./messageBus";
import type { CarState } from "./types";
import { ONRAMP_START_X, ONRAMP_START_Y } from "./road";

const DEFAULT_CAR_COUNT = 8;
const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;

export class World {
  cars: Car[] = [];
  bus: MessageBus = new MessageBus();
  private unsubscribers: Map<string, () => void> = new Map();

  constructor(carCount = DEFAULT_CAR_COUNT) {
    resetIdCounter();
    this.initCars(carCount);
  }

  private initCars(count: number): void {
    const lanes: Array<0 | 1 | 2> = [0, 1, 2, 0, 1, 2, 0, 1];
    const speeds = [32, 28, 25, 31, 27, 26, 30, 29];
    // Distribute evenly along road (avoid first 100m where ramp merges)
    for (let i = 0; i < count; i++) {
      const lane = lanes[i % lanes.length];
      const x = 100 + (i / count) * 350;
      const car = new Car({
        lane,
        x,
        targetSpeed: speeds[i % speeds.length],
      });
      this.addCar(car);
    }
  }

  private addCar(car: Car): void {
    this.cars.push(car);
    const unsub = this.bus.subscribe(
      car.id,
      () => ({ x: car.x, y: car.y }),
      () => car.radioRange,
      () => {
        // TODO: v1 — handle incoming V2V messages here
      },
    );
    this.unsubscribers.set(car.id, unsub);
  }

  spawnOnRamp(): Car {
    const car = new Car({
      id: makeCarId(),
      lane: "onramp",
      x: ONRAMP_START_X,
      y: ONRAMP_START_Y,
      targetSpeed: 25 + Math.random() * 7,
    });
    this.addCar(car);
    return car;
  }

  markRandomExit(): Car | null {
    const candidates = this.cars.filter(
      (c) => c.lane === 2 && c.intent === "cruise",
    );
    if (candidates.length === 0) return null;
    const car = candidates[Math.floor(Math.random() * candidates.length)];
    car.intent = "exiting";
    // TODO: v1 — trigger exit maneuver; for v0 this is a marker only
    return car;
  }

  tick(): void {
    for (const car of this.cars) {
      car.update(TICK_DT);
    }
    // Update radio peers for debug panel
    for (const car of this.cars) {
      car.radioPeers = this.bus.peersInRange(car.id, { x: car.x, y: car.y }, car.radioRange);
    }
  }

  snapshot(): CarState[] {
    return this.cars.map((c) => c.state());
  }
}
