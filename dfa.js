/*
 * ════════════════════════════════════════════════════════════════════
 *  CS305 Final Project — Blackjack DFA
 *  DFA DEFINITION AND RUNTIME
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

  // Pick glow color based on state type
  const glowColor =
    state === STATES.WIN         ? '#66bb6a' :
    state === STATES.LOSE        ? '#ef5350' :
    state === STATES.PUSH        ? '#80cbc4' :
    state === STATES.PLAYER_TURN ? '#f0d080' :
    state === STATES.DEALER_TURN ? '#f0d080' :
    '#c9a84c'; // IDLE

  hl.setAttribute('stroke', glowColor);

  // Remove active class from all state nodes first
  ['s-IDLE','s-PLAYER','s-DEALER','s-WIN','s-LOSE','s-PUSH'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('dfa-state-active');
  });

  // Map state name to SVG group id
  const stateToId = {
    [STATES.IDLE]:        's-IDLE',
    [STATES.PLAYER_TURN]: 's-PLAYER',
    [STATES.DEALER_TURN]: 's-DEALER',
    [STATES.WIN]:         's-WIN',
    [STATES.LOSE]:        's-LOSE',
    [STATES.PUSH]:        's-PUSH',
  };

  const activeEl = document.getElementById(stateToId[state]);
  if (activeEl) {
    // Remove and re-add to retrigger animation on self-loops (e.g. HIT)
    activeEl.classList.remove('dfa-state-active');
    void activeEl.offsetWidth;
    activeEl.classList.add('dfa-state-active');
  }
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