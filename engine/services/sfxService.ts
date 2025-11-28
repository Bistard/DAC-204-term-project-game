import { AudioPlaybackOptions } from '../../common/audio/audioClipPlayer';
import { GameEvent, HandAction, TurnOwner } from '../../common/types';
import { EventBus } from '../eventBus';
import dealCardClip from '../../assets/sfx/deal-card.wav';
import hurtClip from '../../assets/sfx/hurt.wav';


export type SfxActionId =
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

export interface AudioFileConfig {
    type: 'audio-file';
    src: string;
    volume?: number;
    playbackRate?: number | AudioFilePlaybackRateRange;
    loop?: boolean;
    preload?: boolean;
}

export type SfxConfig = AudioFileConfig | SfxPlayFn;

export type SfxRegistry = Map<SfxActionId, SfxConfig>;

interface SfxServiceDeps {
    bus: EventBus;
    playAudio: (src: string, options?: AudioPlaybackOptions) => void | Promise<void>;
    preloadAudio?: (src: string) => void | Promise<void>;
    isEnabled?: () => boolean;
    log?: (msg: string, extra?: unknown) => void;
}

type Owner = 'player' | 'enemy';

const SYNTHETIC_EVENT_EFFECT_PREFIX = 'sfx:';

export class SfxService {
    private registry: SfxRegistry = new Map();
    private unsubscribe?: () => void;
    private readonly isEnabled: () => boolean;
    private readonly log: (msg: string, extra?: unknown) => void;

    constructor(private readonly deps: SfxServiceDeps) {
        this.isEnabled = deps.isEnabled ?? (() => true);
        this.log = deps.log ?? ((msg: string, extra?: unknown) => console.warn(msg, extra));
        this.unsubscribe = deps.bus.subscribe(this.handleEvent);
    }

    dispose() {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    register(actionId: SfxActionId, config: SfxConfig) {
        this.registry.set(actionId, config);
        if (this.isAudioConfig(config)) {
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
            const src = this.pickAudioSource(config);
            if (!src) return;
            this.deps.playAudio(src, this.createPlaybackOptions(config));
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
        if (!this.deps.preloadAudio) return;
        const sources = Array.isArray(config.src) ? config.src : [config.src];
        sources.forEach(src => {
            if (src) {
                this.deps.preloadAudio?.(src);
            }
        });
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
});

export const DEFAULT_SFX_PRESETS: readonly SfxPreset[] = [
    {
        actionId: 'card.draw.player',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.7,
            playbackRate: { min: 0.96, max: 1.04 },
        }),
    },
    {
        actionId: 'card.draw.enemy',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.65,
            playbackRate: { min: 0.94, max: 1.02 },
        }),
    },
    // {
    //     actionId: 'card.reveal.player',
    //     config: createAudioFileConfig(cardDrawPlayerClip, {
    //         volume: 0.6,
    //         playbackRate: { min: 0.9, max: 1 },
    //     }),
    // },
    // {
    //     actionId: 'card.reveal.enemy',
    //     config: createAudioFileConfig(cardDrawEnemyClip, {
    //         volume: 0.58,
    //         playbackRate: { min: 0.9, max: 1 },
    //     }),
    // },
    // {
    //     actionId: 'hand.hit.player',
    //     config: createAudioFileConfig(handHitPlayerClip, {
    //         volume: 0.85,
    //         playbackRate: { min: 0.92, max: 1.05 },
    //     }),
    // },
    // {
    //     actionId: 'hand.hit.enemy',
    //     config: createAudioFileConfig(handHitEnemyClip, {
    //         volume: 0.83,
    //         playbackRate: { min: 0.92, max: 1.03 },
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
    //         playbackRate: 0.95,
    //     }),
    // },
    {
        actionId: 'hand.useItem.player',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.78,
            playbackRate: { min: 0.9, max: 1.1 },
        }),
    },
    {
        actionId: 'hand.useItem.enemy',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.72,
            playbackRate: { min: 0.85, max: 1 },
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
        config: createAudioFileConfig(hurtClip, {
            volume: 0.9,
        }),
    },
    {
        actionId: 'damage.enemy',
        config: createAudioFileConfig(hurtClip, {
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
    // {
    //     actionId: 'round.clash',
    //     config: createAudioFileConfig(roundClashClip, {
    //         volume: 0.92,
    //     }),
    // },
    // {
    //     actionId: 'round.win',
    //     config: createAudioFileConfig(roundWinClip, {
    //         volume: 0.85,
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
    {
        actionId: 'penalty.card.applied',
        config: createAudioFileConfig(dealCardClip, {
            volume: 0.78,
        }),
    }
];

export const registerDefaultSfxPresets = (service: SfxService) => {
    DEFAULT_SFX_PRESETS.forEach(preset => service.register(preset.actionId, preset.config));
};
