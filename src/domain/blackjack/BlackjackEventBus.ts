import { HandScore, RoundOutcome } from './BlackjackRules';
import { Participant } from './Participant';

export type BlackjackEventMap = {
  bust: {
    actor: Participant;
    score: HandScore;
  };
  roundEnd: {
    outcome: RoundOutcome;
    player: HandScore;
    enemy: HandScore;
  };
};

type EventKey = keyof BlackjackEventMap;

type Handler<K extends EventKey> = (payload: BlackjackEventMap[K]) => void;

export class BlackjackEventBus {
  private readonly listeners = new Map<EventKey, Set<Handler<EventKey>>>();

  on<K extends EventKey>(type: K, handler: Handler<K>): () => void {
    const existing = this.listeners.get(type) ?? new Set();
    existing.add(handler as Handler<EventKey>);
    this.listeners.set(type, existing);
    return () => {
      existing.delete(handler as Handler<EventKey>);
    };
  }

  emit<K extends EventKey>(type: K, payload: BlackjackEventMap[K]): void {
    const targets = this.listeners.get(type);
    if (!targets) return;
    for (const handler of targets) {
      handler(payload);
    }
  }
}
