import { EnvironmentCard, EnvironmentRule, EnvironmentRuntimeState } from '../../common/types';

export const createEmptyEnvironmentRuntime = (): EnvironmentRuntimeState => ({
    appliedCardIds: [],
    scoreOptions: {
        aceMode: 'FLEXIBLE',
        specialBustValues: [],
    },
    deckMutators: {
        randomRemovalsPerRound: 0,
    },
    drawHooks: {
        autoDrawPerActor: 0,
    },
    rewardHooks: {
        perfectItemDraw: 0,
    },
    damageModifiers: {
        baseDamage: 0,
        multiplier: 1,
    },
    itemLocks: {
        disableUsage: false,
    },
    victoryHooks: {
        suddenDeathThreshold: undefined,
    },
});

export const cloneEnvironmentRuntime = (runtime: EnvironmentRuntimeState): EnvironmentRuntimeState => ({
    ...runtime,
    appliedCardIds: [...runtime.appliedCardIds],
    targetRule: runtime.targetRule ? { ...runtime.targetRule } : undefined,
    scoreOptions: {
        aceMode: runtime.scoreOptions.aceMode,
        specialBustValues: [...runtime.scoreOptions.specialBustValues],
    },
    deckMutators: { ...runtime.deckMutators },
    drawHooks: { ...runtime.drawHooks },
    rewardHooks: { ...runtime.rewardHooks },
    damageModifiers: { ...runtime.damageModifiers },
    itemLocks: { ...runtime.itemLocks },
    victoryHooks: { ...runtime.victoryHooks },
});

export const buildEnvironmentRuntime = (cards: EnvironmentCard[]): EnvironmentRuntimeState => {
    const runtime = createEmptyEnvironmentRuntime();
    runtime.appliedCardIds = cards.map(card => card.id);
    cards.forEach(card => {
        card.rules?.forEach(rule => applyRule(runtime, rule, card));
    });

    runtime.scoreOptions.specialBustValues = Array.from(
        new Set(runtime.scoreOptions.specialBustValues)
    ).sort((a, b) => a - b);

    return runtime;
};

const applyRule = (runtime: EnvironmentRuntimeState, rule: EnvironmentRule, card: EnvironmentCard) => {
    const metadata = rule.metadata ?? {};
    switch (rule.type) {
        case 'TARGET_RANDOMIZE': {
            const values = pickNumberArray(metadata, ['values', 'options']);
            if (values.length === 0) break;
            const pick = pickRandom(values);
            runtime.targetRule = {
                value: pick,
                sourceCardId: card.id,
                label: card.name,
            };
            break;
        }
        case 'DAMAGE_FLAT_MODIFIER': {
            const amount = Math.floor(pickNumber(metadata, ['amount', 'value', 'delta'], 0));
            if (amount !== 0) {
                runtime.damageModifiers.baseDamage += amount;
            }
            break;
        }
        case 'SUDDEN_DEATH_THRESHOLD': {
            const threshold = Math.floor(
                pickNumber(metadata, ['hpThreshold', 'threshold', 'value', 'amount'], 0)
            );
            if (threshold > 0) {
                runtime.victoryHooks.suddenDeathThreshold = threshold;
            }
            break;
        }
        case 'DECK_SHRINK': {
            const count = Math.floor(pickNumber(metadata, ['removePerRound', 'amount', 'value'], 0));
            if (count > 0) {
                runtime.deckMutators.randomRemovalsPerRound += count;
            }
            break;
        }
        case 'PERFECT_REWARD_ITEM': {
            const count = Math.floor(pickNumber(metadata, ['amount', 'value', 'cards'], 1));
            if (count > 0) {
                runtime.rewardHooks.perfectItemDraw += count;
            }
            break;
        }
        case 'ROUND_START_AUTO_DRAW': {
            const count = Math.floor(pickNumber(metadata, ['cardsPerActor', 'amount', 'value'], 0));
            if (count > 0) {
                runtime.drawHooks.autoDrawPerActor += count;
            }
            break;
        }
        case 'ACE_VALUE_MODE': {
            const behaviorRaw = String(metadata.behavior ?? metadata.mode ?? '').toUpperCase();
            runtime.scoreOptions.aceMode = behaviorRaw === 'ALWAYS_HIGH' ? 'ALWAYS_HIGH' : 'FLEXIBLE';
            break;
        }
        case 'ITEM_USAGE_LOCK': {
            runtime.itemLocks.disableUsage = true;
            break;
        }
        case 'SPECIAL_BUST_VALUES': {
            const values = pickNumberArray(metadata, ['values', 'thresholds']);
            if (values.length > 0) {
                runtime.scoreOptions.specialBustValues.push(...values.map(v => Math.floor(v)));
            }
            break;
        }
        default:
            break;
    }
};

const pickNumber = (
    metadata: Record<string, number | string | boolean | number[] | string[]>,
    keys: string[],
    fallback: number
): number => {
    for (const key of keys) {
        if (!(key in metadata)) continue;
        const value = metadata[key];
        const parsed = tryParseNumber(value);
        if (parsed !== null) return parsed;
    }
    return fallback;
};

const pickNumberArray = (
    metadata: Record<string, number | string | boolean | number[] | string[]>,
    keys: string[]
): number[] => {
    for (const key of keys) {
        if (!(key in metadata)) continue;
        const raw = metadata[key];
        if (Array.isArray(raw)) {
            return raw.map(tryParseNumber).filter((value): value is number => value !== null);
        }
        if (typeof raw === 'string') {
            return raw
                .split(',')
                .map(entry => tryParseNumber(entry))
                .filter((value): value is number => value !== null);
        }
    }
    return [];
};

const tryParseNumber = (value: string | number | boolean | number[] | string[]): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const pickRandom = <T>(values: T[]): T => values[Math.floor(Math.random() * values.length)];
