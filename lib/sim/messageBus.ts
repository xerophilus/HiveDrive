import type { V2VMessage } from "./types";

type Handler = (msg: V2VMessage) => void;

interface Subscriber {
  carId: string;
  getPos: () => { x: number; y: number };
  radioRange: () => number;
  handler: Handler;
}

export class MessageBus {
  private subscribers: Map<string, Subscriber> = new Map();

  subscribe(
    carId: string,
    getPos: () => { x: number; y: number },
    radioRange: () => number,
    handler: Handler,
  ): () => void {
    this.subscribers.set(carId, { carId, getPos, radioRange, handler });
    return () => this.subscribers.delete(carId);
  }

  publish(msg: V2VMessage, fromPos: { x: number; y: number }): void {
    // TODO: v1 — wire up publishers/consumers; currently no car sends messages
    for (const sub of Array.from(this.subscribers.values())) {
      if (sub.carId === msg.fromCarId) continue;
      const pos = sub.getPos();
      const dx = pos.x - fromPos.x;
      const dy = pos.y - fromPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= sub.radioRange()) {
        sub.handler(msg);
      }
    }
  }

  /** Returns ids of cars within `range` meters of `pos` among subscribers */
  peersInRange(excludeId: string, pos: { x: number; y: number }, range: number): string[] {
    const peers: string[] = [];
    for (const sub of Array.from(this.subscribers.values())) {
      if (sub.carId === excludeId) continue;
      const p = sub.getPos();
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= range) {
        peers.push(sub.carId);
      }
    }
    return peers;
  }
}
