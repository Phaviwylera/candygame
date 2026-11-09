export const BOARD_SIZE = 8;
export const PIECE_TYPES = 6;
export const MOVE_LIMIT = 24;
export const SCORE_GOAL = 900;
export const MAX_LEVEL = 2000;

const key = (row, column) => `${row},${column}`;

function makeTile(type, special = null) {
  return { type, special };
}

export function getLevelConfig(level) {
  const current = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (current <= 100) {
    const progress = (current - 1) / 99;
    return { level: current, difficulty: "Easy", moves: 25, scoreGoal: Math.round(420 + progress * 200), obstacleCount: current < 8 ? 0 : Math.floor(progress * 3) + 1 };
  }
  if (current <= 350) {
    const progress = (current - 101) / 249;
    return { level: current, difficulty: "Medium", moves: 22, scoreGoal: Math.round(620 + progress * 160), obstacleCount: 2 + Math.floor(progress * 2) };
  }
  if (current <= 800) {
    const progress = (current - 351) / 449;
    return { level: current, difficulty: "Hard", moves: 19, scoreGoal: Math.round(780 + progress * 170), obstacleCount: 4 + Math.floor(progress * 3) };
  }
  const progress = (current - 801) / (MAX_LEVEL - 801);
  return { level: current, difficulty: "Super Hard", moves: 17 - Math.floor(progress * 6), scoreGoal: Math.round(900 + progress * 250), obstacleCount: 7 + Math.floor(progress * 7) };
}

export function countObstacles(board) {
  return board.reduce((total, row) => total + row.filter((tile) => tile?.obstacle).length, 0);
}

export function findRuns(board) {
  const runs = [];
  const size = board.length;

  for (let row = 0; row < size; row += 1) {
    let start = 0;
    while (start < size) {
      const tile = board[row][start];
      if (!tile || tile.obstacle) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < size && !board[row][end]?.obstacle && board[row][end]?.type === tile.type) end += 1;
      if (end - start >= 3) {
        runs.push({
          axis: "row",
          type: tile.type,
          length: end - start,
          cells: Array.from({ length: end - start }, (_, offset) => [row, start + offset])
        });
      }
      start = end;
    }
  }

  for (let column = 0; column < size; column += 1) {
    let start = 0;
    while (start < size) {
      const tile = board[start][column];
      if (!tile || tile.obstacle) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < size && !board[end][column]?.obstacle && board[end][column]?.type === tile.type) end += 1;
      if (end - start >= 3) {
        runs.push({
          axis: "column",
          type: tile.type,
          length: end - start,
          cells: Array.from({ length: end - start }, (_, offset) => [start + offset, column])
        });
      }
      start = end;
    }
  }

  const horizontal = runs.filter((run) => run.axis === "row");
  const vertical = runs.filter((run) => run.axis === "column");
  for (const rowRun of horizontal) {
    for (const columnRun of vertical) {
      if (rowRun.type !== columnRun.type) continue;
      const intersections = rowRun.cells.filter(([row, column]) => columnRun.cells.some(([otherRow, otherColumn]) => row === otherRow && column === otherColumn));
      if (intersections.length === 0) continue;
      const cells = new Map([...rowRun.cells, ...columnRun.cells].map(([row, column]) => [key(row, column), [row, column]]));
      if (cells.size >= 5) runs.push({ axis: "wrapped", type: rowRun.type, length: cells.size, cells: [...cells.values()] });
    }
  }
  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const cells = [[row, column], [row + 1, column], [row, column + 1], [row + 1, column + 1]];
      const first = board[row][column];
      if (first && !first.obstacle && cells.slice(1).every(([r, c]) => !board[r][c]?.obstacle && board[r][c]?.type === first.type)) {
        runs.push({ axis: "square", type: first.type, length: 4, cells });
      }
    }
  }
  return runs;
}

export function findMatches(board) {
  return new Set(findRuns(board).flatMap((run) => run.cells.map(([row, column]) => key(row, column))));
}

export function swapTiles(board, first, second) {
  const [firstRow, firstColumn] = first;
  const [secondRow, secondColumn] = second;
  [board[firstRow][firstColumn], board[secondRow][secondColumn]] =
    [board[secondRow][secondColumn], board[firstRow][firstColumn]];
}

export function isAdjacent(first, second) {
  return Math.abs(first[0] - second[0]) + Math.abs(first[1] - second[1]) === 1;
}

export function isValidSwap(board, first, second) {
  if (!isAdjacent(first, second)) return false;
  const firstTile = board[first[0]][first[1]];
  const secondTile = board[second[0]][second[1]];
  if (!firstTile || !secondTile || firstTile.obstacle || secondTile.obstacle) return false;
  if (firstTile.special || secondTile.special) return true;

  swapTiles(board, first, second);
  const valid = findMatches(board).size > 0;
  swapTiles(board, first, second);
  return valid;
}

export function hasPossibleMoves(board) {
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      if (column + 1 < board[row].length && isValidSwap(board, [row, column], [row, column + 1])) return true;
      if (row + 1 < board.length && isValidSwap(board, [row, column], [row + 1, column])) return true;
    }
  }
  return false;
}

function makeFallbackBoard(size) {
  const board = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => makeTile((row + column) % PIECE_TYPES))
  );
  board[0][1] = makeTile(1);
  board[1][1] = makeTile(0);
  return board;
}

export function createBoard(random = Math.random, size = BOARD_SIZE) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const board = [];
    for (let row = 0; row < size; row += 1) {
      const line = [];
      for (let column = 0; column < size; column += 1) {
        const available = Array.from({ length: PIECE_TYPES }, (_, type) => type).filter((type) =>
          !(column >= 2 && line[column - 1].type === type && line[column - 2].type === type) &&
          !(row >= 2 && board[row - 1][column].type === type && board[row - 2][column].type === type) &&
          !(row >= 1 && column >= 1 && line[column - 1].type === type && board[row - 1][column].type === type && board[row - 1][column - 1].type === type)
        );
        line.push(makeTile(available[Math.floor(random() * available.length)]));
      }
      board.push(line);
    }
    if (hasPossibleMoves(board) && findMatches(board).size === 0) return board;
  }
  return makeFallbackBoard(size);
}

export function createLevelBoard(levelOrConfig, random = Math.random, size = BOARD_SIZE) {
  const config = typeof levelOrConfig === "number" ? getLevelConfig(levelOrConfig) : levelOrConfig;
  const cells = [];
  for (let row = 1; row < size - 1; row += 1) {
    for (let column = 1; column < size - 1; column += 1) cells.push([row, column]);
  }
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const board = createBoard(random, size);
    const ordered = [...cells].sort((a, b) => {
      const rank = ([row, column]) => ((row * 37 + column * 19 + config.level * 13 + attempt * 29) % 101);
      return rank(a) - rank(b);
    });
    ordered.slice(0, config.obstacleCount).forEach(([row, column]) => {
      board[row][column] = { type: null, special: null, obstacle: true, hits: config.difficulty === "Super Hard" && config.level >= 1200 && (row + column + config.level) % 3 === 0 ? 2 : 1 };
    });
    if (hasPossibleMoves(board)) return board;
  }
  return createBoard(random, size);
}

function chooseFishTarget(board, excluded, source) {
  let best = null;
  let bestScore = -Infinity;
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const cellKey = key(row, column);
      const tile = board[row][column];
      if (!tile || tile.obstacle || excluded.has(cellKey) || (row === source[0] && column === source[1])) continue;
      let obstacleNeighbors = 0;
      let colorNeighbors = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const neighbor = board[row + dr]?.[column + dc];
        if (neighbor?.obstacle) obstacleNeighbors += 1;
        if (neighbor && !neighbor.obstacle && neighbor.type === tile.type) colorNeighbors += 1;
      }
      const score = obstacleNeighbors * 100 + (tile.special ? 60 : 0) + colorNeighbors * 8;
      if (score > bestScore) { bestScore = score; best = [row, column]; }
    }
  }
  return best;
}

export function resolveMatches(board, random = Math.random, preferredCell = null, forcedCells = []) {
  const runs = findRuns(board);
  if (runs.length === 0 && forcedCells.length === 0) return null;

  const matched = new Set(runs.flatMap((run) => run.cells.map(([row, column]) => key(row, column))));
  forcedCells.forEach(([row, column]) => matched.add(key(row, column)));
  const specialRuns = runs.filter((run) => run.length >= 4).sort((first, second) => second.length - first.length);
  let created = null;

  if (specialRuns.length > 0) {
    const run = specialRuns.find((candidate) =>
      preferredCell && candidate.cells.some(([row, column]) => row === preferredCell[0] && column === preferredCell[1])
    ) ?? specialRuns[0];
    const preferredIsAvailable = preferredCell &&
      run.cells.some(([row, column]) => row === preferredCell[0] && column === preferredCell[1] && !board[row][column].special && !board[row][column].obstacle);
    const availableCells = run.cells.filter(([row, column]) => !board[row][column].special && !board[row][column].obstacle);
    if (availableCells.length > 0) {
      const [row, column] = preferredIsAvailable
        ? preferredCell
        : availableCells[Math.floor(availableCells.length / 2)];
      const special = run.axis === "square" ? "fish" : run.axis === "wrapped" ? "bomb" : run.length >= 5 ? "wild" : run.axis;
      created = {
        cell: [row, column],
        special,
        type: board[row][column].type
      };
      matched.delete(key(row, column));
    }
  }

  const cleared = new Set(matched);
  const queue = [];
  const activatedTiles = new Set();
  const activatedSpecials = [];
  const addCandy = (row, column) => {
    const tile = board[row]?.[column];
    if (tile && !tile.obstacle) cleared.add(key(row, column));
  };
  for (const cellKey of matched) {
    const [row, column] = cellKey.split(",").map(Number);
    if (board[row][column]?.special) {
      queue.push([row, column]);
      activatedTiles.add(cellKey);
    }
  }

  while (queue.length > 0) {
    const [row, column] = queue.pop();
    const tile = board[row][column];
    if (!tile || tile.obstacle) continue;
    const activation = { cell: [row, column], special: tile.special, target: null };
    activatedSpecials.push(activation);
    if (tile.special === "row") {
      for (let nextColumn = 0; nextColumn < board[row].length; nextColumn += 1) addCandy(row, nextColumn);
    } else if (tile.special === "column") {
      for (let nextRow = 0; nextRow < board.length; nextRow += 1) addCandy(nextRow, column);
    } else if (tile.special === "bomb") {
      for (let nextRow = row - 1; nextRow <= row + 1; nextRow += 1) {
        for (let nextColumn = column - 1; nextColumn <= column + 1; nextColumn += 1) addCandy(nextRow, nextColumn);
      }
    } else if (tile.special === "fish") {
      activation.target = chooseFishTarget(board, cleared, [row, column]);
      if (activation.target) addCandy(...activation.target);
    } else if (tile.special === "wild") {
      for (let nextRow = 0; nextRow < board.length; nextRow += 1) {
        for (let nextColumn = 0; nextColumn < board[nextRow].length; nextColumn += 1) {
          if (!board[nextRow][nextColumn]?.obstacle && board[nextRow][nextColumn]?.type === tile.type) addCandy(nextRow, nextColumn);
        }
      }
    }

    for (const cellKey of cleared) {
      const [nextRow, nextColumn] = cellKey.split(",").map(Number);
      const candidate = board[nextRow][nextColumn];
      if (candidate?.special && !candidate.obstacle && !activatedTiles.has(cellKey) && !queue.some(([queuedRow, queuedColumn]) => queuedRow === nextRow && queuedColumn === nextColumn)) {
        queue.push([nextRow, nextColumn]);
        activatedTiles.add(cellKey);
      }
    }
  }

  if (created) board[created.cell[0]][created.cell[1]].special = created.special;
  const obstacleDamage = new Set();
  for (const cellKey of cleared) {
    const [row, column] = cellKey.split(",").map(Number);
    const tile = board[row][column];
    if (!tile || tile.obstacle) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (board[row + dr]?.[column + dc]?.obstacle) obstacleDamage.add(key(row + dr, column + dc));
    }
  }
  const typeCounts = Array(PIECE_TYPES).fill(0);
  const clearedCells = [];
  let clearedCount = 0;
  let obstaclesRemoved = 0;
  const damagedCells = [];
  for (const cellKey of cleared) {
    const [row, column] = cellKey.split(",").map(Number);
    const tile = board[row][column];
    if (tile && !tile.obstacle) {
      typeCounts[tile.type] += 1;
      clearedCount += 1;
      clearedCells.push(row * board[0].length + column);
      board[row][column] = null;
    }
  }
  for (const cellKey of obstacleDamage) {
    const [row, column] = cellKey.split(",").map(Number);
    const obstacle = board[row][column];
    if (!obstacle?.obstacle) continue;
    obstacle.hits -= 1;
    damagedCells.push(row * board[0].length + column);
    if (obstacle.hits <= 0) {
      board[row][column] = null;
      clearedCells.push(row * board[0].length + column);
      obstaclesRemoved += 1;
    }
  }

  for (let column = 0; column < board[0].length; column += 1) {
    let bottom = board.length - 1;
    while (bottom >= 0) {
      if (board[bottom][column]?.obstacle) { bottom -= 1; continue; }
      let top = bottom;
      while (top >= 0 && !board[top][column]?.obstacle) top -= 1;
      const segmentTop = top + 1;
      const remaining = [];
      for (let row = bottom; row >= segmentTop; row -= 1) if (board[row][column]) remaining.push(board[row][column]);
      while (remaining.length < bottom - segmentTop + 1) remaining.push(makeTile(Math.floor(random() * PIECE_TYPES)));
      for (let row = bottom; row >= segmentTop; row -= 1) board[row][column] = remaining[bottom - row];
      bottom = top - 1;
    }
  }

  return { clearedCount, typeCounts, clearedCells, created, activatedSpecials, obstaclesRemoved, damagedCells };
}
