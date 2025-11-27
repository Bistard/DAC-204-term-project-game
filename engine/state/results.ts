import { Item, TurnOwner } from '../../common/types';
import { RoundModifierState } from '../../common/types';

export type BattleResultWinner = TurnOwner | 'DRAW';

export interface IRoundResult {
    roundNumber: number;
    winner: BattleResultWinner;
    playerScore: number;
    enemyScore: number;
    playerBust: boolean;
    enemyBust: boolean;
    isPerfect: boolean;
    damageAdjustments: Record<TurnOwner, number>;
    damageImmunity: Record<TurnOwner, boolean>;
    loserDamageBonus: number;
    metadata?: Record<string, unknown>;
}

export interface IBattleResult {
    winner: BattleResultWinner;
    roundsPlayed: number;
    playerHpDelta: number;
    enemyHpDelta: number;
    suddenDeath: boolean;
    rewards: Item[];
    roundResults: IRoundResult[];
    metadata?: Record<string, unknown>;
}

type RoundAdjustmentSnapshot = Pick<RoundModifierState, 'damageAdjustments' | 'damageImmunity' | 'loserDamageBonus'>;

const createAdjustmentSnapshot = (): RoundAdjustmentSnapshot => ({
    damageAdjustments: { PLAYER: 0, ENEMY: 0 },
    damageImmunity: { PLAYER: false, ENEMY: false },
    loserDamageBonus: 0,
});

const cloneItem = (item: Item): Item => ({ ...item });

export const cloneRoundResult = (result: IRoundResult): IRoundResult => ({
    ...result,
    damageAdjustments: { ...result.damageAdjustments },
    damageImmunity: { ...result.damageImmunity },
    metadata: result.metadata ? { ...result.metadata } : undefined,
});

export const createDefaultRoundResult = (overrides: Partial<IRoundResult> = {}): IRoundResult => {
    const baseAdjustments = createAdjustmentSnapshot();
    const adjustments = overrides.damageAdjustments ? { ...overrides.damageAdjustments } : baseAdjustments.damageAdjustments;
    const immunity = overrides.damageImmunity ? { ...overrides.damageImmunity } : baseAdjustments.damageImmunity;
    return {
        roundNumber: 0,
        winner: 'DRAW',
        playerScore: 0,
        enemyScore: 0,
        playerBust: false,
        enemyBust: false,
        isPerfect: false,
        loserDamageBonus: baseAdjustments.loserDamageBonus,
        metadata: undefined,
        ...overrides,
        damageAdjustments: adjustments,
        damageImmunity: immunity,
    };
};

export const createDefaultBattleResult = (overrides: Partial<IBattleResult> = {}): IBattleResult => {
    const rewards = overrides.rewards ? overrides.rewards.map(cloneItem) : [];
    const roundResults = overrides.roundResults ? overrides.roundResults.map(cloneRoundResult) : [];
    return {
        winner: 'DRAW',
        roundsPlayed: 0,
        playerHpDelta: 0,
        enemyHpDelta: 0,
        suddenDeath: false,
        metadata: undefined,
        ...overrides,
        rewards,
        roundResults,
    };
};
