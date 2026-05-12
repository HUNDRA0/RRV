import { EventEmitter } from 'node:events';

// Per-game emitter that wakes long-poll holders the instant state changes.
// Each saveGame() call emits 'update' on the matching emitter; GET /catan/:id
// subscribes to it during its hold window and resolves on the first event.
// Works as long as both clients hit the same server instance (single-instance
// Express on Vercel covers the friends-only use case). The 7s timeout fallback
// still applies if events are missed across instances.
const emitters = new Map<string, EventEmitter>();

function getEmitter(gameId: string): EventEmitter {
  let e = emitters.get(gameId);
  if (!e) {
    e = new EventEmitter();
    e.setMaxListeners(50);
    emitters.set(gameId, e);
  }
  return e;
}

export function emitGameUpdate(gameId: string): void {
  getEmitter(gameId).emit('update');
}

export function subscribeGameUpdate(gameId: string, listener: () => void): () => void {
  const e = getEmitter(gameId);
  e.once('update', listener);
  return () => { e.off('update', listener); };
}
