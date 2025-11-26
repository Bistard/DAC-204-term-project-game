import { EnvironmentCard } from '../common/types';

export const ENVIRONMENT_CARDS: EnvironmentCard[] = [
    {
        id: 'dynamic_target',
        name: 'Dynamic Target',
        description: 'Target score is re-rolled to 18, 24, or 27 for this battle.',
        incompatibleWith: ['specific_bust_17_18'],
        rules: [
            {
                id: 'dynamic_target_override',
                type: 'TARGET_RANDOMIZE',
                metadata: { values: [18, 24, 27] },
            },
        ],
    },
    {
        id: 'global_damage_plus_one',
        name: 'Damage + 1',
        description: 'All sources of damage + 1.',
        rules: [
            {
                id: 'damage_plus_one',
                type: 'DAMAGE_FLAT_MODIFIER',
                metadata: { amount: 1 },
            },
        ],
    },
    {
        id: 'sudden_death_low_hp',
        name: 'Sudden Death',
        description: 'After resolution, anyone at or below 3 HP instantly dies.',
        rules: [
            {
                id: 'sudden_death_threshold',
                type: 'SUDDEN_DEATH_THRESHOLD',
                metadata: { hpThreshold: 3 },
            },
        ],
    },
    {
        id: 'small_deck',
        name: 'Small Deck',
        description: 'At the start of every round, disable 2 random cards from the deck.',
        rules: [
            {
                id: 'small_deck_thinning',
                type: 'DECK_SHRINK',
                metadata: { removePerRound: 2 },
            },
        ],
    },
    {
        id: 'perfect_reward',
        name: 'Perfect Bounty',
        description: 'Any perfect score awards 1 bonus item card.',
        rules: [
            {
                id: 'perfect_item_reward',
                type: 'PERFECT_REWARD_ITEM',
                metadata: { amount: 1 },
            },
        ],
    },
    {
        id: 'auto_hit',
        name: 'Auto Hit',
        description: 'Each round both sides auto-drawing 1 card.',
        incompatibleWith: ['no_items'],
        rules: [
            {
                id: 'auto_hit_round_start',
                type: 'ROUND_START_AUTO_DRAW',
                metadata: { cardsPerActor: 1 },
            },
        ],
    },
    {
        id: 'high_risk_ace',
        name: 'High-Risk Ace',
        description: 'All aces always count as 11.',
        rules: [
            {
                id: 'ace_always_high',
                type: 'ACE_VALUE_MODE',
                metadata: { behavior: 'ALWAYS_HIGH' },
            },
        ],
    },
    {
        id: 'no_items',
        name: 'Return to Classic',
        description: 'Item cards may not be used.',
        incompatibleWith: ['auto_hit'],
        rules: [
            {
                id: 'item_lockout',
                type: 'ITEM_USAGE_LOCK',
            },
        ],
    },
    {
        id: 'specific_bust_17_18',
        name: 'Fragile',
        description: 'Reaching 17 or 18 also counts as busting.',
        incompatibleWith: ['dynamic_target'],
        rules: [
            {
                id: 'bust_values_17_18',
                type: 'SPECIAL_BUST_VALUES',
                metadata: { values: [17, 18] },
            },
        ],
    },
];
