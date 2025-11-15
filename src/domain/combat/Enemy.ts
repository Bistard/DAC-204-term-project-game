import { Combatant } from './Combatant';
import { ActorStrategy } from '../blackjack/TurnController';

export type EnemyProps = {
  name: string;
  maxHp: number;
  baseAttack: number;
  description?: string;
  strategy: ActorStrategy;
};

export class Enemy extends Combatant {
  readonly description?: string;

  constructor({ name, maxHp, baseAttack, description, strategy }: EnemyProps) {
    super({
      id: 'enemy',
      name,
      maxHp,
      baseAttack,
      strategy
    });
    this.description = description;
  }

}
