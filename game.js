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
 * NOTE: dfa.reset() is intentionally NOT called here.
 * The DFA must remain in WIN / LOSE / PUSH so the SVG diagram
 * shows the terminal state after each round. The reset happens
 * at the top of gameDeal() before consuming the next DEAL symbol,
 * which is the correct place — the machine returns to q0 only when
 * the player actively starts a new round.
 */
function endRound() {
  balance = Math.max(0, balance);
  bet     = 0;
  updateBalanceDisplay();
  setButtons(true, false, false);  // re-enable Deal, disable Hit + Stand
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