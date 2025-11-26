import { DAMAGE_BUST_ENEMY, DAMAGE_BUST_PLAYER } from '../../common/constants';
import {
    PenaltyDamageContext,
    PenaltyDamageResult,
    PenaltyRuntimeState,
} from '../../common/types';
import { GameStore } from '../state/gameStore';
import { CreateMetaFn } from './commonService';

interface PenaltyEngineDeps {
    store: GameStore;
    createMeta: CreateMetaFn;
}

export interface PenaltyContextInput extends Omit<PenaltyDamageContext, 'runtime'> {}

export class PenaltyEngine {
    constructor(private deps: PenaltyEngineDeps) {}

    evaluateDamage(context: PenaltyContextInput): PenaltyDamageResult {
        const state = this.deps.store.snapshot.state;
        const penalty = state.activePenalty;
        const payload: PenaltyDamageContext = {
            ...context,
            runtime: state.penaltyRuntime,
        };

        let result: PenaltyDamageResult;
        if (!penalty) {
            result = this.computeLegacyDamage(payload);
        } else {
            try {
                result = penalty.damageFunction(payload);
            } catch (error) {
                result = this.computeLegacyDamage(payload);
            }
        }

        this.patchPenaltyRuntime(result.runtimePatch);
        return result;
    }

    private computeLegacyDamage(context: PenaltyDamageContext): PenaltyDamageResult {
        if (context.winner === 'DRAW') {
            return { playerDamage: 0, enemyDamage: 0 };
        }

        let playerDamage = 0;
        let enemyDamage = 0;
        if (context.playerBust && !context.enemyBust) {
            playerDamage = DAMAGE_BUST_PLAYER;
        } else if (context.enemyBust && !context.playerBust) {
            enemyDamage = DAMAGE_BUST_ENEMY;
        } else if (context.winner === 'PLAYER') {
            enemyDamage = DAMAGE_BUST_ENEMY;
        } else if (context.winner === 'ENEMY') {
            playerDamage = DAMAGE_BUST_PLAYER;
        }
        return { playerDamage, enemyDamage };
    }

    private patchPenaltyRuntime(patch?: PenaltyDamageResult['runtimePatch']) {
        if (!patch) return;
        this.deps.store.updateState(
            prev => {
                const current = prev.penaltyRuntime;
                const next: PenaltyRuntimeState = {
                    lastWinner: patch.lastWinner ?? current.lastWinner,
                    consecutiveWins: {
                        PLAYER: patch.consecutiveWins?.PLAYER ?? current.consecutiveWins.PLAYER,
                        ENEMY: patch.consecutiveWins?.ENEMY ?? current.consecutiveWins.ENEMY,
                    },
                };

                if (
                    next.lastWinner === current.lastWinner &&
                    next.consecutiveWins.PLAYER === current.consecutiveWins.PLAYER &&
                    next.consecutiveWins.ENEMY === current.consecutiveWins.ENEMY
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    penaltyRuntime: next,
                };
            },
            this.deps.createMeta('penalty.runtime', 'Penalty runtime updated', undefined, {
                suppressHistory: true,
                suppressLog: true,
            })
        );
    }
}
