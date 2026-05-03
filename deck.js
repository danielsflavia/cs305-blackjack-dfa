/* ─── 3. DECK & CARD LOGIC ──────────────────────────────────────── */

const SUITS     = ['♠','♥','♦','♣'];
const RANKS     = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

/*
 * buildDeck() — constructs and shuffles a standard 52-card deck.
 * Uses the Fisher-Yates algorithm for a uniform random permutation.
 */
function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit });
  // Fisher-Yates shuffle: O(n), unbiased
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/*
 * cardValue(card) — point value of a single card.
 * Face cards = 10. Aces = 11 (handValue() will demote to 1 if needed).
 */
function cardValue(card) {
  if (['J','Q','K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11;
  return parseInt(card.rank, 10);
}

/*
 * handValue(hand) — best (highest non-busting) total for a hand.
 *
 * Aces start at 11. While the total exceeds 21 and there are aces
 * still counted as 11, demote one ace to 1 (subtract 10).
 * This is standard blackjack soft/hard hand resolution.
 */
function handValue(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    total += cardValue(c);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}