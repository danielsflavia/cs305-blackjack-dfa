# Blackjack DFA — CS305 Final Project

**Team Members:** Flavia Daniels, Trevor Nolan
**Course:** CS305 — Advanced Computing
**Topic:** Deterministic Finite Automata (DFA)

---

## What It Is

A fully playable **Blackjack game** where the entire game logic is driven by a **Deterministic Finite Automaton (DFA)**. Every player action (deal, hit, stand, bust, blackjack) is an input symbol fed into the automaton, which transitions between states deterministically.

The game includes:
- A **live DFA state diagram** that highlights the current state as you play
- A **DFA transition log** showing every `δ(state, symbol) → state` step in real time
- Full blackjack rules: natural 21, bust detection, dealer soft-17, 3:2 blackjack payout, push on tie
- Chip betting system with $1 / $5 / $25 / $100 chips

---

## The Automaton

Formally defined as a 5-tuple **M = (Q, Σ, δ, q0, F)**:

| Component | Value |
|-----------|-------|
| **Q** (states) | `IDLE`, `PLAYER_TURN`, `DEALER_TURN`, `WIN`, `LOSE`, `PUSH` |
| **Σ** (alphabet) | `DEAL`, `HIT`, `STAND`, `BUST`, `BLACKJACK`, `WIN`, `LOSE`, `PUSH` |
| **q0** (start state) | `IDLE` |
| **F** (accepting states) | `{ WIN, LOSE, PUSH }` |
| **δ** (transition function) | See table below |

### Transition Table δ: Q × Σ → Q

| Current State | Input Symbol | Next State |
|---------------|-------------|------------|
| `IDLE` | `DEAL` | `PLAYER_TURN` |
| `PLAYER_TURN` | `HIT` | `PLAYER_TURN` *(self-loop)* |
| `PLAYER_TURN` | `STAND` | `DEALER_TURN` |
| `PLAYER_TURN` | `BUST` | `LOSE` |
| `PLAYER_TURN` | `BLACKJACK` | `WIN` |
| `DEALER_TURN` | `WIN` | `WIN` |
| `DEALER_TURN` | `LOSE` | `LOSE` |
| `DEALER_TURN` | `PUSH` | `PUSH` |

---

## How to Run

This is a **zero-dependency, single-file web app**. No install, no build step.

### Option 1 — Just open the file (simplest)
```bash
# Clone the repo
git clone https://github.com/danielsflavia/cs305-blackjack-dfa.git
cd cs305-blackjack-dfa

# Open directly in your browser
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

### Option 2 — VS Code Live Server (recommended for development)
```bash
# 1. Clone and open in VS Code
git clone https://github.com/danielsflavia/cs305-blackjack-dfa.git
cd cs305-blackjack-dfa
code .

# 2. Install the Live Server extension in VS Code:
#    Extensions panel → search "Live Server" → Install (by Ritwick Dey)

# 3. Right-click index.html → "Open with Live Server"
#    Game opens at http://127.0.0.1:5500
```

### Option 3 — Python local server
```bash
git clone https://github.com/danielsflavia/cs305-blackjack-dfa.git
cd cs305-blackjack-dfa

# Python 3
python3 -m http.server 8080

# Then open: http://localhost:8080
```

### Option 4 — Node.js local server
```bash
git clone https://github.com/danielsflavia/cs305-blackjack-dfa.git
cd cs305-blackjack-dfa

npx serve .
# Then open the URL it prints (usually http://localhost:3000)
```

---

## Project Structure

```
cs305-blackjack-dfa/
├── index.html          ← Entire game (HTML + CSS + JS, self-contained)
├── README.md           ← This file
```

---

## How to Play

1. Click chip buttons (`$1` `$5` `$25` `$100`) to place your bet
2. Click **Deal** — watch the DFA diagram jump from `IDLE` → `PLAYER_TURN`
3. Click **Hit** to draw a card (self-loop on `PLAYER_TURN`)
4. Click **Stand** to let the dealer play (`PLAYER_TURN` → `DEALER_TURN`)
5. The dealer plays automatically, then the DFA moves to `WIN`, `LOSE`, or `PUSH`
6. Watch the **transition log** to see every `δ(state, symbol) → state` step

---

## GitHub Pages (optional — play online)

Push to GitHub and enable GitHub Pages to host it live:

```
Repo Settings → Pages → Source: main branch → / (root) → Save
```

Your game will be live at: `https://github.com/danielsflavia/cs305-blackjack-dfa.git`
