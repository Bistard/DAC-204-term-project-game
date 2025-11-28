import { GameEvent, HandAction, TurnOwner } from '../../common/types';
import { EventBus } from '../eventBus';
import dealCardClip from '../../assets/sfx/deal-card.wav';
import damageHurtClip from '../../assets/sfx/hurt.wav';
import battleWinClip from '../../assets/sfx/win.wav';
import crowdedSaloonClip from '../../assets/sfx/crowded-saloon.wav';
import flipCardClip from '../../assets/sfx/flip-card.wav';
import clashRoundClip from '../../assets/sfx/round-clash.wav';

export type SfxActionId =
    | 'battle.victory'
    | 'round.start'
    | 'round.end'
    | 'card.draw.player'
    | 'card.draw.enemy'
    | 'card.reveal.player'
    | 'card.reveal.enemy'
    | 'hand.hit.player'
    | 'hand.hit.enemy'
    | 'hand.stand.player'
    | 'hand.stand.enemy'
    | 'hand.useItem.player'
    | 'hand.useItem.enemy'
    | 'hand.hurt.player'
    | 'hand.hurt.enemy'
    | 'damage.player'
    | 'damage.enemy'
    | 'heal.player'
    | 'heal.enemy'
    | 'gold.spend'
    | 'gold.gain'
    | 'round.clash'
    | 'round.win'
    | 'round.lose'
    | 'round.draw'
    | 'env.card.enter'
    | 'env.card.exit'
    | 'penalty.card.drawn'
    | 'penalty.card.applied'
    | 'ui.click'
    | 'ui.error';

export interface SfxPlayContext {
    event: GameEvent;
    actionId: SfxActionId;
}

export type SfxPlayFn = (ctx: SfxPlayContext) => void | Promise<void>;

export interface AudioFilePlaybackRateRange {
    min?: number;
    max?: number;
}

export interface AudioPlaybackOptions {
    volume?: number;
    playbackRate?: number;
    loop?: boolean;
}

interface AudioPlaybackHandle {
    stop(): void;
    finished: Promise<void>;
}

export interface AudioFileConfig {
    type: 'audio-file';
    src: string;
    volume?: number;
    playbackRate?: number | AudioFilePlaybackRateRange;
    loop?: boolean;
    preload?: boolean;
    stopActions?: readonly SfxActionId[];
}

export type SfxConfig = AudioFileConfig | SfxPlayFn;

export type SfxRegistry = Map<SfxActionId, SfxConfig>;

interface SfxAudioAdapter {
    preload(src: string): Promise<void> | void;
    play(src: string, options?: AudioPlaybackOptions): Promise<AudioPlaybackHandle | void> | AudioPlaybackHandle | void;
    stopAll(): void;
    dispose?: () => void | Promise<void>;
}

interface SfxServiceDeps {
    bus: EventBus;
    audio?: SfxAudioAdapter;
    isEnabled?: () => boolean;
    log?: (msg: string, extra?: unknown) => void;
}

type Owner = 'player' | 'enemy';

const SYNTHETIC_EVENT_EFFECT_PREFIX = 'sfx:';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createDefaultAudioAdapter = (log: (msg: string, extra?: unknown) => void): SfxAudioAdapter => {
    let masterVolume = 1;
    let audioContext: AudioContext | null = null;
    let resumePromise: Promise<void> | null = null;
    const bufferCache = new Map<string, Promise<AudioBuffer | null>>();
    const activeSources = new Map<AudioBufferSourceNode, GainNode>();
    const activeHandles = new Set<AudioPlaybackHandle>();

    const ensureAudioContext = (): AudioContext | null => {
        if (typeof window === 'undefined') return null;
        if (!audioContext) {
            const ctor =
                window.AudioContext ??
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!ctor) {
                log('[SfxService] Web Audio API is unavailable');
                return null;
            }
            audioContext = new ctor();
        }
        if (audioContext.state === 'suspended' && !resumePromise) {
            resumePromise = audioContext
                .resume()
                .catch(error => {
                    log('[SfxService] Failed to resume AudioContext', error);
                })
                .finally(() => {
                    resumePromise = null;
                });
        }
        return audioContext;
    };

    const decodeBuffer = (ctx: AudioContext, arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> => {
        if (typeof ctx.decodeAudioData === 'function') {
            return new Promise(resolve => {
                ctx.decodeAudioData(
                    arrayBuffer,
                    buffer => resolve(buffer),
                    error => {
                        log('[SfxService] Failed to decode audio buffer', error);
                        resolve(null);
                    }
                );
            });
        }
        return Promise.resolve(null);
    };

    const fetchBuffer = (src: string): Promise<AudioBuffer | null> => {
        let pending = bufferCache.get(src);
        if (pending) return pending;
        const ctx = ensureAudioContext();
        if (!ctx) {
            pending = Promise.resolve(null);
            bufferCache.set(src, pending);
            return pending;
        }
        pending = fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch audio clip: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => decodeBuffer(ctx, arrayBuffer))
            .catch(error => {
                bufferCache.delete(src);
                log('[SfxService] Failed to load audio source', { src, error });
                return null;
            });
        bufferCache.set(src, pending);
        return pending;
    };

    const cleanupSource = (source: AudioBufferSourceNode) => {
        const gain = activeSources.get(source);
        if (gain) {
            try {
                gain.disconnect();
            } catch (error) {
                log('[SfxService] Failed to disconnect gain node', error);
            }
        }
        activeSources.delete(source);
        source.onended = null;
        try {
            source.disconnect();
        } catch (error) {
            log('[SfxService] Failed to disconnect source node', error);
        }
    };

    const registerHandle = (handle: AudioPlaybackHandle) => {
        activeHandles.add(handle);
        handle.finished.finally(() => activeHandles.delete(handle));
    };

    const stopAll = () => {
        Array.from(activeHandles.values()).forEach(handle => handle.stop());
    };

    return {
        async preload(src: string) {
            if (!src) return;
            await fetchBuffer(src);
        },
        async play(src: string, options?: AudioPlaybackOptions) {
            if (!src) return;
            const ctx = ensureAudioContext();
            if (!ctx) return;
            const buffer = await fetchBuffer(src);
            if (!buffer) return;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            if (typeof options?.playbackRate === 'number' && Number.isFinite(options.playbackRate)) {
                source.playbackRate.value = clamp(options.playbackRate, 0.25, 4);
            }
            if (options?.loop) {
                source.loop = true;
            }
            const gain = ctx.createGain();
            const volume = typeof options?.volume === 'number' ? options.volume : 1;
            gain.gain.value = clamp(volume * masterVolume, 0, 1);
            source.connect(gain).connect(ctx.destination);
            activeSources.set(source, gain);
            let finish!: () => void;
            let ended = false;
            const finished = new Promise<void>(resolve => {
                finish = resolve;
            });
            const finalize = () => {
                if (ended) return;
                ended = true;
                cleanupSource(source);
                finish();
            };
            source.onended = () => finalize();
            const handle: AudioPlaybackHandle = {
                stop: () => {
                    if (ended) return;
                    try {
                        source.stop();
                    } catch (error) {
                        log('[SfxService] Failed to stop source node', error);
                    } finally {
                        finalize();
                    }
                },
                finished,
            };
            registerHandle(handle);
            source.start();
            return handle;
        },
        stopAll,
        async dispose() {
            stopAll();
            bufferCache.clear();
            const ctx = audioContext;
            audioContext = null;
            if (ctx && ctx.state !== 'closed') {
                try {
                    await ctx.close();
                } catch (error) {
                    log('[SfxService] Failed to close AudioContext', error);
                }
            }
        },
    };
};

export class SfxService {
    private registry: SfxRegistry = new Map();
    private unsubscribe?: () => void;
    private readonly isEnabled: () => boolean;
    private readonly log: (msg: string, extra?: unknown) => void;
    private readonly audio: SfxAudioAdapter;
    private readonly playingHandles = new Map<SfxActionId, Set<AudioPlaybackHandle>>();

    constructor(deps: SfxServiceDeps) {
        this.isEnabled = deps.isEnabled ?? (() => true);
        this.log = deps.log ?? ((msg: string, extra?: unknown) => console.warn(msg, extra));
        this.audio = deps.audio ?? createDefaultAudioAdapter(this.log);
        this.unsubscribe = deps.bus.subscribe(this.handleEvent);
    }

    dispose() {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        this.audio.stopAll();
        this.playingHandles.clear();
        if (typeof this.audio.dispose === 'function') {
            Promise.resolve(this.audio.dispose()).catch(error => {
                this.log('[SfxService] Failed to dispose audio adapter', error);
            });
        }
    }

    register(actionId: SfxActionId, config: SfxConfig) {
        this.registry.set(actionId, config);
        if (this.isAudioConfig(config) && config.preload !== false) {
            this.preloadAudioSources(config);
        }
    }

    unregister(actionId: SfxActionId) {
        this.registry.delete(actionId);
    }

    clear() {
        this.registry.clear();
    }

    play(actionId: SfxActionId, ctx?: Partial<SfxPlayContext>) {
        const event = ctx?.event ?? this.createSyntheticEvent(actionId);
        this.playAction(actionId, event);
    }

    private handleEvent = (event: GameEvent) => {
        // hack: not elegant but solve the problem
        if (event.type === 'round.end' || event.type === 'battle.victory') {
            this.stopActionPlayback('round.start');
        }
        const actions = this.mapEventToActions(event);
        actions.forEach(actionId => this.playAction(actionId, event));
    };

    private playAction(actionId: SfxActionId, event: GameEvent) {
        if (!this.isEnabled()) return;
        const config = this.registry.get(actionId);
        if (!config) return;

        const ctx: SfxPlayContext = { actionId, event };
        if (typeof config === 'function') {
            config(ctx);
            return;
        }

        if (this.isAudioConfig(config)) {
            if (config.stopActions?.length) {
                config.stopActions.forEach(action => this.stopActionPlayback(action));
            }
            const src = this.pickAudioSource(config);
            if (!src) return;
            const handleResult = this.audio.play(src, this.createPlaybackOptions(config));
            this.trackHandle(actionId, handleResult);
            return;
        }

        this.log('[SfxService] Unknown SFX config type', { actionId, config });
    }

    private isAudioConfig(config: SfxConfig): config is AudioFileConfig {
        return typeof config === 'object' && config !== null && 'type' in config && config.type === 'audio-file';
    }

    private pickAudioSource(config: AudioFileConfig): string | undefined {
        if (Array.isArray(config.src)) {
            if (config.src.length === 0) return undefined;
            const index = Math.floor(Math.random() * config.src.length);
            return config.src[index];
        }
        return config.src;
    }

    private createPlaybackOptions(config: AudioFileConfig): AudioPlaybackOptions {
        const playbackRate = this.resolvePlaybackRate(config.playbackRate);
        const options: AudioPlaybackOptions = {
            volume: config.volume,
            loop: config.loop,
        };
        if (typeof playbackRate === 'number') {
            options.playbackRate = playbackRate;
        }
        return options;
    }

    private resolvePlaybackRate(rate?: number | AudioFilePlaybackRateRange): number | undefined {
        if (typeof rate === 'number') {
            return rate;
        }
        if (!rate) return undefined;
        const min = typeof rate.min === 'number' ? rate.min : undefined;
        const max = typeof rate.max === 'number' ? rate.max : undefined;
        if (typeof min === 'number' && typeof max === 'number') {
            if (min === max) return min;
            const low = Math.min(min, max);
            const high = Math.max(min, max);
            return low + Math.random() * (high - low);
        }
        return min ?? max ?? undefined;
    }

    private preloadAudioSources(config: AudioFileConfig) {
        const sources = Array.isArray(config.src) ? config.src : [config.src];
        sources.forEach(src => {
            if (src) {
                this.audio.preload(src);
            }
        });
    }

    private trackHandle(
        actionId: SfxActionId,
        maybeHandle: AudioPlaybackHandle | void | Promise<AudioPlaybackHandle | void>
    ) {
        if (!maybeHandle) return;
        Promise.resolve(maybeHandle)
            .then(handle => {
                if (!handle) return;
                const set = this.playingHandles.get(actionId) ?? new Set<AudioPlaybackHandle>();
                if (!this.playingHandles.has(actionId)) {
                    this.playingHandles.set(actionId, set);
                }
                set.add(handle);
                handle.finished.finally(() => {
                    const currentSet = this.playingHandles.get(actionId);
                    if (!currentSet) return;
                    currentSet.delete(handle);
                    if (currentSet.size === 0) {
                        this.playingHandles.delete(actionId);
                    }
                });
            })
            .catch(error => {
                this.log('[SfxService] Failed to track audio handle', error);
            });
    }

    private stopActionPlayback(actionId: SfxActionId) {
        const handles = this.playingHandles.get(actionId);
        if (!handles) return;
        handles.forEach(handle => handle.stop());
        this.playingHandles.delete(actionId);
    }

    private mapEventToActions(event: GameEvent): SfxActionId[] {
        switch (event.type) {
            case 'hand.action': {
                const owner = this.mapOwner(event.payload.actor);
                return this.mapHandAction(event.payload.action, owner);
            }
            case 'card.drawn': {
                const owner = this.mapOwner(event.payload.actor);
                return [`card.draw.${owner}`];
            }
            case 'card.revealed': {
                const owner = this.mapOwner(event.payload.actor);
                return [`card.reveal.${owner}`];
            }
            case 'damage.number': {
                if (event.payload.variant === 'GOLD') {
                    return [this.mapGoldAction(event.payload.value)];
                }
                const owner = this.mapOwner(event.payload.target);
                if (event.payload.variant === 'DAMAGE') {
                    return [`damage.${owner}`];
                }
                if (event.payload.variant === 'HEAL') {
                    return [`heal.${owner}`];
                }
                return [];
            }
            case 'item.animation': {
                if (event.payload.phase !== 'START') return [];
                const owner = this.mapOwner(event.payload.actor);
                return [`hand.useItem.${owner}`];
            }
            case 'environment.animation': {
                if (event.payload.state === 'entering') return ['env.card.enter'];
                if (event.payload.state === 'exiting') return ['env.card.exit'];
                return [];
            }
            case 'penalty.card': {
                if (event.payload.state === 'DRAWN') return ['penalty.card.drawn'];
                if (event.payload.state === 'APPLIED') return ['penalty.card.applied'];
                return [];
            }
            case 'clash.state': {
                if (event.payload.active) return ['round.clash'];
                switch (event.payload.result) {
                    case 'player_win':
                        return ['round.win'];
                    case 'enemy_win':
                        return ['round.lose'];
                    case 'draw':
                        return ['round.draw'];
                    default:
                        return [];
                }
            }
            case 'visual.effect':
                return ['ui.error'];
            case 'round.start':
                    return ['round.start'];
            case 'round.end':
                    return ['round.end'];
            case 'battle.victory':
                    return ['battle.victory'];
            default:
                return [];
        }
    }

    private mapHandAction(action: HandAction, owner: Owner): SfxActionId[] {
        switch (action) {
            case 'HIT':
                return [`hand.hit.${owner}`];
            case 'STAND':
            case 'LEAVE':
                return [`hand.stand.${owner}`];
            case 'USE':
                return [`hand.useItem.${owner}`];
            case 'HURT':
                return [`hand.hurt.${owner}`];
            default:
                return [];
        }
    }

    private mapGoldAction(value: number | string): SfxActionId {
        if (typeof value === 'number') {
            return value >= 0 ? 'gold.gain' : 'gold.spend';
        }
        const trimmed = value.trim();
        return trimmed.startsWith('-') ? 'gold.spend' : 'gold.gain';
    }

    private mapOwner(turnOwner: TurnOwner): Owner {
        return turnOwner === 'PLAYER' ? 'player' : 'enemy';
    }

    private createSyntheticEvent(actionId: SfxActionId): GameEvent {
        return {
            type: 'visual.effect',
            payload: { effect: `${SYNTHETIC_EVENT_EFFECT_PREFIX}${actionId}` },
        };
    }
}

interface SfxPreset {
    actionId: SfxActionId;
    config: SfxConfig;
}

const createAudioFileConfig = (
    src: string,
    options: Omit<AudioFileConfig, 'type' | 'src'> = {}
): AudioFileConfig => ({
    type: 'audio-file',
    src,
    volume: options.volume,
    playbackRate: options.playbackRate,
    loop: options.loop,
    preload: options.preload ?? true,
    stopActions: options.stopActions,
});

export const DEFAULT_SFX_PRESETS: readonly SfxPreset[] = [
    {
        actionId: 'battle.victory',
        config: createAudioFileConfig(battleWinClip, {
            volume: 1,
        }),
    },
    {
        actionId: 'round.start',
        config: createAudioFileConfig(crowdedSaloonClip, {
            volume: 0.1,
            loop: true,
        }),
    },
    {
        actionId: 'card.draw.player',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.7,
        }),
    },
    {
        actionId: 'card.draw.player',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.7,
        }),
    },
    {
        actionId: 'card.draw.enemy',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.65,
        }),
    },
    {
        actionId: 'card.reveal.player',
        config: createAudioFileConfig(flipCardClip, {
            volume: 1,
        }),
    },
    {
        actionId: 'card.reveal.enemy',
        config: createAudioFileConfig(flipCardClip, {
            volume: 1,
        }),
    },
    // {
    //     actionId: 'hand.hit.player',
    //     config: createAudioFileConfig(handHitPlayerClip, {
    //         volume: 0.85,
    //     }),
    // },
    // {
    //     actionId: 'hand.hit.enemy',
    //     config: createAudioFileConfig(handHitEnemyClip, {
    //         volume: 0.83,
    //     }),
    // },
    // {
    //     actionId: 'hand.stand.player',
    //     config: createAudioFileConfig(handStandClip, {
    //         volume: 0.6,
    //     }),
    // },
    // {
    //     actionId: 'hand.stand.enemy',
    //     config: createAudioFileConfig(handStandClip, {
    //         volume: 0.55,
    //     }),
    // },
    {
        actionId: 'hand.useItem.player',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.78,
        }),
    },
    {
        actionId: 'hand.useItem.enemy',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.72,
        }),
    },
    // {
    //     actionId: 'hand.hurt.player',
    //     config: createAudioFileConfig(handHurtPlayerClip, {
    //         volume: 0.85,
    //     }),
    // },
    // {
    //     actionId: 'hand.hurt.enemy',
    //     config: createAudioFileConfig(handHurtEnemyClip, {
    //         volume: 0.82,
    //     }),
    // },
    {
        actionId: 'damage.player',
        config: createAudioFileConfig(damageHurtClip, {
            volume: 1,
        }),
    },
    {
        actionId: 'damage.enemy',
        config: createAudioFileConfig(damageHurtClip, {
            volume: 0.88,
        }),
    },
    // {
    //     actionId: 'heal.player',
    //     config: createAudioFileConfig(healPlayerClip, {
    //         volume: 0.75,
    //     }),
    // },
    // {
    //     actionId: 'heal.enemy',
    //     config: createAudioFileConfig(healEnemyClip, {
    //         volume: 0.72,
    //     }),
    // },
    // {
    //     actionId: 'gold.gain',
    //     config: createAudioFileConfig(goldGainClip, {
    //         volume: 0.78,
    //     }),
    // },
    // {
    //     actionId: 'gold.spend',
    //     config: createAudioFileConfig(goldSpendClip, {
    //         volume: 0.7,
    //     }),
    // },
    {
        actionId: 'round.clash',
        config: createAudioFileConfig(clashRoundClip, {
            volume: 1,
        }),
    },
    // {
    //     actionId: 'round.win',
    //     config: createAudioFileConfig(roundWinClip, {
    //         volume: 1,
    //     }),
    // },
    // {
    //     actionId: 'round.lose',
    //     config: createAudioFileConfig(roundLoseClip, {
    //         volume: 0.82,
    //     }),
    // },
    // {
    //     actionId: 'round.draw',
    //     config: createAudioFileConfig(roundDrawClip, {
    //         volume: 0.8,
    //     }),
    // },
    {
        actionId: 'env.card.enter',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.68,
        }),
    },
    {
        actionId: 'penalty.card.drawn',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.75,
        }),
    },
];

export const registerDefaultSfxPresets = (service: SfxService) => {
    DEFAULT_SFX_PRESETS.forEach(preset => service.register(preset.actionId, preset.config));
};
