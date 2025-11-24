import { DELAY_XL } from '../../common/constants';
import { GameStore } from '../state/gameStore';
import { calculateScore } from '../utils';
import { CreateMetaFn } from './roundService';

interface AiServiceDeps {
    store: GameStore;
    createMeta: CreateMetaFn;
    onHit: () => Promise<void>;
    onStand: () => void;
}

export class AiService {
    private aiTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private deps: AiServiceDeps) {}

    queueTurn() {
        this.clearTimer();
        this.deps.store.updateFlags(
            flags => ({ ...flags, isProcessingAI: true }),
            this.deps.createMeta('flag.ai', 'Start AI processing', undefined, { suppressHistory: true })
        );
        const scheduler = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
        this.aiTimer = scheduler(async () => {
            await this.takeTurn();
            this.deps.store.updateFlags(
                flags => ({ ...flags, isProcessingAI: false }),
                this.deps.createMeta('flag.ai', 'AI turn completed', undefined, { suppressHistory: true })
            );
            this.aiTimer = null;
        }, DELAY_XL);
    }

    cancelProcessing() {
        this.clearTimer();
        this.deps.store.updateFlags(
            flags => ({ ...flags, isProcessingAI: false }),
            this.deps.createMeta('flag.ai', 'Stop AI processing', undefined, { suppressHistory: true })
        );
    }

    private async takeTurn() {
        const snapshot = this.deps.store.snapshot;
        const enemy = snapshot.state.enemy;
        if (!enemy) return;
        const trueScore = calculateScore(enemy.hand, snapshot.state.targetScore);
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
                shouldHit = trueScore < snapshot.state.targetScore - 6 ? true : Math.random() > 0.5;
                break;
        }
        if (trueScore >= snapshot.state.targetScore) shouldHit = false;
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
