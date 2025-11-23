import {
    GameLogEntry,
    GameSnapshot,
    GameState,
    LoadHistoryOptions,
    RecordingOptions,
    ReplayFrame,
    ReplayOptions,
    RuntimeFlags,
    StoreUpdateMeta,
} from '../../types';
import { cloneGameState, createSnapshot, defaultRuntimeFlags } from './gameState';
import { ActionLogger, RecordingBuffer, TimelineTracker, cloneSnapshot } from './storeEnhancers';
import { sleep } from '../utils';

type StoreListener = (snapshot: GameSnapshot) => void;

interface GameStoreOptions {
    historyLimit?: number;
    logLimit?: number;
}

export class GameStore {
    private state: GameState;
    private flags: RuntimeFlags = { ...defaultRuntimeFlags };
    private listeners: Set<StoreListener> = new Set();
    private history: TimelineTracker;
    private logger: ActionLogger;
    private recorder: RecordingBuffer;
    private isApplyingHistory = false;

    constructor(initialState: GameState, options: GameStoreOptions = {}) {
        this.state = initialState;
        const historyLimit = options.historyLimit ?? 200;
        const logLimit = options.logLimit ?? 400;
        const initialSnapshot = cloneSnapshot(createSnapshot(this.state, this.flags));
        this.history = new TimelineTracker(initialSnapshot, historyLimit);
        this.logger = new ActionLogger(logLimit);
        this.recorder = new RecordingBuffer();
    }

    get snapshot(): GameSnapshot {
        return createSnapshot(this.state, this.flags);
    }

    updateState(mutator: (state: GameState) => GameState, meta?: StoreUpdateMeta) {
        const prev = cloneSnapshot(this.snapshot);
        this.state = mutator(this.state);
        const next = cloneSnapshot(this.snapshot);
        this.commitChange(prev, next, meta, 'STATE');
        this.publish();
    }

    setState(state: GameState, meta?: StoreUpdateMeta) {
        const prev = cloneSnapshot(this.snapshot);
        this.state = state;
        const next = cloneSnapshot(this.snapshot);
        this.commitChange(prev, next, meta, 'STATE');
        this.publish();
    }

    updateFlags(mutator: (flags: RuntimeFlags) => RuntimeFlags, meta?: StoreUpdateMeta) {
        const prev = cloneSnapshot(this.snapshot);
        this.flags = mutator(this.flags);
        const next = cloneSnapshot(this.snapshot);
        this.commitChange(prev, next, meta, 'FLAGS');
        this.publish();
    }

    getLogs(limit?: number): GameLogEntry[] {
        return this.logger.getEntries(limit);
    }

    getHistory(): ReplayFrame[] {
        return this.history.getFrames();
    }

    canUndo() {
        return this.history.canUndo();
    }

    canRedo() {
        return this.history.canRedo();
    }

    undo(): ReplayFrame | null {
        const frame = this.history.undo();
        if (!frame) return null;
        this.applyFrame(frame);
        return frame;
    }

    redo(): ReplayFrame | null {
        const frame = this.history.redo();
        if (!frame) return null;
        this.applyFrame(frame);
        return frame;
    }

    startRecording(options?: RecordingOptions) {
        this.recorder.start(this.snapshot, options);
    }

    stopRecording(): ReplayFrame[] {
        return this.recorder.stop();
    }

    isRecording() {
        return this.recorder.isRecording();
    }

    getRecording(): ReplayFrame[] {
        return this.recorder.getRecording();
    }

    async replay(options: ReplayOptions = {}) {
        const frames = options.frames ?? this.getHistory();
        if (frames.length === 0) return;

        const delay = options.delayMs ?? 600;
        const loop = options.loop ?? false;
        const loopCount = options.loopCount ?? 1;
        const maxIteration = loop ? Math.max(1, loopCount) : 1;

        for (let iteration = 0; iteration < maxIteration; iteration++) {
            for (let i = 0; i < frames.length; i++) {
                this.applyFrame(frames[i]);
                options.onFrame?.(frames[i], i);
                if (i < frames.length - 1) {
                    await sleep(delay);
                }
            }
        }
    }

    loadHistory(frames: ReplayFrame[], options: LoadHistoryOptions = {}) {
        if (!frames || frames.length === 0) return;
        this.history.replace(frames);
        if (options.applyState === false) {
            return;
        }
        const last = frames[frames.length - 1];
        const clone = {
            snapshot: cloneSnapshot(last.snapshot),
            meta: last.meta,
            timestamp: last.timestamp,
        };
        this.applyFrame(clone);
    }

    resetFlags(meta?: StoreUpdateMeta) {
        const effectiveMeta =
            meta ??
            {
                tag: 'store:flags.reset',
                description: 'Runtime flags reset',
                suppressHistory: true,
                suppressLog: true,
            };
        const prev = cloneSnapshot(this.snapshot);
        this.flags = { ...defaultRuntimeFlags };
        const next = cloneSnapshot(this.snapshot);
        this.commitChange(prev, next, effectiveMeta, 'FLAGS');
        this.publish();
    }

    subscribe(listener: StoreListener) {
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    private applyFrame(frame: ReplayFrame) {
        this.isApplyingHistory = true;
        this.state = cloneGameState(frame.snapshot.state);
        this.flags = { ...frame.snapshot.flags };
        this.publish();
        this.isApplyingHistory = false;
    }

    private commitChange(
        prev: GameSnapshot,
        next: GameSnapshot,
        meta: StoreUpdateMeta | undefined,
        type: 'STATE' | 'FLAGS'
    ) {
        if (!this.isApplyingHistory && !meta?.suppressHistory) {
            this.history.push(next, meta);
        }
        if (!meta?.suppressLog) {
            this.logger.append(next, meta, type);
        }
        if (this.recorder.isRecording()) {
            this.recorder.capture(next, meta);
        }
    }

    private publish() {
        const snapshot = this.snapshot;
        this.listeners.forEach(listener => listener(snapshot));
    }
}

