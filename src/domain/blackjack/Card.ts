export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Card = {
  rank: Rank;
  suit: Suit;
};

export const ALL_SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

export const ALL_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const getRankValue = (rank: Rank): number => {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return Number(rank);
};

export const createCard = (rank: Rank, suit: Suit): Card => ({ rank, suit });
