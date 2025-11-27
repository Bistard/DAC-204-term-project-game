import { describe, expect, it } from 'vitest';
import { Item, ItemType, TurnOwner } from '../../../common/types';
import { createStoreBundle } from './serviceTestUtils';
import { RoundService } from '../../round/RoundService';
import { ItemEffectService } from '../../round/items/ItemService';

const createItemEffectService = () => {
    const bundle = createStoreBundle();
    const roundService = new RoundService({
        store: bundle.store,
        eventBus: bundle.eventBus,
        getMetaState: bundle.getMetaState,
        rewardService: bundle.rewardService,
        createMeta: bundle.createMeta,
        onRoundReady: () => {},
    });
    const service = new ItemEffectService({
        roundService,
    });
    return { ...bundle, service };
};

const createBoostItem = (): Item => ({
    id: 'boost',
    name: 'Boost',
    description: 'Round damage boost',
    type: ItemType.CONSUMABLE,
    effects: [
        {
            type: 'RESOLUTION_DAMAGE_BOOST',
            amount: 3,
        },
    ],
    instanceId: 'boost-1',
});

describe('ItemEffectService smoke tests', () => {
    it('applies resolution damage boosts', async () => {
        const { service, store } = createItemEffectService();
        await service.applyItemEffects(createBoostItem(), 'PLAYER');

        const modifiers = store.snapshot.state.roundModifiers.damageAdjustments;
        expect(modifiers.PLAYER).toBe(3);
    });
});
