import { describe, expect, it } from 'vitest';
import { GamePhase, GameEvent } from '../../../common/types';
import { createStoreBundle } from './serviceTestUtils';
import { CombatService } from '../combatService';

const createCombatService = () => {
    const bundle = createStoreBundle();
    const combatService = new CombatService({
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
    return { ...bundle, combatService };
};

describe('CombatService smoke tests', () => {
    it('handles stand transitions and emits events', () => {
        const events: GameEvent[] = [];
        const { combatService, eventBus, store } = createCombatService();
        eventBus.subscribe(event => events.push(event));

        combatService.stand('PLAYER');

        const snapshot = store.snapshot.state;
        expect(snapshot.playerStood).toBe(true);
        expect(snapshot.turnOwner).toBe('ENEMY');
        expect(events.some(evt => evt.type === 'hand.action')).toBe(true);
    });
});
