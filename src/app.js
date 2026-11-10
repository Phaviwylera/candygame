import {
  BOARD_SIZE,
  MAX_LEVEL,
  createLevelBoard,
  countObstacles,
  getLevelConfig,
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
const movesElement = document.querySelector("#rail-moves");
const railGoalElement = document.querySelector("#rail-goal");
const railCratesElement = document.querySelector("#rail-crates");
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
const boardLevelElement = document.querySelector("#board-level");
const heartsElement = document.querySelector("#hearts");
const heartClockElement = document.querySelector("#heart-clock");
const coinsElement = document.querySelector("#coins");
const introOverlay = document.querySelector("#level-intro");
const introKind = document.querySelector("#level-kind");
const introNumber = document.querySelector("#level-intro-number");
const introMoves = document.querySelector("#level-intro-moves");
const buyHeartsButton = document.querySelector("#buy-hearts");
const HEART_CAP = 5;
const HEART_REGEN_MS = 30 * 60 * 1000;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("astra-grove-town-progress") || "{}");
    return { level: Math.max(1, Math.min(MAX_LEVEL, Number(saved.level) || 1)), coins: saved.coins == null ? 250 : Math.max(0, Number(saved.coins) || 0), hearts: Math.max(0, Math.min(HEART_CAP, Number(saved.hearts ?? HEART_CAP))), heartAt: Number(saved.heartAt) || Date.now() };
  } catch { return { level: 1, coins: 250, hearts: HEART_CAP, heartAt: Date.now() }; }
}
const progressSave = loadProgress();

const state = {
  board: createLevelBoard(progressSave.level),
  score: 0,
  moves: getLevelConfig(progressSave.level).moves,
  level: progressSave.level,
  coins: progressSave.coins,
  hearts: progressSave.hearts,
  heartAt: progressSave.heartAt,
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
function goalForLevel() { return getLevelConfig(state.level).scoreGoal; }
function levelComplete() { return state.score >= goalForLevel() && countObstacles(state.board) === 0; }
function saveProgress() {
  const savedLevel = state.ended && levelComplete() ? Math.min(MAX_LEVEL, state.level + 1) : state.level;
  savePreference("astra-grove-town-progress", JSON.stringify({ level: savedLevel, coins: state.coins, hearts: state.hearts, heartAt: state.heartAt }));
}

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

function playPowerNote(special) {
  if (special === "row") { playNote(392, .3, .13); playNote(784, .32, .1, .04); }
  else if (special === "column") { playNote(330, .3, .12); playNote(880, .38, .1, .06); }
  else if (special === "bomb") { playNote(130, .36, .17); playNote(523, .3, .1, .05); }
  else if (special === "fish") { [659, 784, 988].forEach((frequency, index) => playNote(frequency, .14, .075, index * .055)); }
  else { [523, 659, 880, 1175].forEach((frequency, index) => playNote(frequency, .16, .08, index * .045)); }
}

function formatScore(score) {
  return String(score).padStart(4, "0");
}

function cellLabel(tile, row, column) {
  if (tile.obstacle) return `${tile.kind === "rope" ? "Rope-bound candy" : tile.kind === "ice" ? "Iced candy" : "Chocolate blocker"}, ${tile.hits} hits remaining, row ${row + 1}, column ${column + 1}`;
  const piece = pieceNames[tile.type];
  const special = tile.special
    ? `, ${tile.special === "wild" ? "starlight" : `line-clearing ${tile.special}`} special`
    : "";
  return `${piece}${special}, row ${row + 1}, column ${column + 1}`;
}

function render({ swapCells = [], invalidCells = [], swapOffsets = {}, fallOffsets = {} } = {}) {
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const index = row * BOARD_SIZE + column;
      const tile = state.board[row][column];
      if (tile.void) {
        const gap = document.createElement("div");
        gap.className = "void-space";
        gap.dataset.index = String(index);
        gap.setAttribute("aria-hidden", "true");
        fragment.append(gap);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = tile.obstacle ? `piece obstacle obstacle--${tile.kind ?? "crate"}` : `piece piece--${tile.type}`;
      if (tile.obstacle && tile.hits > 1) button.classList.add("obstacle--cracked");
      button.disabled = state.ended || tile.obstacle;
      if (state.selected === index) button.classList.add("is-selected");
      if (swapCells.includes(index)) button.classList.add("is-swapping");
      if (swapOffsets[index]) {
        button.style.setProperty("--swap-x", `${swapOffsets[index].x}px`);
        button.style.setProperty("--swap-y", `${swapOffsets[index].y}px`);
      }
      if (fallOffsets[index]) {
        button.classList.add("is-falling");
        button.style.setProperty("--fall-x", `${fallOffsets[index].x}px`);
        button.style.setProperty("--fall-y", `${fallOffsets[index].y}px`);
      }
      if (invalidCells.includes(index)) button.classList.add("is-invalid");
      if (tile.special) button.classList.add(`is-special`, `is-special-${tile.special}`);
      button.dataset.index = String(index);
      button.setAttribute("aria-label", cellLabel(tile, row, column));
      button.innerHTML = tile.obstacle ? tile.kind === "ice" ? '<span class="ice-art" aria-hidden="true"><i></i></span>' : tile.kind === "rope" ? '<span class="rope-art" aria-hidden="true"><i></i><i></i></span>' : '<span class="chocolate-art" aria-hidden="true"><i></i><i></i><i></i></span>' : `${pieceIcons[tile.type]}${tile.special ? `<span class="special-mark" aria-hidden="true">${tile.special === "bomb" ? "✹" : tile.special === "fish" ? "≈" : tile.special === "row" ? "↔" : tile.special === "column" ? "↕" : "✦"}</span>` : ""}`;
      fragment.append(button);
    }
  }
  boardElement.replaceChildren(fragment);
  updateDashboard();
}

function showLevelIntro() {
  const config = getLevelConfig(state.level);
  state.busy = true;
  introKind.textContent = config.difficulty.toUpperCase();
  introNumber.textContent = String(state.level);
  introMoves.textContent = `${config.moves} MOVES`;
  introOverlay.hidden = false;
  const generation = state.generation;
  window.setTimeout(() => {
    if (generation !== state.generation) return;
    introOverlay.hidden = true;
    state.busy = false;
    boardElement.querySelector(".piece:not(.obstacle)")?.focus();
  }, 1150);
}

function animateObstacleHits(cells) {
  for (const index of cells) {
    const cell = boardElement.querySelector(`[data-index="${index}"]`);
    if (cell?.classList.contains("obstacle")) cell.classList.add("obstacle-hit");
  }
}

function animatePowerEffects(activations = []) {
  let longest = 0;
  const boardRect = boardElement.getBoundingClientRect();
  if (activations.length) {
    boardElement.classList.remove("is-board-shaking");
    void boardElement.offsetWidth;
    boardElement.classList.add("is-board-shaking");
    window.setTimeout(() => boardElement.classList.remove("is-board-shaking"), 420);
  }
  for (const effect of activations) {
    const sourceIndex = effect.cell[0] * BOARD_SIZE + effect.cell[1];
    const source = boardElement.querySelector(`[data-index="${sourceIndex}"]`);
    if (!source) continue;
    const sourceRect = source.getBoundingClientRect();
    const x = sourceRect.left - boardRect.left + sourceRect.width / 2;
    const y = sourceRect.top - boardRect.top + sourceRect.height / 2;
    const effectNode = document.createElement("span");
    if (effect.special === "row" || effect.special === "column") {
      effectNode.className = `power-sweep power-sweep--${effect.special}`;
      effectNode.style.setProperty("--effect-x", `${x}px`);
      effectNode.style.setProperty("--effect-y", `${y}px`);
      boardElement.append(effectNode);
      window.setTimeout(() => effectNode.remove(), 430);
      playPowerNote(effect.special);
      longest = Math.max(longest, 390);
    } else if (effect.special === "fish" && effect.target) {
      const targetIndex = effect.target[0] * BOARD_SIZE + effect.target[1];
      const target = boardElement.querySelector(`[data-index="${targetIndex}"]`);
      if (!target) continue;
      const targetRect = target.getBoundingClientRect();
      effectNode.className = "fish-flight";
      effectNode.innerHTML = '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M4 16c7-10 21-13 31-4l9-7-2 11 2 11-9-7C25 29 11 26 4 16Z" fill="#ffe68a" stroke="#99509a" stroke-width="2.5"/><circle cx="30" cy="13" r="2" fill="#352d52"/><path d="M15 14c4 1 7 1 11 0" fill="none" stroke="#fff7ce" stroke-width="2" stroke-linecap="round"/></svg>';
      effectNode.style.left = `${x}px`;
      effectNode.style.top = `${y}px`;
      effectNode.style.setProperty("--fish-x", `${targetRect.left - sourceRect.left}px`);
      effectNode.style.setProperty("--fish-y", `${targetRect.top - sourceRect.top}px`);
      boardElement.append(effectNode);
      window.setTimeout(() => effectNode.remove(), 560);
      playPowerNote(effect.special);
      longest = Math.max(longest, 500);
    } else {
      effectNode.className = "power-burst";
      effectNode.style.left = `${x}px`;
      effectNode.style.top = `${y}px`;
      boardElement.append(effectNode);
      window.setTimeout(() => effectNode.remove(), 380);
      playPowerNote(effect.special);
      longest = Math.max(longest, 340);
    }
  }
  return longest;
}

function animateClears(clearedCells) {
  for (const index of clearedCells) {
    const piece = boardElement.querySelector(`[data-index="${index}"]`);
    if (!piece) continue;
    piece.disabled = true;
    piece.classList.add("is-clearing");
    piece.insertAdjacentHTML("beforeend", '<span class="match-burst" aria-hidden="true"><b></b><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>');
  }
}

function getFallOffsets(previousPositions) {
  const first = boardElement.querySelector('[data-index="0"]')?.getBoundingClientRect();
  const nextRow = boardElement.querySelector(`[data-index="${BOARD_SIZE}"]`)?.getBoundingClientRect();
  if (!first || !nextRow) return {};
  const rowStep = nextRow.top - first.top;
  const offsets = {};
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const index = row * BOARD_SIZE + column;
      const tile = state.board[row][column];
      const origin = previousPositions.get(tile);
      let dx;
      let dy;
      if (origin !== undefined) {
        const originPiece = boardElement.querySelector(`[data-index="${origin}"]`);
        const targetPiece = boardElement.querySelector(`[data-index="${index}"]`);
        if (!originPiece || !targetPiece) continue;
        const from = originPiece.getBoundingClientRect();
        const to = targetPiece.getBoundingClientRect();
        dx = from.left - to.left;
        dy = from.top - to.top;
      } else {
        dx = 0;
        dy = -(row + 1) * rowStep;
      }
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) offsets[index] = { x: dx, y: dy };
    }
  }
  return offsets;
}

function updateDashboard() {
  updateHearts();
  const goal = goalForLevel();
  const config = getLevelConfig(state.level);
  levelElement.textContent = String(state.level);
  boardLevelElement.textContent = String(state.level);
  document.querySelector("#difficulty-label").textContent = config.difficulty.toUpperCase();
  const obstaclesLeft = countObstacles(state.board);
  railGoalElement.textContent = String(goal);
  railCratesElement.textContent = String(obstaclesLeft);
  heartsElement.textContent = `${state.hearts}/${HEART_CAP}`;
  coinsElement.textContent = String(state.coins);
  buyHeartsButton.disabled = state.hearts >= HEART_CAP || state.coins < 250;
  const continueButton = document.querySelector("#play-again");
  continueButton.disabled = state.ended && state.hearts <= 0 && state.coins < 250;
  if (state.ended && state.score < goalForLevel() && state.hearts > 0) continueButton.innerHTML = 'Try again <span aria-hidden="true">↗</span>';
  const nextHeart = Math.max(0, HEART_REGEN_MS - (Date.now() - state.heartAt));
  heartClockElement.textContent = state.hearts >= HEART_CAP ? "FULL" : `${Math.floor(nextHeart / 60000)}:${String(Math.floor(nextHeart / 1000) % 60).padStart(2, "0")}`;
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
  if (won) {
    const reward = 60 + Math.min(state.level * 3, 90);
    state.coins += reward;
    document.querySelector("#result-kicker").textContent = `LEVEL ${state.level} COMPLETE · +${reward} COINS`;
    document.querySelector("#result-title").textContent = "Your grove is growing!";
    const finalLevel = state.level >= MAX_LEVEL;
    document.querySelector("#result-copy").textContent = finalLevel ? "You completed all 2,000 levels. Your grove is legendary!" : `Lovely work! Level ${state.level + 1} is ready when you are.`;
    document.querySelector("#play-again").innerHTML = finalLevel ? 'Play again <span aria-hidden="true">↗</span>' : `Level ${state.level + 1} <span aria-hidden="true">↗</span>`;
  } else {
    state.hearts = Math.max(0, state.hearts - 1);
    if (state.hearts === HEART_CAP - 1) state.heartAt = Date.now();
    document.querySelector("#result-kicker").textContent = "LEVEL NOT QUITE";
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
  announce(won ? `Level ${state.level} complete. Coins earned.` : "Level ended. A heart was used.");
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
    const previousPositions = new Map();
    state.board.forEach((line, row) => line.forEach((tile, column) => previousPositions.set(tile, row * BOARD_SIZE + column)));
    const result = resolveMatches(state.board, Math.random, preferredCell, cascade === 0 && specialSwap ? [first, second] : []);
    if (!result) break;
    const fallOffsets = getFallOffsets(previousPositions);
    cascade += 1;
    state.score += result.clearedCount * 10 * cascade;
    if (result.created) state.score += ["wild", "bomb"].includes(result.created.special) ? 50 : 30;
    if (state.score > state.best) {
      state.best = state.score;
      savePreference("astra-grove-best", String(state.best));
    }
    animateClears(result.clearedCells);
    animateObstacleHits(result.damagedCells ?? []);
    const effectDuration = Math.max(animatePowerEffects(result.activatedSpecials), result.damagedCells?.length ? 360 : 300);
    playMatch(cascade);
    setHint(
      result.created
        ? result.created.special === "wild" ? "A starlight piece appeared" : result.created.special === "bomb" ? "A wrapped burst appeared" : result.created.special === "fish" ? "A helpful fish appeared" : "A line-clearing piece appeared"
        : cascade > 1 ? `Lovely cascade ×${cascade}` : "A little more stardust",
      result.created ? "special" : "default"
    );
    announce(`${result.clearedCount} pieces cleared${cascade > 1 ? `, cascade ${cascade}` : ""}.`);
    preferredCell = null;
    await delay(Math.max(190, effectDuration));
    if (generation !== state.generation) return;
    render({ fallOffsets });
    await delay(430);
    if (generation !== state.generation) return;
  }

  state.busy = false;
  render();

  if (levelComplete()) {
    endGame(true);
  } else if (state.moves <= 0) {
    endGame(false);
  } else if (!hasPossibleMoves(state.board)) {
    state.board = createLevelBoard(state.level);
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
  const used = state.moves < getLevelConfig(state.level).moves || state.score > 0;
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
  if (levelComplete()) state.level = state.level >= MAX_LEVEL ? 1 : state.level + 1;
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
  state.board = createLevelBoard(state.level);
  state.score = 0;
  state.moves = getLevelConfig(state.level).moves;
  state.selected = null;
  state.busy = true;
  state.ended = false;
  overlay.hidden = true;
  setHint("Find a little magic");
  render();
  showLevelIntro();
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
if (state.hearts > 0) showLevelIntro();
else restart();
window.setInterval(updateDashboard, 1000);

if (!hasPossibleMoves(state.board) || findMatches(state.board).size > 0) {
  state.board = createLevelBoard(state.level);
  render();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

void prepareGameBreakAd();
