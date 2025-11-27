import { Item, TurnOwner } from '../../../common/types';

export interface IItemService {
    applyItemEffects(item: Item, actor: TurnOwner): Promise<void>;
}
