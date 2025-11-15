import { ActorStrategy } from '../blackjack/TurnController';
import { Participant } from '../blackjack/Participant';
import { AbilityCardDefinition, AbilityCardInstance } from '../cards/CardTypes';

let abilityInstanceCounter = 0;

const createAbilityInstanceId = (): string => {
  abilityInstanceCounter += 1;
  return `ability-${abilityInstanceCounter}`;
};

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
  private shield = 0;
  private readonly abilityCards: AbilityCardInstance[] = [];
  private baseAbilityDefinitions: AbilityCardDefinition[] = [];

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
    this.shield = 0;
    this.rebuildAbilityHand();
  }

  applyDamage(amount: number): number {
    const damage = Math.max(0, Math.floor(amount));
    let remaining = damage;

    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }

    this.hp = Math.max(0, this.hp - remaining);
    return remaining;
  }

  isDefeated(): boolean {
    return this.hp <= 0;
  }

  addShield(amount: number): void {
    this.shield += Math.max(0, Math.floor(amount));
  }

  getShield(): number {
    return this.shield;
  }

  setAbilityLoadout(definitions: AbilityCardDefinition[]): void {
    this.baseAbilityDefinitions = [...definitions];
    this.rebuildAbilityHand();
  }

  grantAbilityCard(definition: AbilityCardDefinition): AbilityCardInstance {
    const instance = {
      instanceId: createAbilityInstanceId(),
      definition
    };
    this.abilityCards.push(instance);
    return instance;
  }

  getAbilityCards(): readonly AbilityCardInstance[] {
    return this.abilityCards;
  }

  useAbilityCard(instanceId: string): AbilityCardInstance | undefined {
    const index = this.abilityCards.findIndex((card) => card.instanceId === instanceId);
    if (index === -1) {
      return undefined;
    }
    const [card] = this.abilityCards.splice(index, 1);
    return card;
  }

  returnAbilityCard(card: AbilityCardInstance): void {
    this.abilityCards.push(card);
  }

  clearAbilityCards(): void {
    this.abilityCards.length = 0;
    this.baseAbilityDefinitions = [];
  }

  private rebuildAbilityHand(): void {
    this.abilityCards.length = 0;
    for (const definition of this.baseAbilityDefinitions) {
      this.grantAbilityCard(definition);
    }
  }
}
