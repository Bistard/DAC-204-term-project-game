import { TurnOwner } from '../../common/types';

/**
 * Facade for a single Battle lifecycle. Stage 2 only defines the contract;
 * implementations will arrive in later phases.
 */
export interface IBattleService {
    startRun(): void;
    startRound(): Promise<void> | void;
    hit(actor: TurnOwner): Promise<void> | void;
    stand(actor: TurnOwner): void;
    useItem(index: number, actor: TurnOwner): Promise<void> | void;
    evaluateFlow(): void;
}
