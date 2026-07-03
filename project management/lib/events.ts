import type { RealtimeEvent } from "./types";

type Listener = (event: RealtimeEvent) => void;

type EventBus = {
  listeners: Set<Listener>;
  subscribe: (listener: Listener) => () => void;
  publish: (event: RealtimeEvent) => void;
};

declare global {
  var __taskEventBus: EventBus | undefined;
}

function createEventBus(): EventBus {
  const listeners = new Set<Listener>();

  return {
    listeners,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(event) {
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

export function getTaskEventBus(): EventBus {
  if (!globalThis.__taskEventBus) {
    globalThis.__taskEventBus = createEventBus();
  }

  return globalThis.__taskEventBus;
}

export function publishTaskEvent(event: RealtimeEvent): void {
  getTaskEventBus().publish(event);
}
