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
}
