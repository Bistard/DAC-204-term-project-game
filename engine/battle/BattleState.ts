import {
    Card,
    Enemy,
    EnvironmentCard,
    EnvironmentRuntimeState,
    PenaltyCard,
    PenaltyRuntimeState,
} from '../../common/types';
import { BattleRuleState } from './rules/BattleRuleState';

/**
 * Snapshot of the mutable data a single Battle owns. This mirrors the fields
 * currently stored on GameState.battle and will gradually replace the ad-hoc
 * shape once wiring is complete.
 */
export interface BattleState {
    roundCount: number;
    activeEnvironment: EnvironmentCard[];
    environmentRuntime: EnvironmentRuntimeState;
    activePenalty: PenaltyCard | null;
    penaltyRuntime: PenaltyRuntimeState;
    player: {
        hp: number;
        maxHp: number;
        hand: Card[];
        score: number;
        shield: number;
    };
    enemy: Enemy | null;
    deck: Card[];
    discardPile: Card[];
    environmentDisabledCards: Card[];
    ruleState?: BattleRuleState;
}
