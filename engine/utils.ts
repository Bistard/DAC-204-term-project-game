
import { Card, Suit, Item, Enemy, EnvironmentCard } from '../types';
import { ITEMS } from '../content/items';
import { ENEMIES } from '../content/enemies';
import { ENVIRONMENT_CARDS } from '../content/environments';
import { ACE_VALUE, ACE_ADJUSTMENT, HP_SCALING_PER_LEVEL, MAX_INVENTORY_SLOTS } from '../constants';

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const calculateScore = (hand: Card[], target: number = 21): number => {
    let score = 0;
    let aces = 0;
    hand.forEach(card => {
        score += card.value;
        if (card.isAce) aces += 1;
    });
    // Reduce aces from 11 to 1 if over target
    while (score > target && aces > 0) {
        score -= ACE_ADJUSTMENT;
        aces -= 1; 
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

export const getRandomItems = (count: number): Item[] => {
    const items: Item[] = [];
    for (let i = 0; i < count; i++) {
        items.push(ITEMS[Math.floor(Math.random() * ITEMS.length)]);
    }
    return items;
};

export const getRandomEnvironment = (count: number): EnvironmentCard[] => {
    const shuffled = [...ENVIRONMENT_CARDS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

export const getRandomEnemy = (level: number): Enemy => {
    const available = ENEMIES.filter(e => 
        level > 5 ? true : e.difficulty <= Math.ceil(level / 2)
    );
    const template = available[Math.floor(Math.random() * available.length)];
    
    // Dynamic HP scaling based on level
    const hpScale = Math.floor((level - 1) * HP_SCALING_PER_LEVEL); 
    
    return {
        ...template,
        id: `${template.id}-${Date.now()}`,
        hp: template.hp + hpScale,
        maxHp: template.maxHp + hpScale,
        inventory: [], 
        hand: [],
        score: 0,
        maxInventory: MAX_INVENTORY_SLOTS,
    };
};