import {
  BOARD_SIZE,
  MOVE_LIMIT,
  SCORE_GOAL,
  createBoard,
  findMatches,
  hasPossibleMoves,
  isAdjacent,
  isValidSwap,
  resolveMatches,
  swapTiles
} from "./game.js";
import { prepareGameBreakAd, showGameBreakAd } from "./ads.js";
import { pieceIcons } from "./pieces.js";

const pieceNames = ["Moonbud", "Comet", "Bloom", "Prism", "Leaflight", "Sunseed"];
const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const movesElement = document.querySelector("#moves");
const goalLabel = document.querySelector("#goal-label");
const progress = document.querySelector("#goal-progress");
const progressFill = document.querySelector("#progress-fill");
const bestElement = document.querySelector("#best-score");
const hintElement = document.querySelector("#hint");
const announcer = document.querySelector("#announcer");
const overlay = document.querySelector("#game-over");
const soundButton = document.querySelector("#sound-toggle");
const installButton = document.querySelector("#install-button");
const levelElement = document.querySelector("#level");
const heartsElement = document.querySelector("#hearts");
const heartClockElement = document.querySelector("#heart-clock");
const coinsElement = document.querySelector("#coins");
const timerElement = document.querySelector("#timer");
const buyHeartsButton = document.querySelector("#buy-hearts");
const HEART_CAP = 5;
const HEART_REGEN_MS = 30 * 60 * 1000;
const ROUND_SECONDS = 90;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("astra-grove-town-progress") || "{}");
    return { level: Math.max(1, Number(saved.level) || 1), coins: saved.coins == null ? 250 : Math.max(0, Number(saved.coins) || 0), hearts: Math.max(0, Math.min(HEART_CAP, Number(saved.hearts ?? HEART_CAP))), heartAt: Number(saved.heartAt) || Date.now() };
  } catch { return { level: 1, coins: 250, hearts: HEART_CAP, heartAt: Date.now() }; }
}
const progressSave = loadProgress();

const state = {
  board: createBoard(),
  score: 0,
  moves: MOVE_LIMIT,
  level: progressSave.level,
  coins: progressSave.coins,
  hearts: progressSave.hearts,
  heartAt: progressSave.heartAt,
  seconds: ROUND_SECONDS,
  selected: null,
  busy: false,
  ended: false,
  generation: 0,
  muted: readPreference("astra-grove-muted") === "true",
  best: Number(readPreference("astra-grove-best")) || 0
};

let audioContext = null;
let pointerStart = null;
let suppressClicksUntil = 0;
let completedGames = 0;
let installPrompt = null;
let roundInterval = null;

function goalForLevel() { return SCORE_GOAL + (state.level - 1) * 110; }
function durationForLevel() { return Math.max(55, ROUND_SECONDS - Math.floor((state.level - 1) / 4) * 3); }
function saveProgress() { savePreference("astra-grove-town-progress", JSON.stringify({ level: state.level, coins: state.coins, hearts: state.hearts, heartAt: state.heartAt })); }

function updateHearts() {
  if (state.hearts >= HEART_CAP) { state.heartAt = Date.now(); return; }
  const recovered = Math.floor(Math.max(0, Date.now() - state.heartAt) / HEART_REGEN_MS);
  if (recovered) {
    state.hearts = Math.min(HEART_CAP, state.hearts + recovered);
    state.heartAt += recovered * HEART_REGEN_MS;
    if (state.hearts >= HEART_CAP) state.heartAt = Date.now();
    saveProgress();
  }
}

function startRoundClock() {
  window.clearInterval(roundInterval);
  state.seconds = durationForLevel();
  updateDashboard();
  roundInterval = window.setInterval(() => {
    if (state.ended || state.busy) return;
    state.seconds -= 1;
    updateDashboard();
    if (state.seconds <= 0) endGame(false, "time");
  }, 1000);
}

function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}

function createAudioContext() {
  if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextType();
  }
  if (audioContext?.state === "suspended") void audioContext.resume();
}

function playNote(frequency, duration = 0.16, volume = 0.11, delay = 0) {
  if (state.muted || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, start + duration * 0.42);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.88, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playMatch(cascade) {
  const notes = cascade > 1 ? [523, 659, 784, 1047] : [523, 659, 784];
  notes.forEach((note, index) => playNote(note * (cascade > 2 ? 1.12 : 1), 0.2, 0.09, index * 0.045));
  if (audioContext && !state.muted) {
    const start = audioContext.currentTime;
    const buffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 0.11), audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, start);
    filter.frequency.exponentialRampToValueAtTime(380, start + 0.1);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(cascade > 1 ? 0.16 : 0.11, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
    source.connect(filter).connect(gain).connect(audioContext.destination);
    source.start(start);
  }
}

function formatScore(score) {
  return String(score).padStart(4, "0");
}

function cellLabel(tile, row, column) {
  const piece = pieceNames[tile.type];
  const special = tile.special
    ? `, ${tile.special === "wild" ? "starlight" : `line-clearing ${tile.special}`} special`
    : "";
  return `${piece}${special}, row ${row + 1}, column ${column + 1}`;
}

function render({ swapCells = [], invalidCells = [], refillCells = [], swapOffsets = {} } = {}) {
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const index = row * BOARD_SIZE + column;
      const tile = state.board[row][column];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `piece piece--${tile.type}`;
      button.disabled = state.ended;
      if (state.selected === index) button.classList.add("is-selected");
      if (swapCells.includes(index)) button.classList.add("is-swapping");
      if (swapOffsets[index]) {
        button.style.setProperty("--swap-x", `${swapOffsets[index].x}px`);
        button.style.setProperty("--swap-y", `${swapOffsets[index].y}px`);
      }
      if (invalidCells.includes(index)) button.classList.add("is-invalid");
      if (refillCells.includes(index)) button.classList.add("is-refilling");
      if (tile.special) button.classList.add(`is-special`, `is-special-${tile.special}`);
      button.dataset.index = String(index);
      button.setAttribute("aria-label", cellLabel(tile, row, column));
      button.innerHTML = `${pieceIcons[tile.type]}${tile.special ? '<span class="special-mark" aria-hidden="true">✦</span>' : ""}${refillCells.includes(index) ? '<span class="match-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' : ""}`;
      fragment.append(button);
    }
  }
  boardElement.replaceChildren(fragment);
  updateDashboard();
}

function updateDashboard() {
  updateHearts();
  const goal = goalForLevel();
  levelElement.textContent = String(state.level);
  heartsElement.textContent = `${state.hearts}/${HEART_CAP}`;
  coinsElement.textContent = String(state.coins);
  buyHeartsButton.disabled = state.hearts >= HEART_CAP || state.coins < 250;
  const continueButton = document.querySelector("#play-again");
  continueButton.disabled = state.ended && state.hearts <= 0 && state.coins < 250;
  if (state.ended && state.score < goalForLevel() && state.hearts > 0) continueButton.innerHTML = 'Try again <span aria-hidden="true">↗</span>';
  const nextHeart = Math.max(0, HEART_REGEN_MS - (Date.now() - state.heartAt));
  heartClockElement.textContent = state.hearts >= HEART_CAP ? "FULL" : `${Math.floor(nextHeart / 60000)}:${String(Math.floor(nextHeart / 1000) % 60).padStart(2, "0")}`;
  timerElement.textContent = `${String(Math.floor(state.seconds / 60)).padStart(2, "0")}:${String(state.seconds % 60).padStart(2, "0")}`;
  timerElement.classList.toggle("timer-low", state.seconds <= 15);
  scoreElement.textContent = formatScore(state.score);
  movesElement.textContent = String(state.moves);
  movesElement.classList.toggle("moves-value--low", state.moves <= 5);
  goalLabel.textContent = `${Math.min(state.score, goal)} / ${goal}`;
  progress.setAttribute("aria-valuemax", String(goal));
  progress.setAttribute("aria-valuenow", String(Math.min(state.score, goal)));
  progressFill.style.transform = `scaleX(${Math.min(1, state.score / goal)})`;
  bestElement.textContent = formatScore(state.best);
  soundButton.setAttribute("aria-label", state.muted ? "Turn sound on" : "Turn sound off");
  soundButton.classList.toggle("is-muted", state.muted);
}

function announce(message) {
  announcer.textContent = "";
  window.setTimeout(() => { announcer.textContent = message; }, 30);
}

function setHint(message, tone = "default") {
  hintElement.innerHTML = `${message}<span aria-hidden="true">${tone === "special" ? " \u2727" : " \u2726"}</span>`;
  hintElement.classList.toggle("hint-label--special", tone === "special");
}

function endGame(won, reason = "moves") {
  state.ended = true;
  window.clearInterval(roundInterval);
  if (won) {
    const reward = 60 + Math.min(state.level * 3, 90);
    state.coins += reward;
    document.querySelector("#result-kicker").textContent = `LEVEL ${state.level} COMPLETE · +${reward} COINS`;
    document.querySelector("#result-title").textContent = "Your grove is growing!";
    document.querySelector("#result-copy").textContent = `Lovely work! Level ${state.level + 1} is ready when you are.`;
    document.querySelector("#play-again").innerHTML = `Level ${state.level + 1} <span aria-hidden="true">↗</span>`;
  } else {
    state.hearts = Math.max(0, state.hearts - 1);
    if (state.hearts === HEART_CAP - 1) state.heartAt = Date.now();
    document.querySelector("#result-kicker").textContent = reason === "time" ? "TIME'S UP" : "LEVEL NOT QUITE";
    document.querySelector("#result-title").textContent = state.hearts ? "Ready for another try?" : "Your hearts need a rest";
    document.querySelector("#result-copy").textContent = state.hearts
      ? `You have ${state.hearts} ${state.hearts === 1 ? "heart" : "hearts"} left. Your best grows with every try.`
      : "A heart grows back every 30 minutes, or refill now with coins.";
    document.querySelector("#play-again").innerHTML = state.hearts ? 'Try again <span aria-hidden="true">↗</span>' : 'Refill hearts <span aria-hidden="true">♡</span>';
  }
  saveProgress();
  state.selected = null;
  render();
  overlay.hidden = false;
  announce(won ? `Level ${state.level} complete. Coins earned.` : reason === "time" ? "Time is up. A heart was used." : "Level ended. A heart was used.");
  playNote(won ? 784 : 330, 0.4, 0.12);
  if (won) playNote(988, 0.5, 0.1, 0.14);
  completedGames += 1;
  if (completedGames % 4 === 0) void showGameBreakAd();
  document.querySelector("#play-again").focus();
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function attemptSwap(firstIndex, secondIndex) {
  if (state.busy || state.ended || firstIndex === secondIndex) return;
  const generation = state.generation;
  const first = [Math.floor(firstIndex / BOARD_SIZE), firstIndex % BOARD_SIZE];
  const second = [Math.floor(secondIndex / BOARD_SIZE), secondIndex % BOARD_SIZE];
  if (!isAdjacent(first, second)) return;

  createAudioContext();
  const firstEl = boardElement.querySelector(`[data-index="${firstIndex}"]`);
  const secondEl = boardElement.querySelector(`[data-index="${secondIndex}"]`);
  const firstRect = firstEl?.getBoundingClientRect();
  const secondRect = secondEl?.getBoundingClientRect();
  const dx = firstRect && secondRect ? secondRect.left - firstRect.left : 0;
  const dy = firstRect && secondRect ? secondRect.top - firstRect.top : 0;
  const swapOffsets = { [firstIndex]: { x: dx, y: dy }, [secondIndex]: { x: -dx, y: -dy } };
  state.selected = null;
  state.busy = true;
  const specialSwap = Boolean(state.board[first[0]][first[1]].special || state.board[second[0]][second[1]].special);
  const legalSwap = isValidSwap(state.board, first, second);
  swapTiles(state.board, first, second);
  render({ swapCells: [firstIndex, secondIndex], swapOffsets });
  playNote(440, 0.16, 0.06);
  await delay(265);
  if (generation !== state.generation) return;

  if (!legalSwap) {
    render({ invalidCells: [firstIndex, secondIndex] });
    playNote(220, 0.14, 0.07);
    await delay(270);
    if (generation !== state.generation) return;
    swapTiles(state.board, first, second);
    state.busy = false;
    render();
    setHint("Try a different pair");
    announce("Those pieces do not make a match. Choose another pair.");
    return;
  }

  state.moves -= 1;
  let cascade = 0;
  let preferredCell = second;

  while (cascade < BOARD_SIZE * BOARD_SIZE) {
    const result = resolveMatches(state.board, Math.random, preferredCell, cascade === 0 && specialSwap ? [first, second] : []);
    if (!result) break;
    cascade += 1;
    state.score += result.clearedCount * 10 * cascade;
    if (result.created) state.score += result.created.special === "wild" ? 50 : 30;
    if (state.score > state.best) {
      state.best = state.score;
      savePreference("astra-grove-best", String(state.best));
    }
    render({ refillCells: result.clearedCells });
    playMatch(cascade);
    setHint(
      result.created
        ? result.created.special === "wild" ? "A starlight piece appeared" : "A line-clearing piece appeared"
        : cascade > 1 ? `Lovely cascade ×${cascade}` : "A little more stardust",
      result.created ? "special" : "default"
    );
    announce(`${result.clearedCount} pieces cleared${cascade > 1 ? `, cascade ${cascade}` : ""}.`);
    preferredCell = null;
    await delay(320);
    if (generation !== state.generation) return;
  }

  state.busy = false;
  render();

  if (state.score >= goalForLevel()) {
    endGame(true);
  } else if (state.moves <= 0) {
    endGame(false);
  } else if (!hasPossibleMoves(state.board)) {
    state.board = createBoard();
    setHint("A fresh patch of sky");
    announce("The grove reshuffled to make room for more matches.");
  } else if (cascade === 0) {
    setHint("Find a little magic");
  }
}

function selectOrSwap(index) {
  if (state.busy || state.ended) return;
  createAudioContext();
  if (state.selected === null) {
    state.selected = index;
    render();
    playNote(587, 0.12, 0.045);
    return;
  }
  if (state.selected === index) {
    state.selected = null;
    render();
    return;
  }
  const first = [Math.floor(state.selected / BOARD_SIZE), state.selected % BOARD_SIZE];
  const second = [Math.floor(index / BOARD_SIZE), index % BOARD_SIZE];
  if (!isAdjacent(first, second)) {
    state.selected = index;
    render();
    playNote(587, 0.12, 0.045);
    return;
  }
  void attemptSwap(state.selected, index);
}

boardElement.addEventListener("click", (event) => {
  if (performance.now() < suppressClicksUntil) return;
  const piece = event.target.closest(".piece");
  if (piece) selectOrSwap(Number(piece.dataset.index));
});

boardElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  const piece = event.target.closest(".piece");
  if (piece) pointerStart = { index: Number(piece.dataset.index), x: event.clientX, y: event.clientY };
});

boardElement.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const { index, x, y } = pointerStart;
  pointerStart = null;
  const deltaX = event.clientX - x;
  const deltaY = event.clientY - y;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) return;
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const nextRow = row + (Math.abs(deltaY) > Math.abs(deltaX) ? Math.sign(deltaY) : 0);
  const nextColumn = column + (Math.abs(deltaX) >= Math.abs(deltaY) ? Math.sign(deltaX) : 0);
  if (nextRow >= 0 && nextRow < BOARD_SIZE && nextColumn >= 0 && nextColumn < BOARD_SIZE) {
    suppressClicksUntil = performance.now() + 120;
    void attemptSwap(index, nextRow * BOARD_SIZE + nextColumn);
  }
});

boardElement.addEventListener("pointercancel", () => { pointerStart = null; });

boardElement.addEventListener("keydown", (event) => {
  const piece = event.target.closest(".piece");
  if (!piece) return;
  const index = Number(piece.dataset.index);
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const offsets = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  const nextRow = row + offset[0];
  const nextColumn = column + offset[1];
  if (nextRow >= 0 && nextRow < BOARD_SIZE && nextColumn >= 0 && nextColumn < BOARD_SIZE) {
    boardElement.querySelector(`[data-index="${nextRow * BOARD_SIZE + nextColumn}"]`).focus();
  }
});

document.querySelector("#reset-button").addEventListener("click", () => {
  if (state.ended || state.busy) return;
  const used = state.moves < MOVE_LIMIT || state.score > 0 || state.seconds < durationForLevel();
  if (used) {
    state.hearts = Math.max(0, state.hearts - 1);
    if (state.hearts === HEART_CAP - 1) state.heartAt = Date.now();
    saveProgress();
    if (state.hearts <= 0) { restart(); return; }
  }
  restart();
});
document.querySelector("#play-again").addEventListener("click", continueFromOverlay);
buyHeartsButton.addEventListener("click", () => {
  updateHearts();
  if (state.hearts >= HEART_CAP || state.coins < 250) return;
  state.coins -= 250;
  state.hearts = HEART_CAP;
  state.heartAt = Date.now();
  saveProgress();
  updateDashboard();
  if (state.ended) { overlay.hidden = true; restart(); }
});

function continueFromOverlay() {
  if (state.hearts <= 0) {
    if (state.coins < 250) return;
    state.coins -= 250;
    state.hearts = HEART_CAP;
    state.heartAt = Date.now();
    saveProgress();
  }
  if (state.score >= goalForLevel()) state.level += 1;
  overlay.hidden = true;
  restart();
}

function restart() {
  if (state.hearts <= 0) {
    state.ended = true;
    overlay.hidden = false;
    document.querySelector("#result-kicker").textContent = "GROVE REST STOP";
    document.querySelector("#result-title").textContent = "Your hearts need a rest";
    document.querySelector("#result-copy").textContent = "A heart grows back every 30 minutes, or refill now with coins.";
    document.querySelector("#play-again").innerHTML = 'Refill hearts <span aria-hidden="true">♡</span>';
    render();
    return;
  }
  state.generation += 1;
  state.board = createBoard();
  state.score = 0;
  state.moves = MOVE_LIMIT;
  state.selected = null;
  state.busy = false;
  state.ended = false;
  overlay.hidden = true;
  setHint("Find a little magic");
  render();
  startRoundClock();
  boardElement.firstElementChild.focus();
  announce("New game. Match three or more pieces to gather stardust.");
}

soundButton.addEventListener("click", () => {
  state.muted = !state.muted;
  savePreference("astra-grove-muted", String(state.muted));
  updateDashboard();
  if (!state.muted) {
    createAudioContext();
    playNote(659, 0.2, 0.07);
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  installButton.hidden = true;
});

render();
if (state.hearts > 0) startRoundClock();
else restart();
window.setInterval(() => { if (state.ended) updateDashboard(); }, 1000);

if (!hasPossibleMoves(state.board) || findMatches(state.board).size > 0) {
  state.board = createBoard();
  render();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

void prepareGameBreakAd();
