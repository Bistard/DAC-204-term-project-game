import { GOLD_REWARD_BASE, GOLD_REWARD_PERFECT } from '../common/constants';
import { LogicEffectConfig } from '../common/types';

export type GameEventTrigger = 'ENEMY_DEFEATED' | 'PERFECT_SCORE';

export interface EventEffectDefinition {
    id: string;
    trigger: GameEventTrigger;
    description: string;
    effects: LogicEffectConfig[];
}

export const EVENT_EFFECTS: EventEffectDefinition[] = [
    {
        id: 'enemy_defeat_base_gold',
        trigger: 'ENEMY_DEFEATED',
        description: 'Base bounty for defeating an enemy.',
        effects: [
            {
                type: 'GOLD',
                amount: GOLD_REWARD_BASE,
                scope: 'SELF',
            },
        ],
    },
    {
        id: 'enemy_defeat_level_bonus',
        trigger: 'ENEMY_DEFEATED',
        description: 'Level-based bonus gold (runLevel - 1).',
        effects: [
            {
                type: 'GOLD',
                amount: 1,
                scope: 'SELF',
                metadata: {
                    perLevelOffset: 1,
                },
            },
        ],
    },
    {
        id: 'perfect_score_bonus',
        trigger: 'PERFECT_SCORE',
        description: 'Bonus gold when hitting the exact target score.',
        effects: [
            {
                type: 'GOLD',
                amount: GOLD_REWARD_PERFECT,
                scope: 'SELF',
            },
        ],
    },
];
