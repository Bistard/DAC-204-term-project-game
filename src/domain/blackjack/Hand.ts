import { Card } from './Card';

export class Hand {
  private readonly cards: Card[] = [];

  addCard(card: Card): void {
    this.cards.push(card);
  }

  clear(): void {
    this.cards.length = 0;
  }

  getCards(): readonly Card[] {
    return this.cards;
  }

  getCard(index: number): Card | undefined {
    return this.cards[index];
  }

  setCard(index: number, card: Card): void {
    if (!this.cards[index]) {
      throw new Error(`No card at index ${index}`);
    }
    this.cards[index] = card;
  }

  swapFirstCard(other: Hand): void {
    const own = this.cards[0];
    const theirs = other.cards[0];

    if (!own || !theirs) {
      throw new Error('Cannot swap first card when one hand is empty.');
    }

    this.cards[0] = theirs;
    other.cards[0] = own;
  }
}
