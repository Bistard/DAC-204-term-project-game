
import {
    Card,
    Suit,
    Item,
    Enemy,
    EnvironmentCard,
    ItemDefinition,
    EnemyTemplate,
    GameState,
    PenaltyCard,
    ScoreOptions,
} from '../common/types';
import { ITEM_DEFINITIONS, PRECISION_PULL_VALUES, TARGET_OVERRIDE_VALUES } from '../content/items';
import { ENEMY_TEMPLATES } from '../content/enemies';
import { ENVIRONMENT_CARDS } from '../content/environments';
import { PENALTY_CARDS } from '../content/penalties';
import { ACE_VALUE, ACE_ADJUSTMENT, HP_SCALING_PER_LEVEL, MAX_INVENTORY_SLOTS, TARGET_SCORE } from '../common/constants';
import { buildEnvironmentRuntime } from './battle/rules/environmentRuleEngine';

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const calculateScore = (hand: Card[], target: number = TARGET_SCORE, options?: ScoreOptions): number => {
    let score = 0;
    let aces = 0;
    hand.forEach(card => {
        score += card.value;
        if (card.isAce) aces += 1;
    });
    const aceMode = options?.aceMode ?? 'FLEXIBLE';
    if (aceMode !== 'ALWAYS_HIGH') {
        // Reduce aces from 11 to 1 if over target
        while (score > target && aces > 0) {
            score -= ACE_ADJUSTMENT;
            aces -= 1;
        }
    }
    return score;
};

export const createDeck = (): Card[] => {
  const suit = Suit.Spades;
  // Modified deck: 1-10 + Ace. Removed J, Q, K. Total 11 cards.
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  const deck: Card[] = [];

  ranks.forEach((rank) => {
    let value = parseInt(rank);
    if (rank === 'A') value = ACE_VALUE;

    deck.push({
      suit,
      rank,
      value,
      id: `${suit}-${rank}-${Math.random()}`,
      isFaceUp: true,
      isAce: rank === 'A',
    });
  });

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};

type ItemInstanceOverrides = Pick<ItemDefinition, 'name' | 'description' | 'effects'>;

const pickRandomValue = <T>(collection: readonly T[]): T => {
    return collection[Math.floor(Math.random() * collection.length)];
};

const dynamicItemOverrides: Record<string, () => ItemInstanceOverrides> = {
    precision_pull: () => {
        const choice = pickRandomValue(PRECISION_PULL_VALUES);
        return {
            name: `Precision Pull (${choice.label})`,
            description: `Attempt to draw a ${choice.label}.`,
            effects: [
                {
                    type: 'DRAW_VALUE',
                    metadata: { targetValue: choice.value },
                },
            ],
        };
    },
    target_override: () => {
        const value = pickRandomValue(TARGET_OVERRIDE_VALUES);
        return {
            name: `Target Override ${value}`,
            description: `This round only, set the victory target to ${value}.`,
            effects: [
                {
                    type: 'SET_TEMP_TARGET_SCORE',
                    amount: value,
                },
            ],
        };
    },
};

const instantiateItem = (definition: ItemDefinition): Item => {
    const overridesFactory = dynamicItemOverrides[definition.id];
    const overrides = overridesFactory ? overridesFactory() : null;
    return {
        ...definition,
        ...(overrides ?? {}),
        instanceId: `${definition.id}-${Math.random().toString(36).substring(2, 8)}`,
    };
};

const ITEM_DEFINITION_MAP = new Map(ITEM_DEFINITIONS.map(def => [def.id, def]));

const pickRandomTemplate = <T>(templates: T[]): T => {
    return templates[Math.floor(Math.random() * templates.length)];
};

export const getRandomItems = (count: number): Item[] => {
    const items: Item[] = [];
    for (let i = 0; i < count; i++) {
        const template = pickRandomTemplate<ItemDefinition>(ITEM_DEFINITIONS);
        items.push(instantiateItem(template));
    }
    return items;
};

export const createItemById = (id: string): Item | null => {
    const template = ITEM_DEFINITION_MAP.get(id);
    if (!template) return null;
    return instantiateItem(template);
};

const areEnvironmentCardsCompatible = (a: EnvironmentCard, b: EnvironmentCard) => {
    const aConflicts = a.incompatibleWith ?? [];
    const bConflicts = b.incompatibleWith ?? [];
    return !aConflicts.includes(b.id) && !bConflicts.includes(a.id);
};

export const getRandomEnvironment = (count: number): EnvironmentCard[] => {
    if (count <= 0) return [];
    const pool = [...ENVIRONMENT_CARDS];
    let bestSelection: EnvironmentCard[] = [];
    const MAX_ATTEMPTS = 50;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const pick: EnvironmentCard[] = [];
        for (const card of shuffled) {
            if (pick.length >= count) break;
            const compatible = pick.every(existing => areEnvironmentCardsCompatible(existing, card));
            if (compatible) {
                pick.push(card);
            }
        }
        if (pick.length === count) {
            return pick;
        }
        if (pick.length > bestSelection.length) {
            bestSelection = pick;
        }
    }

    return bestSelection;
};

export const getRandomPenaltyCard = (): PenaltyCard => {
    return pickRandomTemplate<PenaltyCard>(PENALTY_CARDS);
};

export const getRandomEnemy = (level: number): Enemy => {
    const eligible = ENEMY_TEMPLATES.filter(template =>
        level > 5 ? true : template.difficulty <= Math.ceil(level / 2)
    );
    const template = pickRandomTemplate<EnemyTemplate>(eligible.length ? eligible : ENEMY_TEMPLATES);
    
    // Dynamic HP scaling based on level
    const hpScale = Math.floor((level - 1) * HP_SCALING_PER_LEVEL); 
    
    return {
        id: `${template.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        templateId: template.id,
        name: template.name,
        description: template.description,
        difficulty: template.difficulty,
        aiType: template.aiProfile,
        hp: template.baseHp + hpScale,
        maxHp: template.baseHp + hpScale,
        shield: template.baseShield ?? 0,
        hand: [],
        score: 0,
        inventory: [],
        maxInventory: template.maxInventory ?? MAX_INVENTORY_SLOTS,
    };
};

/**
 * Apply persistent environment card effects onto the provided state snapshot.
 * Currently only adjusts the target score, but centralized here so both
 * CombatService and RewardService can stay in sync.
 */
export const applyEnvironmentRules = (state: GameState): GameState => {
    const runtime = buildEnvironmentRuntime(state.activeEnvironment ?? []);
    const targetScore = runtime.targetRule?.value ?? TARGET_SCORE;
    return {
        ...state,
        baseTargetScore: targetScore,
        targetScore,
        environmentRuntime: runtime,
    };
};
