import { BlackjackRules, HandScore } from './BlackjackRules';
import { Deck } from './Deck';
import { Hand } from './Hand';
import { Card } from './Card';
import { Participant, getOpponent } from './Participant';

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

  constructor(private deck: Deck = Deck.standardShuffled(), private readonly rules: BlackjackRules) {}

  start(deckOverride?: Deck): void {
    this.deck = deckOverride ?? Deck.standardShuffled();
    this.playerHand.clear();
    this.enemyHand.clear();
    this.playerState.stood = false;
    this.enemyState.stood = false;
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
    return this.rules.calculateScore(hand.getCards());
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
      score: this.rules.calculateScore(hand.getCards()),
      stood: this.getState(participant).stood
    };
  }

  private assertDeck(): void {
    if (!this.deck) {
      throw new Error('Deck is not initialised.');
    }
  }
}
