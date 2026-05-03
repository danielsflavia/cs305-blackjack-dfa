/*
 * ════════════════════════════════════════════════════════════════════
 *  CS305 Final Project — Blackjack DFA
 *  Main script file — includes all modules
 * ════════════════════════════════════════════════════════════════════
 */

/* ─── 1. DFA DEFINITION ─────────────────────────────────────────── */

// Q — the finite set of states
const STATES = {
  IDLE:        'IDLE',
  PLAYER_TURN: 'PLAYER_TURN',
  DEALER_TURN: 'DEALER_TURN',
  WIN:         'WIN',
  LOSE:        'LOSE',
  PUSH:        'PUSH',
};

// Σ — the input alphabet (every symbol the automaton can receive)
const INPUT = {
  DEAL:      'DEAL',
  HIT:       'HIT',
  STAND:     'STAND',
  BUST:      'BUST',
  BLACKJACK: 'BLACKJACK',
  WIN:       'WIN',
  LOSE:      'LOSE',
  PUSH:      'PUSH',
};

// F — the set of accepting states (game over when we reach one of these)
const ACCEPTING = new Set([STATES.WIN, STATES.LOSE, STATES.PUSH]);

/*
 * δ — the transition function: δ(currentState, inputSymbol) → nextState
 *
 * Stored as a nested lookup table (transition table).
 * Any (state, symbol) pair not listed here is an undefined / rejected
 * transition — the machine does not move and logs a warning.
 *
 * This is the heart of the DFA: every legal input maps to exactly one
 * next state. No ambiguity, no non-determinism.
 */
const TRANSITIONS = {
  [STATES.IDLE]: {
    [INPUT.DEAL]:      STATES.PLAYER_TURN,  // cards dealt → player's turn begins
  },
  [STATES.PLAYER_TURN]: {
    [INPUT.HIT]:       STATES.PLAYER_TURN,  // draw a card → self-loop, still player's turn
    [INPUT.STAND]:     STATES.DEALER_TURN,  // player done → dealer plays
    [INPUT.BUST]:      STATES.LOSE,         // player exceeded 21 → immediate loss
    [INPUT.BLACKJACK]: STATES.WIN,          // natural 21 on first two cards → instant win
  },
  [STATES.DEALER_TURN]: {
    [INPUT.WIN]:  STATES.WIN,               // player's total beats dealer → win
    [INPUT.LOSE]: STATES.LOSE,              // dealer's total beats player → loss
    [INPUT.PUSH]: STATES.PUSH,             // totals are equal → tie
  },
  // Accepting states { WIN, LOSE, PUSH } have NO outgoing transitions.
  // The machine halts here. endRound() calls dfa.reset() → q0 to start fresh.
};

/*
 * transition(state, symbol) → nextState | null
 *
 * Pure implementation of δ.
 * Returns null when the (state, symbol) pair is not in the table.
 */
function transition(state, symbol) {
  return (TRANSITIONS[state] && TRANSITIONS[state][symbol]) || null;
}

/* ─── 2. DFA RUNTIME MACHINE ────────────────────────────────────── */

/*
 * dfa — the live automaton instance.
 *
 * Tracks the current state q and exposes three operations:
 *   read(symbol)   — consume one symbol, fire a transition
 *   isAccepting()  — check if q ∈ F
 *   reset()        — return to q0
 */
const dfa = {
  q: STATES.IDLE,  // current state q, initialised to q0

  /*
   * read(symbol) — the core DFA operation.
   *
   * Looks up δ(q, symbol), advances q, logs the transition,
   * and updates the SVG diagram.
   *
   * Returns true on a valid transition, false if rejected.
   */
  read(symbol) {
    const next = transition(this.q, symbol);
    if (!next) {
      // Undefined transition — should never occur in well-formed gameplay
      console.warn(`DFA: no transition from ${this.q} on symbol '${symbol}'`);
      return false;
    }
    logTransition(this.q, symbol, next);  // record δ(q, symbol) → next in the UI log
    this.q = next;
    updateDFADisplay(next);               // move the animated highlight to the new state
    return true;
  },

  // isAccepting() — returns true when q ∈ F (game-over condition)
  isAccepting() {
    return ACCEPTING.has(this.q);
  },

  /*
   * reset() — unconditionally returns the machine to q0 (IDLE).
   *
   * Called at the start of every new round by endRound().
   * This is what unblocks addBet() — bets are only allowed when q === IDLE.
   * Without this call, the machine stays stuck in WIN/LOSE/PUSH forever
   * and no chip clicks would register.
   */
  reset() {
    this.q = STATES.IDLE;
    updateDFADisplay(STATES.IDLE);
  },
};

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

/* ─── 4. GAME STATE ─────────────────────────────────────────────── */

let deck        = [];
let playerHand  = [];
let dealerHand  = [];
let balance     = 500;   // starting balance in dollars
let bet         = 0;     // current round bet
let dealerHides = true;  // true = hole card is face-down

/* ─── 5. GAME ACTIONS (DFA input symbols) ───────────────────────── */

/*
 * gameDeal() — fires INPUT.DEAL into the DFA: IDLE → PLAYER_TURN.
 *
 * Resets the machine to q0 first (in case the previous round ended
 * and the user dealt again without clearing), then deals two cards
 * each and checks for a natural blackjack.
 */
function gameDeal() {
  if (bet === 0)     { showMsg('Place a bet first!', '');     return; }
  if (bet > balance) { showMsg('Not enough balance.', 'lose'); return; }

  // Return machine to q0 before consuming DEAL
  dfa.reset();
  if (!dfa.read(INPUT.DEAL)) return;  // IDLE → PLAYER_TURN

  // Build a fresh shuffled deck and deal two cards each
  deck        = buildDeck();
  playerHand  = [deck.pop(), deck.pop()];
  dealerHand  = [deck.pop(), deck.pop()];
  dealerHides = true;

  renderHands();
  setButtons(false, true, true);  // disable Deal, enable Hit + Stand

  const pv = handValue(playerHand);

  // Natural blackjack: 21 on the opening two cards
  if (pv === 21) {
    dfa.read(INPUT.BLACKJACK);  // PLAYER_TURN → WIN
    revealDealer();
    const dv = handValue(dealerHand);
    if (dv === 21) {
      // Dealer also has blackjack — it's a push
      balance += bet;
      showMsg('Both Blackjack — Push!', 'push');
    } else {
      // Standard 3:2 blackjack payout
      balance += Math.floor(bet * 2.5);
      showMsg('Blackjack! You win 3:2!', 'win');
    }
    endRound();
    return;
  }

  showMsg(`Your total: ${pv}`, '');
}

/*
 * gameHit() — fires INPUT.HIT into the DFA.
 *
 * Self-loop: PLAYER_TURN → PLAYER_TURN.
 * If the player's total exceeds 21 after drawing, fires INPUT.BUST
 * instead, transitioning to the LOSE accepting state.
 */
function gameHit() {
  dfa.read(INPUT.HIT);  // self-loop on PLAYER_TURN

  playerHand.push(deck.pop());
  renderHands();

  const pv = handValue(playerHand);

  if (pv > 21) {
    dfa.read(INPUT.BUST);   // PLAYER_TURN → LOSE
    revealDealer();
    balance -= bet;
    showMsg(`Bust! You had ${pv}. Dealer wins.`, 'lose');
    endRound();
  } else {
    showMsg(`Your total: ${pv}`, '');
  }
}

/*
 * gameStand() — fires INPUT.STAND into the DFA: PLAYER_TURN → DEALER_TURN.
 *
 * The dealer then plays automatically: hits on ≤ 16, stands on 17+
 * (standard Las Vegas casino rules). Once the dealer is done, we
 * compare totals and fire the appropriate result symbol into the DFA
 * to reach a terminal accepting state.
 */
function gameStand() {
  dfa.read(INPUT.STAND);   // PLAYER_TURN → DEALER_TURN

  revealDealer();

  // Dealer must hit on soft 16 or less
  while (handValue(dealerHand) < 17) {
    dealerHand.push(deck.pop());
  }
  renderHands();

  const pv = handValue(playerHand);
  const dv = handValue(dealerHand);

  // Resolve the round — each branch fires one symbol into the DFA
  if (dv > 21 || pv > dv) {
    dfa.read(INPUT.WIN);   // DEALER_TURN → WIN
    balance += bet * 2;    // return original bet + equal profit
    showMsg(`You win! ${pv} vs dealer ${dv}.`, 'win');
  } else if (dv > pv) {
    dfa.read(INPUT.LOSE);  // DEALER_TURN → LOSE
    balance -= bet;
    showMsg(`Dealer wins. ${dv} vs your ${pv}.`, 'lose');
  } else {
    dfa.read(INPUT.PUSH);  // DEALER_TURN → PUSH
    balance += bet;         // return original bet, no profit
    showMsg(`Push — tie at ${pv}.`, 'push');
  }

  endRound();
}

/*
 * endRound() — cleanup after the DFA reaches any accepting state in F.
 *
 * THE CRITICAL FIX IS HERE: dfa.reset() returns the machine to q0.
 *
 * Without dfa.reset(), the machine stays in WIN / LOSE / PUSH.
 * addBet() guards with (dfa.q !== STATES.IDLE) — so every chip click
 * is silently blocked, and the player can never bet again.
 *
 * With dfa.reset(), q returns to IDLE, chips work, and the player
 * can start a new round normally.
 */
function endRound() {
  balance = Math.max(0, balance);
  bet     = 0;
  updateBalanceDisplay();
  setButtons(true, false, false);  // re-enable Deal, disable Hit + Stand

  // ← THE FIX: reset DFA to q0 so betting is unblocked for the next round
  dfa.reset();
}

/* ─── 6. BETTING ────────────────────────────────────────────────── */

/*
 * addBet(amount) — add chips to the current bet.
 *
 * Guarded by (dfa.q === STATES.IDLE): bets are only legal before a round
 * starts. This is enforced by the automaton's current state, not a
 * separate boolean flag — the DFA itself controls game flow.
 */
function addBet(amount) {
  if (dfa.q !== STATES.IDLE) return;  // DFA not in start state — reject input
  if (bet + amount > balance) { showMsg('Not enough chips!', 'lose'); return; }
  bet += amount;
  updateBalanceDisplay();
}

function clearBet() {
  if (dfa.q !== STATES.IDLE) return;
  bet = 0;
  updateBalanceDisplay();
}

/* ─── 7. RENDERING ──────────────────────────────────────────────── */

function renderCard(card, hidden) {
  const el = document.createElement('div');
  el.className = 'card'
    + (RED_SUITS.has(card.suit) ? ' red' : '')
    + (hidden ? ' hidden' : '');

  if (hidden) {
    el.innerHTML = `<div class="card-top"></div><div class="card-center"></div><div class="card-bot"></div>`;
  } else {
    el.innerHTML = `
      <div class="card-top"><span>${card.rank}</span><span>${card.suit}</span></div>
      <div class="card-center">${card.suit}</div>
      <div class="card-bot"><span>${card.rank}</span><span>${card.suit}</span></div>`;
  }
  return el;
}

function renderHands() {
  const ph = document.getElementById('player-hand');
  const dh = document.getElementById('dealer-hand');
  ph.innerHTML = '';
  dh.innerHTML = '';

  playerHand.forEach(c => ph.appendChild(renderCard(c, false)));
  // Dealer's second card (index 1) is hidden until dealerHides is false
  dealerHand.forEach((c, i) => dh.appendChild(renderCard(c, i === 1 && dealerHides)));

  document.getElementById('player-score').textContent =
    `Total: ${handValue(playerHand)}`;
  document.getElementById('dealer-score').textContent =
    dealerHides
      ? `Showing: ${cardValue(dealerHand[0])}`
      : `Total: ${handValue(dealerHand)}`;
}

function revealDealer() {
  dealerHides = false;
  renderHands();
}

function updateBalanceDisplay() {
  document.getElementById('balance-val').textContent = `$${balance}`;
  document.getElementById('bet-val').textContent     = `Bet: $${bet}`;
}

function setButtons(deal, hit, stand) {
  document.getElementById('btn-deal').disabled  = !deal;
  document.getElementById('btn-hit').disabled   = !hit;
  document.getElementById('btn-stand').disabled = !stand;
}

function showMsg(text, type) {
  const el = document.getElementById('msg-box');
  el.textContent = text;
  el.className   = type;
}

/* ─── 8. DFA DISPLAY ────────────────────────────────────────────── */

/*
 * SVG bounding boxes for each state node.
 * updateDFADisplay() moves the animated highlight rect to whichever
 * node is currently active — giving a live visual trace of the DFA.
 */
const STATE_POS = {
  [STATES.IDLE]:        { x:4,   y:30, w:80,  h:36 },
  [STATES.PLAYER_TURN]: { x:130, y:30, w:100, h:36 },
  [STATES.DEALER_TURN]: { x:290, y:30, w:100, h:36 },
  [STATES.WIN]:         { x:450, y:10, w:72,  h:36 },
  [STATES.LOSE]:        { x:450, y:60, w:72,  h:36 },
  [STATES.PUSH]:        { x:570, y:35, w:72,  h:36 },
};

function updateDFADisplay(state) {
  const pos = STATE_POS[state];
  if (!pos) return;
  const hl = document.getElementById('dfa-highlight');
  hl.setAttribute('x',      pos.x);
  hl.setAttribute('y',      pos.y);
  hl.setAttribute('width',  pos.w);
  hl.setAttribute('height', pos.h);
}

/*
 * logTransition(from, symbol, to)
 *
 * Appends one entry to the on-screen DFA log in the format:
 *   δ(FROM_STATE, SYMBOL) → TO_STATE
 *
 * This gives the player/grader a readable trace of the automaton's
 * computation — exactly like the step-by-step traces done in class.
 */
function logTransition(from, symbol, to) {
  const list = document.getElementById('log-list');
  const span = document.createElement('span');
  // Highlight terminal transitions (those that land in an accepting state)
  span.className   = ACCEPTING.has(to) ? 'highlight' : '';
  span.textContent = `\u03B4(${from}, ${symbol}) \u2192 ${to}`;
  list.prepend(span);                                    // newest entry at top
  while (list.children.length > 30) list.removeChild(list.lastChild); // cap length
}

/* ─── 9. INIT ───────────────────────────────────────────────────── */
updateDFADisplay(STATES.IDLE);   // highlight q0 on load
updateBalanceDisplay();
setButtons(true, false, false);  // only Deal is active at start