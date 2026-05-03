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