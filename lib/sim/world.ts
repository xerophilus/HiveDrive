import { Car, makeCarId, resetIdCounter } from "./car";
import { MessageBus } from "./messageBus";
import type { CarState, StateMessagePayload } from "./types";
import { ONRAMP_START_X, ONRAMP_START_Y } from "./road";

const DEFAULT_CAR_COUNT = 8;
const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
const V2V_PUBLISH_EVERY = 6; // ticks — gives 10 Hz at 60 Hz sim rate

export interface WorldStats {
  msgsSentPerSec: number;
  msgsReceivedPerSec: number;
  carCount: number;
}

export class World {
  cars: Car[] = [];
  bus: MessageBus = new MessageBus();
  private unsubscribers: Map<string, () => void> = new Map();

  // Sim time tracking
  private simTime = 0;
  private tickCount = 0;

  // Message rate accounting
  private msgsSentAccum = 0;
  private msgsReceivedAccum = 0;
  private lastRateSampleTime = 0;
  msgsSentPerSec = 0;
  msgsReceivedPerSec = 0;

  constructor(carCount = DEFAULT_CAR_COUNT) {
    resetIdCounter();
    this.initCars(carCount);
  }

  private initCars(count: number): void {
    const lanes: Array<0 | 1 | 2> = [0, 1, 2, 0, 1, 2, 0, 1];
    const speeds = [32, 28, 25, 31, 27, 26, 30, 29];
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
      (msg) => {
        if (msg.type === "state") {
          car.receiveV2VMessage(msg.payload as StateMessagePayload, this.simTime);
        }
        this.msgsReceivedAccum++;
      },
    );
    this.unsubscribers.set(car.id, unsub);
  }

  private removeCar(car: Car): void {
    this.cars = this.cars.filter((c) => c.id !== car.id);
    const unsub = this.unsubscribers.get(car.id);
    if (unsub) {
      unsub();
      this.unsubscribers.delete(car.id);
    }
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

  /**
   * Marks a random lane-2 cruising car as exiting.
   * Returns the car, or null if no eligible car exists.
   * v1: only lane-2 cars can exit; lane changes to reach lane 2 are TODO: v2 — lane change
   */
  markRandomExit(): Car | null {
    const candidates = this.cars.filter(
      (c) => c.lane === 2 && c.intent === "cruise",
    );
    if (candidates.length === 0) return null;
    const car = candidates[Math.floor(Math.random() * candidates.length)];
    car.intent = "exiting";
    return car;
  }

  tick(): void {
    this.simTime += TICK_DT;
    this.tickCount++;

    // --- ACC: compute and apply acceleration for every car ---
    for (const car of this.cars) {
      const accel = car.acc(this.cars);
      car.update(TICK_DT, accel);
    }

    // --- Remove cars that finished the exit ramp ---
    const departing = this.cars.filter((c) => c.shouldRemove);
    for (const car of departing) {
      this.removeCar(car);
    }

    // --- V2V: publish state from every car at 10 Hz ---
    if (this.tickCount % V2V_PUBLISH_EVERY === 0) {
      for (const car of this.cars) {
        car.publishState(this.bus, this.simTime);
        this.msgsSentAccum++;
        // msgsReceivedAccum is counted inside the subscriber handler in addCar()
      }
    }

    // --- Stale V2V peer cleanup ---
    for (const car of this.cars) {
      car.cleanupStaleKnownPeers(this.simTime);
    }

    // --- Update radio peers for debug panel (ground-truth range) ---
    for (const car of this.cars) {
      car.radioPeers = this.bus.peersInRange(car.id, { x: car.x, y: car.y }, car.radioRange);
    }

    // --- Message rate sampling (~1 Hz) ---
    const elapsed = this.simTime - this.lastRateSampleTime;
    if (elapsed >= 1.0) {
      this.msgsSentPerSec = Math.round(this.msgsSentAccum / elapsed);
      // msgsReceived is counted by the handler — don't double-count from publish return values
      this.msgsReceivedPerSec = Math.round(this.msgsReceivedAccum / elapsed);
      this.msgsSentAccum = 0;
      this.msgsReceivedAccum = 0;
      this.lastRateSampleTime = this.simTime;
    }
  }

  stats(): WorldStats {
    return {
      msgsSentPerSec: this.msgsSentPerSec,
      msgsReceivedPerSec: this.msgsReceivedPerSec,
      carCount: this.cars.length,
    };
  }

  snapshot(): CarState[] {
    return this.cars.map((c) => c.state());
  }
}
