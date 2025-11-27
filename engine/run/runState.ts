import { GamePhase, Item } from '../../common/types';

export interface RunState {
    phase: GamePhase;
    runLevel: number;
    message: string;
    rewardOptions: Item[];
    pickedRewardIndices: number[];
    goldEarnedThisLevel: number;
}
