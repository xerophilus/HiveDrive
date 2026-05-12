import { Car, makeCarId, resetIdCounter } from "./car";
import { MessageBus } from "./messageBus";
import type { CarState } from "./types";
import {
  laneCenter,
  ONRAMP_START_X,
  ONRAMP_START_Y,
  OFFRAMP_START_X,
} from "./road";
import {
  EXIT_PLAN_DISTANCE,
  LANE_CHANGE_DURATION,
} from "./tuning";
import { planLaneChange } from "./decisions/planLaneChange";

const DEFAULT_CAR_COUNT = 8;
const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
const V2V_PUBLISH_EVERY = 6; // ticks — gives 10 Hz at 60 Hz sim rate

export interface WorldStats {
  msgsSentPerSec: number;
  msgsReceivedPerSec: number;
  carCount: number;
  activeMerges: number;
  activeLaneChanges: number;
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
        car.receiveV2VMessage(msg, this.simTime, this.bus);
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
   * v2: any cruising highway car can be marked for exit, not just lane-2 cars.
   * Cars not in lane 2 will navigate there via cooperative lane changes.
   */
  markRandomExit(): Car | null {
    const candidates = this.cars.filter(
      (c) => typeof c.lane === "number" && c.intent === "cruise",
    );
    if (candidates.length === 0) return null;
    const car = candidates[Math.floor(Math.random() * candidates.length)];
    car.intent = "exiting";
    return car;
  }

  tick(): void {
    this.simTime += TICK_DT;
    this.tickCount++;

    // --- ACC: compute acceleration for every car ---
    const accels = this.cars.map((car) => car.acc(this.cars));

    // --- Update positions ---
    for (let i = 0; i < this.cars.length; i++) {
      this.cars[i].update(TICK_DT, accels[i], this.simTime);
    }

    // --- v2: plan lane changes for exiting cars not yet in lane 2 ---
    for (const car of this.cars) {
      if (
        car.intent === "exiting" &&
        typeof car.lane === "number" &&
        car.lane < 2 &&
        car.laneChangeTarget === null
      ) {
        const distToExit = OFFRAMP_START_X - car.x;

        if (distToExit > 0 && distToExit <= EXIT_PLAN_DISTANCE) {
          const targetLane = (car.lane + 1) as 0 | 1 | 2;
          if (planLaneChange(car, targetLane, this.cars)) {
            car.startLaneChange(
              targetLane,
              car.y,
              laneCenter(targetLane),
              LANE_CHANGE_DURATION,
            );
          }
          // else: no safe gap yet — defer to next tick
        } else if (distToExit <= 0) {
          // Missed the exit without reaching lane 2
          console.warn(
            `Car ${car.id}: reached exit at lane ${car.lane} without getting to lane 2, reverting to cruise`,
          );
          car.intent = "cruise";
        }
      }
    }

    // --- Remove cars that finished the exit ramp ---
    const departing = this.cars.filter((c) => c.shouldRemove);
    for (const car of departing) {
      this.removeCar(car);
    }

    // --- V2V: publish state + merge-intent at 10 Hz ---
    if (this.tickCount % V2V_PUBLISH_EVERY === 0) {
      for (const car of this.cars) {
        car.publishState(this.bus, this.simTime);
        this.msgsSentAccum++;
      }
      // Merge-intent from on-ramp cars in the merge zone
      for (const car of this.cars) {
        if (car.lane === "onramp" && car.intent === "merging") {
          car.publishMergeIntent(this.bus, this.simTime);
          this.msgsSentAccum++;
        }
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
      this.msgsReceivedPerSec = Math.round(this.msgsReceivedAccum / elapsed);
      this.msgsSentAccum = 0;
      this.msgsReceivedAccum = 0;
      this.lastRateSampleTime = this.simTime;
    }
  }

  stats(): WorldStats {
    const activeMerges = this.cars.filter(
      (c) => c.lane === "onramp" && c.intent === "merging",
    ).length;
    const activeLaneChanges = this.cars.filter(
      (c) => c.laneChangeTarget !== null,
    ).length;
    return {
      msgsSentPerSec: this.msgsSentPerSec,
      msgsReceivedPerSec: this.msgsReceivedPerSec,
      carCount: this.cars.length,
      activeMerges,
      activeLaneChanges,
    };
  }

  snapshot(): CarState[] {
    return this.cars.map((c) => c.state());
  }
}
