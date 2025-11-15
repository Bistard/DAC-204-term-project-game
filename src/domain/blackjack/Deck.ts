import { ALL_RANKS, ALL_SUITS, Card, createCard } from './Card';

export class Deck {
  private readonly cards: Card[];

  constructor(cards?: Card[]) {
    this.cards = cards ? [...cards] : Deck.createStandardCardSet();
  }

  static standardShuffled(randomFn: () => number = Math.random): Deck {
    const deck = new Deck();
    deck.shuffle(randomFn);
    return deck;
  }

  static fromTopDown(cards: Card[]): Deck {
    return new Deck(cards);
  }

  shuffle(randomFn: () => number = Math.random): void {
    for (let i = this.cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(randomFn() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Card {
    const card = this.cards.shift();
    if (!card) {
      throw new Error('Deck is empty.');
    }
    return card;
  }

  remaining(): number {
    return this.cards.length;
  }

  private static createStandardCardSet(): Card[] {
    const cards: Card[] = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        cards.push(createCard(rank, suit));
      }
    }
    return cards;
  }
}
