import { GameEvent, GameEventListener } from '../types';

export class EventBus {
    private listeners: Set<GameEventListener> = new Set();

    emit(event: GameEvent) {
        this.listeners.forEach(listener => listener(event));
    }

    subscribe(listener: GameEventListener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    clear() {
        this.listeners.clear();
    }
}

