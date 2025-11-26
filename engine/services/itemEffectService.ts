import { Item, TurnOwner } from '../../common/types';
import { EffectRegistry } from '../effects/effectRegistry';

interface ItemEffectServiceDeps {
    effectRegistry: EffectRegistry;
}

export class ItemEffectService {
    constructor(private deps: ItemEffectServiceDeps) {}

    async applyItemEffects(item: Item, actor: TurnOwner) {
        if (!item.effects || item.effects.length === 0) return;
        await this.deps.effectRegistry.executeEffects(item.effects, {
            actor,
            source: {
                type: 'ITEM',
                id: item.id,
                label: item.name,
            },
            originItem: item,
            extra: {
                itemInstanceId: item.instanceId,
            },
        });
    }
}
