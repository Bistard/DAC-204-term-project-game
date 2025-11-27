import { TurnOwner } from '../../common/types';
import { BattleContext } from './BattleContext';
import { IBattleResult, IRoundResult } from '../state/results';

/**
 * Facade for a single Battle lifecycle. Stage 2 only defines the contract;
 * implementations will arrive in later phases.
 */
export interface IBattleService {
    startBattle(context: BattleContext): void;
    startRound(): Promise<void> | void;
    hit(actor: TurnOwner): Promise<void> | void;
    stand(actor: TurnOwner): void;
    useItem(index: number, actor: TurnOwner): Promise<void> | void;
    evaluateFlow(): void;
    getRoundResults(): IRoundResult[];
    setBattleResultHandler(handler: (result: IBattleResult) => void): void;
}
