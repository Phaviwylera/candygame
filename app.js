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

const pieceNames = ["Moonbud", "Comet", "Bloom", "Prism", "Leaflight", "Sunseed"];
const pieceIcons = [
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M25.8 5.2a15.3 15.3 0 1 0 9 25.1A16.5 16.5 0 0 1 25.8 5.2Z" fill="currentColor"/><path d="m12 11 1 3.2 3.2 1-3.2 1-1 3.2-1-3.2-3.2-1 3.2-1 1-3.2Z" fill="currentColor" opacity=".8"/></svg>',
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3.5 4.2 11.1 11.1 5.4-11.1 4.1L20 36l-4.2-11.9L4.7 20l11.1-5.4L20 3.5Z" fill="currentColor"/><circle cx="20" cy="20" r="3.1" fill="currentColor" opacity=".7"/></svg>',
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 18c-8-12-18-2-9 5-9 7 1 17 9 5 8 12 18 2 9-5 9-7-1-17-9-5Z" fill="currentColor"/><circle cx="20" cy="22" r="3" fill="currentColor" opacity=".7"/></svg>',
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3 5.4 10.5L37 20l-11.6 6.5L20 37l-5.4-10.5L3 20l11.6-6.5L20 3Z" fill="currentColor"/><path d="m20 10 5 10-5 10-5-10 5-10Z" fill="currentColor" opacity=".58"/></svg>',
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M34.2 6.1C19.1 5 7.3 8.5 6.2 20.6c-.6 6.6 4.2 11.1 10.1 10.2 12.1-1.8 16.8-12.6 17.9-24.7Z" fill="currentColor"/><path d="M10 29c5-7 11.2-11.4 19.2-16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" opacity=".65"/></svg>',
  '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3 3.8 10.7L34.5 9l-4.7 10.7L40 23.5l-11.6 2.4 2.5 11.6-8.9-7.8L14 39l1.6-11.7L4 25.6l9.8-5.7L7.3 10.5 18.4 14 20 3Z" fill="currentColor"/><circle cx="20" cy="21" r="4" fill="currentColor"/></svg>'
];

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

const state = {
  board: createBoard(),
  score: 0,
  moves: MOVE_LIMIT,
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
  const notes = cascade > 1 ? [660, 784, 988] : [523, 659];
  notes.forEach((note, index) => playNote(note, 0.22, 0.09, index * 0.055));
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

function render({ swapCells = [], invalidCells = [], refillCells = [] } = {}) {
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
      if (invalidCells.includes(index)) button.classList.add("is-invalid");
      if (refillCells.includes(index)) button.classList.add("is-refilling");
      if (tile.special) button.classList.add(`is-special`, `is-special-${tile.special}`);
      button.dataset.index = String(index);
      button.setAttribute("aria-label", cellLabel(tile, row, column));
      button.innerHTML = `${pieceIcons[tile.type]}${tile.special ? '<span class="special-mark" aria-hidden="true">✦</span>' : ""}`;
      fragment.append(button);
    }
  }
  boardElement.replaceChildren(fragment);
  updateDashboard();
}

function updateDashboard() {
  scoreElement.textContent = formatScore(state.score);
  movesElement.textContent = String(state.moves);
  movesElement.classList.toggle("moves-value--low", state.moves <= 5);
  goalLabel.textContent = `${Math.min(state.score, SCORE_GOAL)} / ${SCORE_GOAL}`;
  progress.setAttribute("aria-valuenow", String(Math.min(state.score, SCORE_GOAL)));
  progressFill.style.transform = `scaleX(${Math.min(1, state.score / SCORE_GOAL)})`;
  bestElement.textContent = formatScore(state.best);
  soundButton.setAttribute("aria-label", state.muted ? "Turn sound on" : "Turn sound off");
  soundButton.classList.toggle("is-muted", state.muted);
}

function announce(message) {
  announcer.textContent = "";
  window.setTimeout(() => { announcer.textContent = message; }, 30);
}

function setHint(message, tone = "default") {
  hintElement.innerHTML = `${message}<span aria-hidden="true">${tone === "special" ? " ✧" : " ✦"}</span>`;
  hintElement.classList.toggle("hint-label--special", tone === "special");
}

function endGame(won) {
  state.ended = true;
  state.selected = null;
  render();
  overlay.hidden = false;
  document.querySelector("#result-kicker").textContent = won ? "THE GROVE IS GLOWING" : "THE STARS CAN WAIT";
  document.querySelector("#result-title").textContent = won ? "Beautifully done." : "One more try?";
  document.querySelector("#result-copy").textContent = won
    ? `You gathered ${formatScore(state.score)} stardust. What a lovely little constellation.`
    : `You gathered ${formatScore(state.score)} of ${SCORE_GOAL} stardust. Every grove grows with practice.`;
  announce(won ? "You win. The grove goal is complete." : "Game over. No moves remain.");
  playNote(won ? 784 : 330, 0.4, 0.12);
  if (won) playNote(988, 0.5, 0.1, 0.14);
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
  state.selected = null;
  state.busy = true;
  const specialSwap = Boolean(state.board[first[0]][first[1]].special || state.board[second[0]][second[1]].special);
  const legalSwap = isValidSwap(state.board, first, second);
  swapTiles(state.board, first, second);
  render({ swapCells: [firstIndex, secondIndex] });
  playNote(440, 0.12, 0.055);
  await delay(145);
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
    await delay(230);
    if (generation !== state.generation) return;
  }

  state.busy = false;
  render();

  if (state.score >= SCORE_GOAL) {
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

document.querySelector("#reset-button").addEventListener("click", restart);
document.querySelector("#play-again").addEventListener("click", restart);

function restart() {
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

render();

if (!hasPossibleMoves(state.board) || findMatches(state.board).size > 0) {
  state.board = createBoard();
  render();
}
