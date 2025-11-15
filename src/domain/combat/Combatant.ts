import { ActorStrategy } from '../blackjack/TurnController';
import { Participant } from '../blackjack/Participant';

export type CombatantProps = {
  id: Participant;
  name: string;
  maxHp: number;
  baseAttack: number;
  strategy: ActorStrategy;
};

export class Combatant {
  readonly id: Participant;
  readonly name: string;
  readonly maxHp: number;
  readonly baseAttack: number;
  readonly strategy: ActorStrategy;

  private hp: number;

  constructor(props: CombatantProps) {
    this.id = props.id;
    this.name = props.name;
    this.maxHp = props.maxHp;
    this.baseAttack = props.baseAttack;
    this.strategy = props.strategy;
    this.hp = props.maxHp;
  }

  get currentHp(): number {
    return this.hp;
  }

  reset(): void {
    this.hp = this.maxHp;
  }

  applyDamage(amount: number): number {
    const damage = Math.max(0, Math.floor(amount));
    this.hp = Math.max(0, this.hp - damage);
    return damage;
  }

  isDefeated(): boolean {
    return this.hp <= 0;
  }
}
