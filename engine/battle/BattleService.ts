import { CombatService } from '../services/combatService';
import { IBattleService } from './IBattleService';

/**
 * Temporary adapter that exposes the legacy CombatService through the new
 * IBattleService contract. Future phases will replace this with a dedicated
 * battle-layer implementation.
 */
export class BattleService extends CombatService implements IBattleService {}
