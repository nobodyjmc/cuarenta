import { cardSvg } from './cards.js';

export const COVER_CARDS = cardSvg({ rank: 'K', suit: 'clubs' })
  + cardSvg({ rank: 'A', suit: 'hearts' });
