import { Combatant } from './Combatant';
import { ActorStrategy } from '../blackjack/TurnController';

type PlayerProps = {
  name?: string;
  maxHp?: number;
  baseAttack?: number;
  strategy: ActorStrategy;
};

const DEFAULTS = {
  name: 'Player',
  maxHp: 60,
  baseAttack: 10
};

export class Player extends Combatant {
  constructor({ name = DEFAULTS.name, maxHp = DEFAULTS.maxHp, baseAttack = DEFAULTS.baseAttack, strategy }: PlayerProps) {
    super({
      id: 'player',
      name,
      maxHp,
      baseAttack,
      strategy
    });
  }
}
