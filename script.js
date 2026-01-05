/* ===== CONSTANTS ===== */
const suitsOrder=["S","H","D","C"];
const ranksOrder=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const suitSymbols={S:"♠",H:"♥",D:"♦",C:"♣"};
const nextPlayer={A:"B",B:"C",C:"D",D:"A"};


/* ===== STATE ===== */
let deck=[];
let hands={A:[],B:[],C:[],D:[]};
let bids={A:0,B:0,C:0,D:0};
let tricksWon={A:0,B:0,C:0,D:0};
let teamScore={AC:0,BD:0};

let baselineAC=0, baselineBD=0;
let phase="BIDDING", turn="A", trick=[], leadSuit=null;

/* ===== DOM ===== */
const handA=document.getElementById("handA");
const handB=document.getElementById("handB");
const handC=document.getElementById("handC");
const handD=document.getElementById("handD");
const trickDiv=document.getElementById("trick");
const chat=document.getElementById("chat");

/* ===== HELPERS ===== */
const rankVal=r=>ranksOrder.indexOf(r);
const playerPositions = {
  A: () => handA.getBoundingClientRect(),
  B: () => handB.getBoundingClientRect(),
  C: () => handC.getBoundingClientRect(),
  D: () => handD.getBoundingClientRect()
};
function log(msg){
  chat.innerHTML+=`<div>${msg}</div>`;
  chat.scrollTop=chat.scrollHeight;
}

/* ===== DECK ===== */
function createDeck(){
  deck=[];
  suitsOrder.forEach(s=>ranksOrder.forEach(r=>deck.push({suit:s,rank:r})));
}
const shuffle=()=>deck.sort(()=>Math.random()-0.5);

function deal(){
  hands={A:[],B:[],C:[],D:[]};
  for(let i=0;i<52;i++) hands[["A","B","C","D"][i%4]].push(deck[i]);
  sortHands();
  renderHands();
}

function updatePlayableCards() {
  if (!hands.A || hands.A.length === 0) return;

  const cards = handA.querySelectorAll(".card");

  cards.forEach((el, i) => {
    el.classList.remove("playable", "disabled");

    if (phase !== "PLAYING" || turn !== "A") {
      el.classList.add("disabled");
      return;
    }

    const card = hands.A[i];
    if (!card) {
      el.classList.add("disabled");
      return;
    }

    if (isLegal(card, "A")) {
      el.classList.add("playable");
    } else {
      el.classList.add("disabled");
    }
  });
}


function sortHands(){
  Object.values(hands).forEach(h=>
    h.sort((a,b)=>a.suit!==b.suit
      ? suitsOrder.indexOf(a.suit)-suitsOrder.indexOf(b.suit)
      : rankVal(a.rank)-rankVal(b.rank))
  );
}

/* ===== RENDER ===== */
function cardEl(c){
  if(!c) {
    const d = document.createElement("div");
    d.className = "card black";
    d.style.visibility = "hidden";
    return d;
  }

  const d = document.createElement("div");
  d.className = "card " + ((c.suit === "H" || c.suit === "D") ? "red" : "black");
  d.textContent = c.rank + suitSymbols[c.suit];
  return d;
}

function animateCardPlay(player, card) {
  const start = playerPositions[player]();
  const slot = document.querySelector(`.slot[data-p="${player}"]`);
  const target = slot.getBoundingClientRect();

  const c = cardEl(card);
  c.classList.add("fly");

  c.style.top = start.top + start.height / 2 + "px";
  c.style.left = start.left + start.width / 2 + "px";

  document.body.appendChild(c);

  requestAnimationFrame(() => {
    c.style.top = target.top + target.height / 2 + "px";
    c.style.left = target.left + target.width / 2 + "px";
    c.style.transform = "translate(-50%, -50%) scale(1.1)";
  });

  // 🔑 AFTER animation, lock card into slot
  setTimeout(() => {
    c.classList.remove("fly");
    c.style.position = "static";
    c.style.transform = "scale(1)";
    slot.appendChild(c);
  }, 400);

  return c;
}


function renderBack(div,n){
  div.innerHTML="";
  for(let i=0;i<n;i++){
    const b=document.createElement("div");
    b.className="card black";
    b.style.background="#444";
    div.appendChild(b);
  }
}

function renderHands(){
  handA.innerHTML="";
  hands.A.forEach((c,i)=>{
    const el=cardEl(c);
    el.onclick=()=>playCard(i);
    handA.appendChild(el);
  });
  renderBack(handB,hands.B.length);
  renderBack(handC,hands.C.length);
  renderBack(handD,hands.D.length);
  
  updatePlayableCards();
}

function renderTrick(){
  trickDiv.innerHTML = "";

  trick.forEach(t => {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.style.fontSize = "12px";
    label.textContent = t.player;

    wrap.appendChild(t.el);
    wrap.appendChild(label);
    trickDiv.appendChild(wrap);
  });
}



/* ===== AI BIDDING ===== */
function aiBid(p){
  let score=0;
  hands[p].forEach(c=>{
    if(c.suit==="S") score+=["A","K","Q"].includes(c.rank)?1:0.4;
    else {
      if(c.rank==="A") score+=0.9;
      if(c.rank==="K") score+=0.4;
    }
  });
  bids[p]=Math.round(Math.min(13,score));
  log(`Player ${p} bids ${bids[p]}`);
}

/* ===== DECLARE RULE ===== */
function maybeDeclare(){
  const declared=bids.A+bids.C;
  const strength=estimate("A")+estimate("C");
  if(strength-declared>2){
    baselineAC+=1;
    log(`🟥 B+D declare: "You make ${baselineAC}"`);
  } else log("B+D accept your bid.");
}

function estimate(p){
  let v=0;
  hands[p].forEach(c=>{
    if(c.suit==="S") v+=0.6;
    if(c.rank==="A") v+=0.6;
    if(c.rank==="K") v+=0.3;
  });
  return v;
}

/* ===== PLAY ===== */
function isLegal(card,p){
  if(!leadSuit) return true;
  if(card.suit===leadSuit) return true;
  return !hands[p].some(c=>c.suit===leadSuit);
}

function playCard(i){
  if(phase!=="PLAYING"||turn!=="A") return;
  if(!isLegal(hands.A[i],"A")){
    log("Must follow suit");
    return;
  }
  play("A",i);
}

function play(p,i){
  const card=hands[p].splice(i,1)[0];
  if(!leadSuit) leadSuit=card.suit;
  const animatedCard = animateCardPlay(p, card);

trick.push({
  player: p,
  card: card,
  el: animatedCard
});

renderHands();
  updatePlayableCards();
  turn=nextPlayer[p];
  trick.length<4 ? setTimeout(aiPlay,400) : setTimeout(resolveTrick,600);
}

function partnerOf(p) {
  return p === "A" ? "C" :
         p === "C" ? "A" :
         p === "B" ? "D" : "B";
}

function isPartnerWinning(p) {
  if (trick.length === 0) return false;

  let best = trick[0];
  trick.forEach(t => {
    if (
      (t.card.suit === "S" && best.card.suit !== "S") ||
      (t.card.suit === best.card.suit &&
        rankVal(t.card.rank) > rankVal(best.card.rank))
    ) {
      best = t;
    }
  });

  return best.player === partnerOf(p);
}

function canBeat(card, target) {
  if (card.suit === "S" && target.suit !== "S") return true;
  if (card.suit !== target.suit) return false;
  return rankVal(card.rank) > rankVal(target.rank);
}

function aiPlay() {
  if (turn === "A" || phase !== "PLAYING") return;

  const h = hands[turn];
  if (!h || h.length === 0) return;

  const legal = h.filter(c => isLegal(c, turn));
  if (legal.length === 0) return;

  let chosen;

  const aggressive = h.length <= 4; // last tricks

  if (trick.length === 0) {
    // LEADING
    chosen = aggressive
      ? legal.sort((a,b)=>rankVal(b.rank)-rankVal(a.rank))[0]
      : legal.find(c=>c.suit!=="S") || legal[0];
  } 
  else {
    const winningNow = trick.reduce((best,t)=>{
      if (
        (t.card.suit==="S" && best.card.suit!=="S") ||
        (t.card.suit===best.card.suit &&
         rankVal(t.card.rank)>rankVal(best.card.rank))
      ) return t;
      return best;
    }, trick[0]).card;

    if (isPartnerWinning(turn)) {
      // Partner winning → dump lowest
      chosen = legal.sort((a,b)=>rankVal(a.rank)-rankVal(b.rank))[0];
    } 
    else {
      // Try to win
      const winners = legal.filter(c => canBeat(c, winningNow));
      if (winners.length > 0) {
        chosen = winners.sort((a,b)=>rankVal(a.rank)-rankVal(b.rank))[0];
      } else {
        // Can't win → dump lowest
        chosen = legal.sort((a,b)=>rankVal(a.rank)-rankVal(b.rank))[0];
      }
    }
  }

  play(turn, h.indexOf(chosen));
}


/* ===== TRICK RESOLUTION ===== */
function resolveTrick(){
  let win = trick[0];
  document.querySelectorAll(".slot").forEach(s => s.innerHTML = "");


  trick.forEach(t => {
    
    if (
      (t.card.suit === "S" && win.card.suit !== "S") ||
      (t.card.suit === win.card.suit &&
        rankVal(t.card.rank) > rankVal(win.card.rank))
    ) {
      win = t;
    }
  });

  tricksWon[win.player]++;
  log(`🏆 Player ${win.player} wins the trick`);
  trick = [];
  leadSuit = null;
  turn = win.player;
  updatePlayableCards();

  hands.A.length
    ? turn !== "A" && setTimeout(aiPlay, 500)
    : endRound();
}


/* ===== SCORING ===== */
function endRound(){
  const ac = tricksWon.A + tricksWon.C;
  const bd = tricksWon.B + tricksWon.D;

  let gainAC = 0;
  let gainBD = 0;

  if(ac > baselineAC) gainAC = ac - baselineAC;
  if(bd > baselineBD) gainBD = bd - baselineBD;

  teamScore.AC += gainAC;
  teamScore.BD += gainBD;

  document.getElementById("roundText").innerHTML = `
    <p><b>Your Team (A+C)</b></p>
    <p>Baseline: ${baselineAC}</p>
    <p>Tricks: ${ac}</p>
    <p>Points: +${gainAC}</p>
    <hr>
    <p><b>Opponents (B+D)</b></p>
    <p>Baseline: ${baselineBD}</p>
    <p>Tricks: ${bd}</p>
    <p>Points: +${gainBD}</p>
    <hr>
    <p><b>Total Score</b></p>
    <p>A+C: ${teamScore.AC} | B+D: ${teamScore.BD}</p>
  `;

  document.getElementById("roundResult").style.display = "flex";

  phase = "END";
}
function closeResult(){
  document.getElementById("roundResult").style.display = "none";

  if(teamScore.AC >= 7 || teamScore.BD >= 7){
    alert(teamScore.AC >= 7 ? "🎉 YOU WIN THE GAME!" : "💀 YOU LOSE THE GAME");
    teamScore = {AC:0, BD:0};
  }

  startGame();
}


/* ===== FLOW ===== */
bidBtn.onclick=()=>{
  bids.A=parseInt(bidInput.value||0);
  aiBid("B"); aiBid("C"); aiBid("D");
  baselineAC=bids.A+bids.C;
  baselineBD=bids.B+bids.D;
  maybeDeclare();
  phase="PLAYING";
};

newGameBtn.onclick=startGame;

function startGame(){
  phase="BIDDING"; turn="A"; trick=[]; leadSuit=null;
  tricksWon={A:0,B:0,C:0,D:0};
  chat.innerHTML=""; 
  createDeck(); shuffle(); deal();
  log("New round — submit your bid.");
}

startGame();
