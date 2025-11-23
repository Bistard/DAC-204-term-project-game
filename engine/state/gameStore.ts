import { GameSnapshot, GameState, RuntimeFlags } from '../../types';
import { createSnapshot, defaultRuntimeFlags } from './gameState';

type StoreListener = (snapshot: GameSnapshot) => void;

export class GameStore {
    private state: GameState;
    private flags: RuntimeFlags = { ...defaultRuntimeFlags };
    private listeners: Set<StoreListener> = new Set();

    constructor(initialState: GameState) {
        this.state = initialState;
    }

    get snapshot(): GameSnapshot {
        return createSnapshot(this.state, this.flags);
    }

    updateState(mutator: (state: GameState) => GameState) {
        this.state = mutator(this.state);
        this.publish();
    }

    setState(state: GameState) {
        this.state = state;
        this.publish();
    }

    updateFlags(mutator: (flags: RuntimeFlags) => RuntimeFlags) {
        this.flags = mutator(this.flags);
        this.publish();
    }

    private publish() {
        const snapshot = this.snapshot;
        this.listeners.forEach(listener => listener(snapshot));
    }

    subscribe(listener: StoreListener) {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }
}

