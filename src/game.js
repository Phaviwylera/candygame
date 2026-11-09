export const BOARD_SIZE = 8;
export const PIECE_TYPES = 6;
export const MOVE_LIMIT = 24;
export const SCORE_GOAL = 900;

const key = (row, column) => `${row},${column}`;

function makeTile(type, special = null) {
  return { type, special };
}

export function findRuns(board) {
  const runs = [];
  const size = board.length;

  for (let row = 0; row < size; row += 1) {
    let start = 0;
    while (start < size) {
      const tile = board[row][start];
      if (!tile) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < size && board[row][end]?.type === tile.type) end += 1;
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
      if (!tile) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (end < size && board[end][column]?.type === tile.type) end += 1;
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
  if (!firstTile || !secondTile) return false;
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
          !(row >= 2 && board[row - 1][column].type === type && board[row - 2][column].type === type)
        );
        line.push(makeTile(available[Math.floor(random() * available.length)]));
      }
      board.push(line);
    }
    if (hasPossibleMoves(board)) return board;
  }
  return makeFallbackBoard(size);
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
      run.cells.some(([row, column]) => row === preferredCell[0] && column === preferredCell[1] && !board[row][column].special);
    const availableCells = run.cells.filter(([row, column]) => !board[row][column].special);
    if (availableCells.length > 0) {
      const [row, column] = preferredIsAvailable
        ? preferredCell
        : availableCells[Math.floor(availableCells.length / 2)];
      created = {
        cell: [row, column],
        special: run.length >= 5 ? "wild" : run.axis,
        type: board[row][column].type
      };
      matched.delete(key(row, column));
    }
  }

  const cleared = new Set(matched);
  const queue = [];
  const activatedTiles = new Set();
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
    if (!tile) continue;
    if (tile.special === "row") {
      for (let nextColumn = 0; nextColumn < board[row].length; nextColumn += 1) cleared.add(key(row, nextColumn));
    } else if (tile.special === "column") {
      for (let nextRow = 0; nextRow < board.length; nextRow += 1) cleared.add(key(nextRow, column));
    } else if (tile.special === "wild") {
      for (let nextRow = 0; nextRow < board.length; nextRow += 1) {
        for (let nextColumn = 0; nextColumn < board[nextRow].length; nextColumn += 1) {
          if (board[nextRow][nextColumn]?.type === tile.type) cleared.add(key(nextRow, nextColumn));
        }
      }
    }

    for (const cellKey of cleared) {
      const [nextRow, nextColumn] = cellKey.split(",").map(Number);
      const candidate = board[nextRow][nextColumn];
      if (candidate?.special && !activatedTiles.has(cellKey) && !queue.some(([queuedRow, queuedColumn]) => queuedRow === nextRow && queuedColumn === nextColumn)) {
        queue.push([nextRow, nextColumn]);
        activatedTiles.add(cellKey);
      }
    }
  }

  if (created) board[created.cell[0]][created.cell[1]].special = created.special;
  const typeCounts = Array(PIECE_TYPES).fill(0);
  const clearedCells = [];
  let clearedCount = 0;
  for (const cellKey of cleared) {
    const [row, column] = cellKey.split(",").map(Number);
    const tile = board[row][column];
    if (tile) {
      typeCounts[tile.type] += 1;
      clearedCount += 1;
      clearedCells.push(row * board[0].length + column);
      board[row][column] = null;
    }
  }

  for (let column = 0; column < board[0].length; column += 1) {
    const remaining = [];
    for (let row = board.length - 1; row >= 0; row -= 1) {
      if (board[row][column]) remaining.push(board[row][column]);
    }
    while (remaining.length < board.length) {
      remaining.push(makeTile(Math.floor(random() * PIECE_TYPES)));
    }
    for (let row = board.length - 1; row >= 0; row -= 1) {
      board[row][column] = remaining[board.length - 1 - row];
    }
  }

  return { clearedCount, typeCounts, clearedCells, created };
}
