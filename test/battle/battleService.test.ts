import { describe, expect, it, vi } from 'vitest';
import { BattleService } from '@/engine/battle/BattleService';
import { BattleContext } from '@/engine/battle/BattleContext';
import { STARTING_HP } from '@/common/constants';
import { createStoreBundle } from '@/test/services/serviceTestUtils';
import { createDefaultRoundResult } from '@/engine/state/results';
import { getRandomEnemy, createDeck } from '@/engine/utils';

const createBattleService = () => {
    const bundle = createStoreBundle();
    const battleService = new BattleService({
        store: bundle.store,
        eventBus: bundle.eventBus,
        getMetaState: bundle.getMetaState,
        rewardService: bundle.rewardService,
    });
    return { battleService, store: bundle.store };
};

const createContext = (): BattleContext => ({
    runLevel: 1,
    deck: createDeck(),
    environment: [],
    penalty: null,
    enemy: getRandomEnemy(1),
    playerHp: STARTING_HP,
    playerMaxHp: STARTING_HP,
    message: 'Test Battle',
});

describe('BattleService round result wiring', () => {
    it('collects IRoundResult entries from RoundService', () => {
        const { battleService } = createBattleService();
        battleService.startBattle(createContext());

        const sample = createDefaultRoundResult({
            roundNumber: 1,
            winner: 'PLAYER',
            playerScore: 20,
            enemyScore: 18,
        });

        const internal = battleService as unknown as { onRoundComplete(result: typeof sample): void };
        internal.onRoundComplete(sample);

        const history = battleService.getRoundResults();
        expect(history).toHaveLength(1);
        expect(history[0].winner).toBe('PLAYER');
        expect(history[0].roundNumber).toBe(1);
    });

    it('emits IBattleResult when battle ends', () => {
        const { battleService, store } = createBattleService();
        battleService.startBattle(createContext());
        const handler = vi.fn();
        battleService.setBattleResultHandler(handler);
        store.updateState(
            prev => ({
                ...prev,
                enemy: prev.enemy ? { ...prev.enemy, hp: 0 } : prev.enemy,
            }),
            { tag: 'test:killEnemy' }
        );
        const sample = createDefaultRoundResult({
            roundNumber: 1,
            winner: 'PLAYER',
            playerScore: 20,
            enemyScore: 18,
        });
        const internal = battleService as unknown as { onRoundComplete(result: typeof sample): void };
        internal.onRoundComplete(sample);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].winner).toBe('PLAYER');
    });
});
