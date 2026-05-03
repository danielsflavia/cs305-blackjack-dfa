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