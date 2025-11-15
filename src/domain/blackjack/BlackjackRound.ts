import { BlackjackRules, HandScore } from './BlackjackRules';
import { Deck } from './Deck';
import { Hand } from './Hand';
import { Card, getRankValue } from './Card';
import { Participant, getOpponent } from './Participant';
import { RoundModifierState } from './RoundModifierState';

type ParticipantState = {
  stood: boolean;
};

export type HandView = {
  cards: readonly Card[];
  score: HandScore;
  stood: boolean;
};

export type RoundSnapshot = {
  player: HandView;
  enemy: HandView;
  deckRemaining: number;
};

export class BlackjackRound {
  private readonly playerHand = new Hand();
  private readonly enemyHand = new Hand();
  private readonly playerState: ParticipantState = { stood: false };
  private readonly enemyState: ParticipantState = { stood: false };
  private readonly modifiers = new RoundModifierState();

  constructor(private deck: Deck = Deck.standardShuffled(), private readonly rules: BlackjackRules) {}

  start(deckOverride?: Deck): void {
    this.deck = deckOverride ?? Deck.standardShuffled();
    this.playerHand.clear();
    this.enemyHand.clear();
    this.playerState.stood = false;
    this.enemyState.stood = false;
    this.modifiers.reset();
    this.dealOpeningHands();
  }

  hit(participant: Participant): void {
    this.assertDeck();
    const targetHand = this.getHand(participant);
    targetHand.addCard(this.deck.draw());
  }

  stand(participant: Participant): void {
    this.getState(participant).stood = true;
  }

  hasStood(participant: Participant): boolean {
    return this.getState(participant).stood;
  }

  getHandScore(participant: Participant): HandScore {
    const hand = this.getHand(participant);
    const base = this.rules.calculateScore(hand.getCards(), this.modifiers.getTargetLimit());
    return this.modifiers.applyToScore(participant, base);
  }

  isBust(participant: Participant): boolean {
    return this.getHandScore(participant).busted;
  }

  getSnapshot(): RoundSnapshot {
    return {
      player: this.getHandView('player'),
      enemy: this.getHandView('enemy'),
      deckRemaining: this.deck.remaining()
    };
  }

  getParticipantView(participant: Participant): { self: HandView; opponent: HandView; deckRemaining: number } {
    return {
      self: this.getHandView(participant),
      opponent: this.getHandView(getOpponent(participant)),
      deckRemaining: this.deck.remaining()
    };
  }

  getModifiers(): RoundModifierState {
    return this.modifiers;
  }

  convertHighestCardToAce(participant: Participant): boolean {
    const hand = this.getHand(participant);
    const cards = [...hand.getCards()];

    let targetIndex = -1;
    let highestValue = -1;

    cards.forEach((card, index) => {
      if (card.rank === 'A') {
        return;
      }
      const numeric = this.rules.calculateScore([card]).total;
      if (numeric > highestValue) {
        highestValue = numeric;
        targetIndex = index;
      }
    });

    if (targetIndex < 0) {
      return false;
    }

    const card = cards[targetIndex];
    hand.setCard(targetIndex, { ...card, rank: 'A' });
    return true;
  }

  peekUpcomingCards(count = 1): readonly Card[] {
    return this.deck.peek(count);
  }

  forceDraw(participant: Participant): void {
    this.getState(participant).stood = false;
    this.hit(participant);
  }

  swapFirstCards(): boolean {
    const playerFirst = this.playerHand.getCard(0);
    const enemyFirst = this.enemyHand.getCard(0);
    if (!playerFirst || !enemyFirst) {
      return false;
    }
    this.playerHand.swapFirstCard(this.enemyHand);
    return true;
  }

  downgradeHighestCard(participant: Participant): boolean {
    const hand = this.getHand(participant);
    const cards = [...hand.getCards()];
    if (cards.length === 0) {
      return false;
    }

    let targetIndex = 0;
    let highestValue = -Infinity;

    cards.forEach((card, index) => {
      const value = getRankValue(card.rank);
      if (value > highestValue) {
        highestValue = value;
        targetIndex = index;
      }
    });

    const targetCard = cards[targetIndex];
    hand.setCard(targetIndex, { ...targetCard, rank: '2' });
    return true;
  }

  private dealOpeningHands(): void {
    this.drawToHand('player');
    this.drawToHand('enemy');
    this.drawToHand('player');
    this.drawToHand('enemy');
  }

  private drawToHand(participant: Participant): void {
    const hand = this.getHand(participant);
    hand.addCard(this.deck.draw());
  }

  private getHand(participant: Participant): Hand {
    return participant === 'player' ? this.playerHand : this.enemyHand;
  }

  private getState(participant: Participant): ParticipantState {
    return participant === 'player' ? this.playerState : this.enemyState;
  }

  private getHandView(participant: Participant): HandView {
    const hand = this.getHand(participant);
    return {
      cards: [...hand.getCards()],
      score: this.getHandScore(participant),
      stood: this.getState(participant).stood
    };
  }

  private assertDeck(): void {
    if (!this.deck) {
      throw new Error('Deck is not initialised.');
    }
  }
}
