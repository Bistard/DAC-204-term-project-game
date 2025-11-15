import { AbilityCardType } from '../cards/CardTypes';
import { HandScore } from './BlackjackRules';
import { Participant } from './Participant';

const DEFAULT_TARGET = 21;

type BlockedMap = Record<Participant, Set<AbilityCardType>>;

export type RuleModifierSnapshot = {
  targetLimit: number;
  blockedCardTypes: Record<Participant, AbilityCardType[]>;
};

export class RoundModifierState {
  private targetLimit = DEFAULT_TARGET;
  private readonly totalOffsets = new Map<Participant, number>();
  private readonly totalOverrides = new Map<Participant, number | null>();
  private readonly blockedTypes: BlockedMap = {
    player: new Set(),
    enemy: new Set()
  };

  reset(): void {
    this.targetLimit = DEFAULT_TARGET;
    this.totalOffsets.clear();
    this.totalOverrides.clear();
    this.blockedTypes.player.clear();
    this.blockedTypes.enemy.clear();
  }

  getTargetLimit(): number {
    return this.targetLimit;
  }

  setTargetLimit(value: number): void {
    this.targetLimit = Math.max(1, value);
  }

  adjustTotal(participant: Participant, delta: number): void {
    const next = (this.totalOffsets.get(participant) ?? 0) + delta;
    this.totalOffsets.set(participant, next);
  }

  setTotalOverride(participant: Participant, value: number | null): void {
    if (value === null) {
      this.totalOverrides.delete(participant);
    } else {
      this.totalOverrides.set(participant, value);
    }
  }

  applyToScore(participant: Participant, baseScore: HandScore): HandScore {
    let total = baseScore.total + (this.totalOffsets.get(participant) ?? 0);
    const override = this.totalOverrides.get(participant);
    if (typeof override === 'number') {
      total = override;
    }

    const soft = baseScore.soft;
    const busted = total > this.targetLimit;
    return {
      total,
      soft,
      busted
    };
  }

  blockCardType(participant: Participant, type: AbilityCardType): void {
    this.blockedTypes[participant].add(type);
  }

  unblockCardType(participant: Participant, type: AbilityCardType): void {
    this.blockedTypes[participant].delete(type);
  }

  isCardTypeBlocked(participant: Participant, type: AbilityCardType): boolean {
    return this.blockedTypes[participant].has(type);
  }

  getSnapshot(): RuleModifierSnapshot {
    return {
      targetLimit: this.targetLimit,
      blockedCardTypes: {
        player: [...this.blockedTypes.player],
        enemy: [...this.blockedTypes.enemy]
      }
    };
  }
}
