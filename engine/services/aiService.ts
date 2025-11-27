import { DELAY_XL } from '../../common/constants';
import { StoreUpdateMeta, TurnOwner, Enemy, EnvironmentRuntimeState } from '../../common/types';
import { calculateScore } from '../utils';
import { CreateMetaFn } from '../round/RoundService';

interface AiBattleView {
    turnOwner: TurnOwner;
    enemy: Enemy | null;
    targetScore: number;
    environmentRuntime: EnvironmentRuntimeState;
}

interface AiServiceDeps {
    getBattleView: () => AiBattleView;
    updateProcessingFlag: (value: boolean, meta: StoreUpdateMeta) => void;
    createMeta: CreateMetaFn;
    onHit: () => Promise<void>;
    onStand: () => void;
}

export class AiService {
    private aiTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private deps: AiServiceDeps) {}

    queueTurn() {
        this.clearTimer();
        this.deps.updateProcessingFlag(
            true,
            this.deps.createMeta('flag.ai', 'Start AI processing', undefined, { suppressHistory: true })
        );
        const scheduler = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
        this.aiTimer = scheduler(async () => {
            await this.takeTurn();
            this.deps.updateProcessingFlag(
                false,
                this.deps.createMeta('flag.ai', 'AI turn completed', undefined, { suppressHistory: true })
            );
            this.aiTimer = null;
        }, DELAY_XL);
    }

    cancelProcessing() {
        this.clearTimer();
        this.deps.updateProcessingFlag(
            false,
            this.deps.createMeta('flag.ai', 'Stop AI processing', undefined, { suppressHistory: true })
        );
    }

    private async takeTurn() {
        const snapshot = this.deps.getBattleView();
        const enemy = snapshot.enemy;
        if (!enemy) return;
        const scoreOptions = snapshot.environmentRuntime.scoreOptions;
        const trueScore = calculateScore(enemy.hand, snapshot.targetScore, scoreOptions);
        let shouldHit = false;
        switch (enemy.aiType) {
            case 'GREEDY':
                shouldHit = trueScore < 18;
                break;
            case 'DEFENSIVE':
                shouldHit = trueScore < 16;
                break;
            case 'RANDOM':
            default:
                shouldHit = trueScore < snapshot.targetScore - 6 ? true : Math.random() > 0.5;
                break;
        }
        const wouldBust =
            trueScore >= snapshot.targetScore ||
            scoreOptions.specialBustValues.includes(trueScore);
        if (wouldBust) shouldHit = false;
        if (shouldHit) await this.deps.onHit();
        else this.deps.onStand();
    }

    private clearTimer() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
    }
}
