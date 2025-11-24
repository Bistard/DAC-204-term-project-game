import {
    GameLogEntry,
    GameSnapshot,
    RecordingOptions,
    ReplayFrame,
    StoreUpdateMeta,
} from '../../common/types';
import { cloneGameState } from './gameState';

const createId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

export const cloneSnapshot = (snapshot: GameSnapshot): GameSnapshot => ({
    state: cloneGameState(snapshot.state),
    flags: { ...snapshot.flags },
});

export class TimelineTracker {
    private frames: ReplayFrame[] = [];
    private pointer = -1;

    constructor(initialSnapshot: GameSnapshot, private limit: number) {
        this.push(initialSnapshot, { tag: 'store:init', description: 'Initial state', suppressLog: true });
    }

    push(snapshot: GameSnapshot, meta?: StoreUpdateMeta, timestamp: number = Date.now()) {
        const frame: ReplayFrame = {
            snapshot: cloneSnapshot(snapshot),
            meta,
            timestamp,
        };
        if (this.pointer < this.frames.length - 1) {
            this.frames.splice(this.pointer + 1);
        }
        this.frames.push(frame);
        if (this.frames.length > this.limit) {
            const overflow = this.frames.length - this.limit;
            this.frames.splice(0, overflow);
            this.pointer = Math.max(0, this.pointer - overflow);
        }
        this.pointer = this.frames.length - 1;
    }

    canUndo() {
        return this.pointer > 0;
    }

    canRedo() {
        return this.pointer < this.frames.length - 1;
    }

    undo(): ReplayFrame | null {
        if (!this.canUndo()) return null;
        this.pointer -= 1;
        return this.frames[this.pointer];
    }

    redo(): ReplayFrame | null {
        if (!this.canRedo()) return null;
        this.pointer += 1;
        return this.frames[this.pointer];
    }

    current(): ReplayFrame | null {
        if (this.pointer < 0 || this.pointer >= this.frames.length) return null;
        return this.frames[this.pointer];
    }

    getFrames(): ReplayFrame[] {
        return this.frames.slice(0, this.pointer + 1).map(frame => ({
            snapshot: cloneSnapshot(frame.snapshot),
            meta: frame.meta,
            timestamp: frame.timestamp,
        }));
    }

    replace(frames: ReplayFrame[]) {
        if (frames.length === 0) {
            this.frames = [];
            this.pointer = -1;
            return;
        }
        this.frames = frames.map(frame => ({
            snapshot: cloneSnapshot(frame.snapshot),
            meta: frame.meta,
            timestamp: frame.timestamp,
        }));
        this.pointer = this.frames.length - 1;
    }
}

export class ActionLogger {
    private entries: GameLogEntry[] = [];

    constructor(private limit: number) {}

    append(snapshot: GameSnapshot, meta: StoreUpdateMeta | undefined, type: 'STATE' | 'FLAGS', timestamp = Date.now()) {
        const entry: GameLogEntry = {
            id: createId(),
            timestamp,
            tag: meta?.tag ?? `store:${type.toLowerCase()}`,
            description: meta?.description ?? (type === 'STATE' ? 'State updated' : 'Flag updated'),
            round: snapshot.state.roundCount,
            phase: snapshot.state.phase,
            turnOwner: snapshot.state.turnOwner,
            payload: meta?.payload,
        };
        this.entries.push(entry);
        if (this.entries.length > this.limit) {
            this.entries.shift();
        }
    }

    getEntries(limit?: number): GameLogEntry[] {
        const source = limit ? this.entries.slice(-limit) : this.entries;
        return source.map(entry => ({
            ...entry,
            payload: entry.payload ? { ...entry.payload } : undefined,
        }));
    }
}

interface RecordingSession {
    options: RecordingOptions;
    frames: ReplayFrame[];
}

export class RecordingBuffer {
    private session: RecordingSession | null = null;
    private lastRecording: ReplayFrame[] = [];

    start(snapshot: GameSnapshot, options: RecordingOptions = {}) {
        this.session = {
            options,
            frames: options.includeCurrent === false
                ? []
                : [
                      {
                          snapshot: cloneSnapshot(snapshot),
                          meta: {
                              tag: 'recording:start',
                              description: options.label
                                  ? `Recording started: ${options.label}`
                                  : 'Recording started',
                          },
                          timestamp: Date.now(),
                      },
                  ],
        };
    }

    capture(snapshot: GameSnapshot, meta?: StoreUpdateMeta, timestamp = Date.now()) {
        if (!this.session) return;
        this.session.frames.push({
            snapshot: cloneSnapshot(snapshot),
            meta,
            timestamp,
        });
    }

    stop(): ReplayFrame[] {
        if (!this.session) return [];
        this.lastRecording = this.session.frames.map(frame => ({
            snapshot: cloneSnapshot(frame.snapshot),
            meta: frame.meta,
            timestamp: frame.timestamp,
        }));
        this.session = null;
        return this.getRecording();
    }

    isRecording() {
        return !!this.session;
    }

    getRecording(): ReplayFrame[] {
        return this.lastRecording.map(frame => ({
            snapshot: cloneSnapshot(frame.snapshot),
            meta: frame.meta,
            timestamp: frame.timestamp,
        }));
    }
}
