/* ===== CONSTANTS ===== */
const suitsOrder = [“S”, “H”, “D”, “C”];
const ranksOrder = [“2”, “3”, “4”, “5”, “6”, “7”, “8”, “9”, “10”, “J”, “Q”, “K”, “A”];
const suitSymbols = {S: “♠”, H: “♥”, D: “♦”, C: “♣”};
const nextPlayer = {A: “B”, B: “C”, C: “D”, D: “A”};

/* ===== STATE ===== */
let deck = [];
let hands = {A: [], B: [], C: [], D: []};
let bids = {A: 0, B: 0, C: 0, D: 0};
let tricksWon = {A: 0, B: 0, C: 0, D: 0};
let teamScore = {AC: 0, BD: 0};
let baselineAC = 0, baselineBD = 0;
let phase = “BIDDING”, turn = “A”, trick = [], leadSuit = null;
let spadesBroken = false;

/* ===== DOM ELEMENTS ===== */
const handA = document.getElementById(“handA”);
const handB = document.getElementById(“handB”);
const handC = document.getElementById(“handC”);
const handD = document.getElementById(“handD”);
const chat = document.getElementById(“chat”);
const submitBidBtn = document.getElementById(“submitBidBtn”);
const newGameBtn = document.getElementById(“newGameBtn”);
const continueBtn = document.getElementById(“continueBtn”);
const bidButtons = document.querySelectorAll(”.bid-btn”);

let selectedBid = null;

/* ===== EVENT LISTENERS ===== */
continueBtn.onclick = closeResult;
newGameBtn.onclick = startGame;

bidButtons.forEach(btn => {
btn.onclick = () => {
if (phase !== “BIDDING”) return;

```
bidButtons.forEach(b => b.classList.remove("selected"));
btn.classList.add("selected");
selectedBid = parseInt(btn.dataset.bid);
submitBidBtn.disabled = false;
```

};
});

submitBidBtn.onclick = () => {
if (selectedBid === null || phase !== “BIDDING”) return;

bids.A = selectedBid;
log(`👤 You bid ${selectedBid}`);

aiBid(“B”);
aiBid(“C”);
aiBid(“D”);

baselineAC = bids.A + bids.C;
baselineBD = bids.B + bids.D;

maybeDeclare();

phase = “PLAYING”;

bidButtons.forEach(btn => {
btn.disabled = true;
btn.classList.remove(“selected”);
});
submitBidBtn.disabled = true;

updatePlayableCards();

if (turn !== “A”) {
setTimeout(aiPlay, 1000);
}
};

/* ===== HELPER FUNCTIONS ===== */
const rankVal = r => ranksOrder.indexOf(r);

const playerPositions = {
A: () => handA.getBoundingClientRect(),
B: () => handB.getBoundingClientRect(),
C: () => handC.getBoundingClientRect(),
D: () => handD.getBoundingClientRect()
};

function log(msg) {
chat.innerHTML += `<div>${msg}</div>`;
chat.scrollTop = chat.scrollHeight;
}

function showThinking(p, show = true) {
const el = document.getElementById(“think” + p);
if (el) {
if (show) {
el.classList.add(“active”);
} else {
el.classList.remove(“active”);
}
}
}

/* ===== DECK FUNCTIONS ===== */
function createDeck() {
deck = [];
suitsOrder.forEach(s => ranksOrder.forEach(r => deck.push({suit: s, rank: r})));
}

const shuffle = () => deck.sort(() => Math.random() - 0.5);

function deal() {
hands = {A: [], B: [], C: [], D: []};
for (let i = 0; i < 52; i++) {
hands[[“A”, “B”, “C”, “D”][i % 4]].push(deck[i]);
}
sortHands();
renderHands();
}

function sortHands() {
Object.values(hands).forEach(h =>
h.sort((a, b) => a.suit !== b.suit
? suitsOrder.indexOf(a.suit) - suitsOrder.indexOf(b.suit)
: rankVal(a.rank) - rankVal(b.rank))
);
}

/* ===== RENDER FUNCTIONS ===== */
function cardEl(c) {
const d = document.createElement(“div”);
d.className = “card “ + ((c.suit === “H” || c.suit === “D”) ? “red” : “black”);
d.textContent = c.rank + suitSymbols[c.suit];
return d;
}

function animateCardPlay(player, card) {
const start = playerPositions[player]();
const slot = document.querySelector(`.slot[data-p="${player}"]`);
if (!slot) return cardEl(card);

const target = slot.getBoundingClientRect();
const c = cardEl(card);

c.classList.add(“fly”);
c.style.top = start.top + start.height / 2 + “px”;
c.style.left = start.left + start.width / 2 + “px”;
document.body.appendChild(c);

requestAnimationFrame(() => {
c.style.top = target.top + target.height / 2 + “px”;
c.style.left = target.left + target.width / 2 + “px”;
c.style.transform = “translate(-50%, -50%)”;
});

setTimeout(() => {
c.classList.remove(“fly”);
c.style.position = “static”;
c.style.transform = “none”;
slot.innerHTML = “”;
slot.appendChild(c);
}, 500);

return c;
}

function renderBack(div, n) {
div.innerHTML = “”;
if (n <= 0) return;
const b = document.createElement(“div”);
b.className = “card black”;
b.style.background = “#444”;
b.style.cursor = “default”;
b.textContent = n;
div.appendChild(b);
}

function updatePlayerScores() {
[“A”, “B”, “C”, “D”].forEach(p => {
const nameEl = document.getElementById(“name” + p);
if (!nameEl) return;
const won = tricksWon[p];
const bid = bids[p];
nameEl.querySelector(”.score”).textContent = `(${won}/${bid})`;
});
}

function updatePlayableCards() {
if (!hands.A || hands.A.length === 0) return;
const cards = handA.querySelectorAll(”.card”);
cards.forEach((el, i) => {
el.classList.remove(“playable”, “disabled”);
if (phase !== “PLAYING” || turn !== “A”) {
el.classList.add(“disabled”);
return;
}
const card = hands.A[i];
if (!card) {
el.classList.add(“disabled”);
return;
}
if (isLegal(card, “A”)) {
el.classList.add(“playable”);
} else {
el.classList.add(“disabled”);
}
});
}

function renderHands() {
handA.innerHTML = “”;
hands.A.forEach((c, i) => {
const el = cardEl(c);
el.onclick = () => playCard(i);
handA.appendChild(el);
});
renderBack(handB, hands.B.length);
renderBack(handC, hands.C.length);
renderBack(handD, hands.D.length);
updatePlayableCards();
}

/* ===== AI BIDDING ===== */
function aiBid(p) {
let score = 0;
const spadeCounts = {S: 0, H: 0, D: 0, C: 0};
const highCards = {S: [], H: [], D: [], C: []};

hands[p].forEach(c => {
spadeCounts[c.suit]++;
highCards[c.suit].push(c.rank);

```
if (c.suit === "S") {
  if (c.rank === "A") score += 1.0;
  else if (c.rank === "K") score += 0.9;
  else if (c.rank === "Q") score += 0.7;
  else if (c.rank === "J") score += 0.5;
  else if (rankVal(c.rank) >= rankVal("10")) score += 0.35;
  else if (rankVal(c.rank) >= rankVal("8")) score += 0.2;
} else {
  if (c.rank === "A") score += 0.95;
  else if (c.rank === "K" && spadeCounts[c.suit] <= 3) score += 0.65;
  else if (c.rank === "Q" && spadeCounts[c.suit] <= 2) score += 0.35;
}
```

});

// Void suits are valuable
Object.entries(spadeCounts).forEach(([suit, count]) => {
if (suit !== “S” && count === 0) score += 0.5;
else if (suit !== “S” && count === 1) score += 0.3;
else if (suit !== “S” && count === 2) score += 0.15;
});

// Strong spade holdings
if (spadeCounts.S >= 5) score += 0.3;
if (spadeCounts.S >= 7) score += 0.5;
if (spadeCounts.S >= 9) score += 0.7;

// Long weak suits in non-spades are dangerous
Object.entries(spadeCounts).forEach(([suit, count]) => {
if (suit !== “S” && count >= 5) {
const hasHighCard = highCards[suit].some(r => [“A”, “K”, “Q”].includes(r));
if (!hasHighCard) score -= 0.4;
}
});

bids[p] = Math.max(1, Math.min(13, Math.round(score)));
log(`Player ${p} bids ${bids[p]}`);
}

/* ===== DECLARE RULE ===== */
function maybeDeclare() {
const declaredAC = bids.A + bids.C;
const declaredBD = bids.B + bids.D;

const strengthAC = calculateTeamStrength(“A”, “C”);
const strengthBD = calculateTeamStrength(“B”, “D”);

// More conservative declaration threshold
if (strengthAC - declaredAC >= 2.8) {
const declareAmount = Math.min(2, Math.floor((strengthAC - declaredAC) / 2));
baselineAC += declareAmount;
log(`🟥 B+D declare: "You must make ${baselineAC}" (+${declareAmount} tricks)`);
} else {
log(“✅ B+D accept your bid.”);
}

if (strengthBD - declaredBD >= 2.8) {
const declareAmount = Math.min(2, Math.floor((strengthBD - declaredBD) / 2));
baselineBD += declareAmount;
log(`🔵 A+C counter-declare: "They must make ${baselineBD}" (+${declareAmount} tricks)`);
}
}

function calculateTeamStrength(p1, p2) {
let strength = 0;
const combined = […hands[p1], …hands[p2]];
const suitCounts = {S: 0, H: 0, D: 0, C: 0};
const highCards = {S: [], H: [], D: [], C: []};

combined.forEach(c => {
suitCounts[c.suit]++;
highCards[c.suit].push(c.rank);

```
if (c.suit === "S") {
  if (c.rank === "A") strength += 1.1;
  else if (c.rank === "K") strength += 0.95;
  else if (c.rank === "Q") strength += 0.75;
  else if (c.rank === "J") strength += 0.55;
  else if (rankVal(c.rank) >= rankVal("10")) strength += 0.35;
  else strength += 0.15;
} else {
  if (c.rank === "A") strength += 0.85;
  else if (c.rank === "K") strength += 0.5;
  else if (c.rank === "Q") strength += 0.25;
}
```

});

// Team synergy
if (suitCounts.S >= 9) strength += 0.8;
if (suitCounts.S >= 11) strength += 1.2;

// Void/singleton suits
Object.entries(suitCounts).forEach(([suit, count]) => {
if (suit !== “S”) {
if (count <= 2) strength += 0.4;
if (count === 0) strength += 0.3;
}
});

return strength;
}

function animateCollect(winner) {
const target = playerPositions[winner]();
document.querySelectorAll(”.slot .card”).forEach(card => {
const r = card.getBoundingClientRect();
card.classList.add(“collect”);
card.style.position = “fixed”;
card.style.top = r.top + r.height / 2 + “px”;
card.style.left = r.left + r.width / 2 + “px”;
card.style.transform = “translate(-50%, -50%)”;
document.body.appendChild(card);

```
requestAnimationFrame(() => {
  card.style.top = target.top + target.height / 2 + "px";
  card.style.left = target.left + target.width / 2 + "px";
  card.style.opacity = "0";
  card.style.transform = "translate(-50%, -50%) scale(0.5)";
});

setTimeout(() => card.remove(), 700);
```

});
}

/* ===== PLAY LOGIC ===== */
function isLegal(card, p) {
// If leading the trick
if (!leadSuit) {
// Can’t lead spades unless broken or only have spades
if (card.suit === “S” && !spadesBroken) {
return !hands[p].some(c => c.suit !== “S”);
}
return true;
}

// Must follow suit if possible
if (card.suit === leadSuit) return true;
return !hands[p].some(c => c.suit === leadSuit);
}

function playCard(i) {
if (phase !== “PLAYING” || turn !== “A”) return;
if (!isLegal(hands.A[i], “A”)) {
log(“❌ Must follow suit”);
return;
}
play(“A”, i);
}

function play(p, i) {
const card = hands[p].splice(i, 1)[0];
if (!leadSuit) {
leadSuit = card.suit;
}

// Break spades if a spade is played
if (card.suit === “S”) spadesBroken = true;

const animatedCard = animateCardPlay(p, card);
trick.push({player: p, card: card, el: animatedCard});

renderHands();
updatePlayableCards();

turn = nextPlayer[p];

if (trick.length < 4) {
setTimeout(aiPlay, 800);
} else {
setTimeout(resolveTrick, 1500);
}
}

function partnerOf(p) {
return p === “A” ? “C” : p === “C” ? “A” : p === “B” ? “D” : “B”;
}

function isPartnerWinning(p) {
if (trick.length === 0) return false;
let best = trick[0];
trick.forEach(t => {
if ((t.card.suit === “S” && best.card.suit !== “S”) ||
(t.card.suit === best.card.suit && rankVal(t.card.rank) > rankVal(best.card.rank))) {
best = t;
}
});
return best.player === partnerOf(p);
}

function canBeat(card, target) {
if (card.suit === “S” && target.suit !== “S”) return true;
if (card.suit !== target.suit) return false;
return rankVal(card.rank) > rankVal(target.rank);
}

function aiPlay() {
if (turn === “A” || phase !== “PLAYING”) return;

showThinking(turn, true);

const h = hands[turn];
if (!h || h.length === 0) {
showThinking(turn, false);
return;
}

const legal = h.filter(c => isLegal(c, turn));
if (legal.length === 0) {
showThinking(turn, false);
return;
}

setTimeout(() => {
let chosen;
const tricksLeft = h.length;
const myTricksWon = tricksWon[turn];
const myBid = bids[turn];
const needTricks = myBid - myTricksWon;
const aggressive = needTricks > tricksLeft - 1;
const conservative = myTricksWon >= myBid;

```
if (trick.length === 0) {
  // LEADING THE TRICK
  
  if (conservative) {
    // Lead safely
    const nonSpades = legal.filter(c => c.suit !== "S");
    if (nonSpades.length > 0) {
      const suitCounts = {};
      nonSpades.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
      const longestSuit = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0][0];
      const suitCards = nonSpades.filter(c => c.suit === longestSuit);
      chosen = suitCards.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0];
    } else {
      chosen = legal.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0];
    }
  } else if (aggressive) {
    // Need tricks - lead high cards
    const spades = legal.filter(c => c.suit === "S");
    const highCards = legal.filter(c => ["A", "K", "Q"].includes(c.rank));
    
    if (highCards.length > 0) {
      chosen = highCards.sort((a, b) => {
        if (a.suit === "S" && b.suit !== "S") return -1;
        if (a.suit !== "S" && b.suit === "S") return 1;
        return rankVal(b.rank) - rankVal(a.rank);
      })[0];
    } else if (spades.length > 0) {
      chosen = spades.sort((a, b) => rankVal(b.rank) - rankVal(a.rank))[0];
    } else {
      chosen = legal.sort((a, b) => rankVal(b.rank) - rankVal(a.rank))[0];
    }
  } else {
    // Normal play
    const nonSpades = legal.filter(c => c.suit !== "S");
    if (nonSpades.length > 0) {
      chosen = nonSpades.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[Math.floor(nonSpades.length / 3)];
    } else {
      chosen = legal.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0];
    }
  }
} else {
  // FOLLOWING IN THE TRICK
  const winningNow = trick.reduce((best, t) => {
    if ((t.card.suit === "S" && best.card.suit !== "S") ||
        (t.card.suit === best.card.suit && rankVal(t.card.rank) > rankVal(best.card.rank))) {
      return t;
    }
    return best;
  }, trick[0]).card;

  const partnerWinning = isPartnerWinning(turn);
  const winners = legal.filter(c => canBeat(c, winningNow));

  if (partnerWinning) {
    // Partner winning - support them
    if (conservative) {
      // Dump lowest card
      chosen = legal.sort((a, b) => {
        if (a.suit !== "S" && b.suit === "S") return -1;
        if (a.suit === "S" && b.suit !== "S") return 1;
        return rankVal(a.rank) - rankVal(b.rank);
      })[0];
    } else {
      // Dump low but keep useful cards
      const lowCards = legal.filter(c => rankVal(c.rank) <= rankVal("9"));
      if (lowCards.length > 0) {
        chosen = lowCards[0];
      } else {
        chosen = legal.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0];
      }
    }
  } else {
    // Try to win the trick
    if (aggressive || needTricks > 0) {
      if (winners.length > 0) {
        // Win with lowest winning card
        chosen = winners.sort((a, b) => {
          if (a.suit !== "S" && b.suit === "S" && canBeat(a, winningNow)) return -1;
          if (a.suit === "S" && b.suit !== "S" && canBeat(b, winningNow)) return 1;
          return rankVal(a.rank) - rankVal(b.rank);
        })[0];
      } else {
        // Can't win - dump lowest
        chosen = legal.sort((a, b) => {
          if (a.suit !== "S" && b.suit === "S") return -1;
          if (a.suit === "S" && b.suit !== "S") return 1;
          return rankVal(a.rank) - rankVal(b.rank);
        })[0];
      }
    } else if (conservative) {
      // Don't want to win - play low
      chosen = legal.sort((a, b) => {
        if (a.suit !== "S" && b.suit === "S") return -1;
        if (a.suit === "S" && b.suit !== "S") return 1;
        return rankVal(a.rank) - rankVal(b.rank);
      })[0];
    } else {
      // Normal play
      if (winners.length > 0 && winners.length <= 2) {
        // Can win economically
        chosen = winners[0];
      } else {
        // Dump low card
        chosen = legal.sort((a, b) => rankVal(a.rank) - rankVal(b.rank))[0];
      }
    }
  }
}

showThinking(turn, false);
play(turn, h.indexOf(chosen));
```

}, 600);
}

/* ===== TRICK RESOLUTION ===== */
function resolveTrick() {
let win = trick[0];
trick.forEach(t => {
if ((t.card.suit === “S” && win.card.suit !== “S”) ||
(t.card.suit === win.card.suit && rankVal(t.card.rank) > rankVal(win.card.rank))) {
win = t;
}
});

tricksWon[win.player]++;
updatePlayerScores();
log(`🏆 Player ${win.player} wins the trick`);

animateCollect(win.player);

setTimeout(() => {
document.querySelectorAll(”.slot”).forEach(s => s.innerHTML = “”);
trick = [];
leadSuit = null;
turn = win.player;
updatePlayableCards();

```
if (hands.A.length === 0) {
  endRound();
} else if (phase === "PLAYING" && turn !== "A") {
  setTimeout(aiPlay, 600);
}
```

}, 800);
}

/* ===== SCORING ===== */
function endRound() {
phase = “END”;
turn = null;

const ac = tricksWon.A + tricksWon.C;
const bd = tricksWon.B + tricksWon.D;

let gainAC = Math.max(0, ac - baselineAC);
let gainBD = Math.max(0, bd - baselineBD);

teamScore.AC += gainAC;
teamScore.BD += gainBD;

document.getElementById(“roundText”).innerHTML = `<div class="result-section"> <h3>Your Team (A+C)</h3> <p>Baseline: ${baselineAC} | Tricks: ${ac}</p> <p><strong>Points: +${gainAC}</strong></p> </div> <div class="result-section"> <h3>Opponents (B+D)</h3> <p>Baseline: ${baselineBD} | Tricks: ${bd}</p> <p><strong>Points: +${gainBD}</strong></p> </div> <div class="result-section"> <h3>Total Score</h3> <p><strong>A+C: ${teamScore.AC} | B+D: ${teamScore.BD}</strong></p> </div>`;

document.getElementById(“roundResult”).style.display = “flex”;
}

function closeResult() {
document.getElementById(“roundResult”).style.display = “none”;

if (teamScore.AC >= 7 || teamScore.BD >= 7) {
setTimeout(() => {
alert(teamScore.AC >= 7 ? “🎉 YOU WIN THE GAME!” : “💀 YOU LOSE THE GAME”);
teamScore = {AC: 0, BD: 0};
startGame();
}, 100);
} else {
startGame();
}
}

/* ===== GAME INITIALIZATION ===== */
function startGame() {
phase = “BIDDING”;
turn = “A”;
trick = [];
leadSuit = null;
bids = {A: 0, B: 0, C: 0, D: 0};
baselineAC = 0;
baselineBD = 0;
tricksWon = {A: 0, B: 0, C: 0, D: 0};
chat.innerHTML = “”;
selectedBid = null;
spadesBroken = false;

// Reset bid buttons
bidButtons.forEach(btn => {
btn.disabled = false;
btn.classList.remove(“selected”);
});
submitBidBtn.disabled = true;

createDeck();
shuffle();
deal();

log(“🃏 New round — select your bid (1-13).”);
updatePlayerScores();
}

// Start the game when page loads
startGame();