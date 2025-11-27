import { MetaState, MetaUpdater, StoreUpdateMeta } from '../../../common/types';
import { GameStore } from '../../state/gameStore';
import { createInitialGameState } from '../../state/gameState';
import { EventBus } from '../../eventBus';
import { RewardService } from '../../battle/rewards/RewardService';
import { CreateMetaFn } from '../../round/RoundService';

const baseMeta: MetaState = {
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
};

export const createMetaState = (overrides: Partial<MetaState> = {}): MetaState => ({
    ...baseMeta,
    ...overrides,
    upgrades: {
        ...baseMeta.upgrades,
        ...overrides.upgrades,
    },
});

export const createStoreBundle = () => {
    let metaState = createMetaState();
    const getMetaState = () => metaState;
    const updateMetaState: MetaUpdater = updater => {
        metaState = updater(metaState);
    };
    const store = new GameStore(createInitialGameState(metaState));
    const eventBus = new EventBus();
    const rewardService = new RewardService({ store, eventBus, getMetaState, updateMetaState });
    const createMeta: CreateMetaFn = (
        tag: string,
        description: string,
        payload?: Record<string, unknown>,
        extra?: Partial<StoreUpdateMeta>
    ) => ({
        tag,
        description,
        payload,
        ...extra,
    });

    return { store, eventBus, rewardService, getMetaState, updateMetaState, createMeta };
};
