import { EnvironmentCard, EnvironmentRule, PenaltyCard } from '../../../common/types';
import { IRoundResult } from '../../state/results';
import { BattleRuleState, createDefaultBattleRuleState } from './BattleRuleState';
import { IBattleRuleService, IRoundRuleContext } from './IBattleRuleService';

export class BattleRuleService implements IBattleRuleService {
    initialize(cards: EnvironmentCard[], _penalty: PenaltyCard | null): BattleRuleState {
        const state = createDefaultBattleRuleState();
        cards.forEach(card => card.rules?.forEach(rule => this.applyRule(rule, state)));
        return state;
    }

    applyRoundResult(_result: IRoundResult, state: BattleRuleState): BattleRuleState {
        return state;
    }

    createRoundContext(state: BattleRuleState): IRoundRuleContext {
        return {
            targetScore: state.targetScoreOverride ?? 0,
            autoDrawPerActor: state.autoDrawPerActor,
            itemUsageLocked: state.itemUsageLocked,
        };
    }

    private applyRule(rule: EnvironmentRule, state: BattleRuleState) {
        switch (rule.type) {
            case 'DAMAGE_FLAT_MODIFIER': {
                const amount = Number(rule.metadata?.amount ?? 0);
                state.damage.flatModifier += amount;
                break;
            }
            case 'ITEM_USAGE_LOCK':
                state.itemUsageLocked = true;
                break;
            case 'TARGET_RANDOMIZE': {
                const values = Array.isArray(rule.metadata?.values)
                    ? (rule.metadata?.values as number[])
                    : [];
                if (values.length > 0) {
                    const pick = values[Math.floor(Math.random() * values.length)];
                    state.targetScoreOverride = pick;
                }
                break;
            }
            case 'ROUND_START_AUTO_DRAW': {
                const cards = Number(rule.metadata?.cardsPerActor ?? rule.metadata?.cards ?? 0);
                if (!Number.isNaN(cards)) {
                    state.autoDrawPerActor = cards;
                }
                break;
            }
            case 'SUDDEN_DEATH_THRESHOLD': {
                const threshold = Number(rule.metadata?.hpThreshold ?? rule.metadata?.value);
                if (!Number.isNaN(threshold)) {
                    state.suddenDeathThreshold = threshold;
                }
                break;
            }
            default:
                break;
        }
    }
}
