import { PenaltyCard, PenaltyDamageResult, TurnOwner } from '../common/types';

const noDamage = (): PenaltyDamageResult => ({
    playerDamage: 0,
    enemyDamage: 0,
});

const getLoserDamageResult = (loser: TurnOwner, amount: number): PenaltyDamageResult => ({
    playerDamage: loser === 'PLAYER' ? amount : 0,
    enemyDamage: loser === 'ENEMY' ? amount : 0,
});

export const PENALTY_CARDS: PenaltyCard[] = [
    {
        id: 'fixed_damage',
        name: 'Fixed Damage',
        description: 'The loser always suffers 3 damage.',
        damageFunction: context => {
            if (context.winner === 'DRAW' || !context.loser) {
                return noDamage();
            }
            return {
                ...getLoserDamageResult(context.loser, 3),
                messageFragment: 'Fixed 3 damage',
            };
        },
    },
    {
        id: 'scaling_per_round',
        name: 'Scaling Per Round',
        description: 'Base damage to loser is 1. Each round increases by +1.',
        damageFunction: context => {
            if (context.winner === 'DRAW' || !context.loser) {
                return noDamage();
            }
            const damage = Math.max(1, context.roundNumber);
            return {
                ...getLoserDamageResult(context.loser, damage),
                messageFragment: `Round ${context.roundNumber} scale`,
            };
        },
    },
    {
        id: 'score_difference',
        name: 'Score Difference',
        description: 'Loser damage equals the point differential between hands.',
        damageFunction: context => {
            if (context.winner === 'DRAW' || !context.loser) {
                return noDamage();
            }
            const winnerScore = context.winner === 'PLAYER' ? context.playerScore : context.enemyScore;
            const loserScore = context.loser === 'PLAYER' ? context.playerScore : context.enemyScore;
            const damage = Math.max(0, Math.abs(winnerScore - loserScore));
            return {
                ...getLoserDamageResult(context.loser, damage),
                messageFragment: `Diff ${damage}`,
            };
        },
    },
    {
        id: 'win_heal_rule',
        name: 'Win-Heal Rule',
        description: 'Loser takes 3 damage. Winner heals 1 HP.',
        damageFunction: context => {
            if (context.winner === 'DRAW' || !context.loser) {
                return noDamage();
            }
            const result = {
                ...getLoserDamageResult(context.loser, 3),
                messageFragment: '3 dmg / Winner +1 HP',
            };
            if (context.winner === 'PLAYER') {
                result.playerHeal = 1;
            } else {
                result.enemyHeal = 1;
            }
            return result;
        },
    },
    {
        id: 'pressure',
        name: 'Pressure',
        description: 'Base damage to loser is 2. Consecutive wins add +1 each time.',
        damageFunction: context => {
            if (context.winner === 'DRAW' || !context.loser) {
                return {
                    ...noDamage(),
                    runtimePatch: {
                        lastWinner: null,
                        consecutiveWins: { PLAYER: 0, ENEMY: 0 },
                    },
                };
            }
            const baseDamage = 2;
            const prevWinner = context.runtime.lastWinner;
            const sameWinner = prevWinner === context.winner;
            const prevStreak = context.runtime.consecutiveWins[context.winner] ?? 0;
            const newStreak = sameWinner ? prevStreak + 1 : 1;
            const damage = baseDamage + Math.max(0, newStreak - 1);
            const messageFragment =
                sameWinner && newStreak > 1
                    ? `Damage +${newStreak - 1}`
                    : context.runtime.lastWinner
                    ? 'Damage reset'
                    : undefined;
            return {
                ...getLoserDamageResult(context.loser, damage),
                runtimePatch: {
                    lastWinner: context.winner,
                    consecutiveWins: {
                        PLAYER: context.winner === 'PLAYER' ? newStreak : 0,
                        ENEMY: context.winner === 'ENEMY' ? newStreak : 0,
                    },
                },
                messageFragment,
            };
        },
    },
];
