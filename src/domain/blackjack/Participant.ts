export type Participant = 'player' | 'enemy';

export const getOpponent = (participant: Participant): Participant =>
  participant === 'player' ? 'enemy' : 'player';
