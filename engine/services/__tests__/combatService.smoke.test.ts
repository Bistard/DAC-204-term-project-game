import { describe, expect, it } from 'vitest';
import { GamePhase, GameEvent } from '../../../common/types';
import { createStoreBundle } from './serviceTestUtils';
import { BattleService } from '../../battle/BattleService';

const createBattleService = () => {
    const bundle = createStoreBundle();
    const battleService = new BattleService({
        store: bundle.store,
        eventBus: bundle.eventBus,
        getMetaState: bundle.getMetaState,
        rewardService: bundle.rewardService,
    });
    bundle.store.updateState(state => ({
        ...state,
        phase: GamePhase.BATTLE,
        turnOwner: 'PLAYER',
    }));
    return { ...bundle, battleService };
};

describe('BattleService smoke tests', () => {
    it('handles stand transitions and emits events', () => {
        const events: GameEvent[] = [];
        const { battleService, eventBus, store } = createBattleService();
        eventBus.subscribe(event => events.push(event));

        battleService.stand('PLAYER');

        const snapshot = store.snapshot.state;
        expect(snapshot.playerStood).toBe(true);
        expect(snapshot.turnOwner).toBe('ENEMY');
        expect(events.some(evt => evt.type === 'hand.action')).toBe(true);
    });
});
