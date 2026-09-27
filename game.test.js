import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  MOVE_LIMIT,
  createBoard,
  findMatches,
  findRuns,
  hasPossibleMoves,
  isAdjacent,
  isValidSwap,
  resolveMatches,
  swapTiles
} from "./game.js";

function patternedBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => ({ type: (row + column) % 6, special: null }))
  );
}

test("finds horizontal, vertical, and intersecting matches", () => {
  const board = patternedBoard();
  board[2][1].type = 4;
  board[2][2].type = 4;
  board[2][3].type = 4;
  board[1][6].type = 2;
  board[2][6].type = 2;
  board[3][6].type = 2;
  board[5][2].type = 1;
  board[5][3].type = 1;
  board[5][4].type = 1;
  board[4][3].type = 1;
  board[6][3].type = 1;

  const matches = findMatches(board);
  assert.equal(matches.size, 11);
  assert.equal(findRuns(board).filter((run) => run.length === 3).length, 4);
});

test("validates adjacent swaps without leaving the board mutated", () => {
  const board = patternedBoard();
  board[0][0].type = 0;
  board[0][1].type = 1;
  board[0][2].type = 0;
  board[1][1].type = 0;
  const firstTile = board[0][1];

  assert.equal(isAdjacent([0, 0], [1, 0]), true);
  assert.equal(isAdjacent([0, 0], [1, 1]), false);
  assert.equal(isValidSwap(board, [0, 1], [1, 1]), true);
  assert.equal(board[0][1], firstTile);
  assert.equal(isValidSwap(board, [0, 0], [1, 0]), false);
  assert.equal(isValidSwap(board, [0, 0], [0, 3]), false);
});

test("creates a full board with no starting matches and at least one move", () => {
  const board = createBoard();
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(board.every((row) => row.length === BOARD_SIZE && row.every(Boolean)));
  assert.equal(findMatches(board).size, 0);
  assert.equal(hasPossibleMoves(board), true);

  const fallback = createBoard(() => 0);
  assert.equal(findMatches(fallback).size, 0);
  assert.equal(hasPossibleMoves(fallback), true);
});

test("clears a match, applies gravity, and refills every cell", () => {
  const board = patternedBoard();
  board[7][0].type = 5;
  board[7][1].type = 5;
  board[7][2].type = 5;

  const result = resolveMatches(board, () => 0);
  assert.equal(result.clearedCount, 3);
  assert.deepEqual(result.created, null);
  assert.deepEqual(result.typeCounts, [0, 0, 0, 0, 0, 3]);
  assert.equal(result.clearedCells.length, 3);
  assert.ok(board.every((row) => row.every((tile) => tile && Number.isInteger(tile.type))));
});

test("a refill can form and resolve a follow-on cascade", () => {
  const board = patternedBoard();
  board[7][0].type = 5;
  board[7][1].type = 5;
  board[7][2].type = 5;

  const first = resolveMatches(board, () => 0);
  assert.equal(first.clearedCount, 3);
  assert.equal(findMatches(board).size, 3);

  const second = resolveMatches(board, () => 0);
  assert.equal(second.clearedCount, 3);
  assert.equal(second.typeCounts[0], 3);
});

test("makes a line clearer from four and a wild piece from five", () => {
  const four = patternedBoard();
  [0, 1, 2, 3].forEach((column) => { four[7][column].type = 5; });
  four[7][4].type = 4;
  const line = resolveMatches(four, () => 0, [7, 1]);
  assert.deepEqual(line.created, { cell: [7, 1], special: "row", type: 5 });
  assert.equal(four[7][1].special, "row");
  assert.equal(line.clearedCount, 3);

  const five = patternedBoard();
  [0, 1, 2, 3, 4].forEach((column) => { five[7][column].type = 2; });
  const wild = resolveMatches(five, () => 0);
  assert.deepEqual(wild.created, { cell: [7, 2], special: "wild", type: 2 });
  assert.equal(five[7][2].special, "wild");
});

test("activates chained line-clearing specials without counting a tile twice", () => {
  const board = patternedBoard();
  board[7][0].type = 5;
  board[7][1] = { type: 5, special: "row" };
  board[7][2].type = 5;
  board[7][4] = { type: 4, special: "column" };

  const result = resolveMatches(board, () => 0);
  assert.equal(result.clearedCount, 15);
  assert.equal(result.clearedCells.length, 15);
  assert.equal(board.flat().length, BOARD_SIZE * BOARD_SIZE);
  assert.ok(board.flat().every(Boolean));
});

test("a wild piece clears every piece of its color", () => {
  const board = patternedBoard();
  board[7][0].type = 5;
  board[7][1] = { type: 5, special: "wild" };
  board[7][2].type = 5;
  const expected = board.flat().filter((tile) => tile.type === 5).length;

  const result = resolveMatches(board, () => 0);
  assert.equal(result.clearedCount, expected);
  assert.equal(result.clearedCells.length, expected);
  assert.ok(board.flat().every(Boolean));
});

test("swapping a special piece activates it even without a three-piece match", () => {
  const board = patternedBoard();
  board[0][0] = { type: 2, special: "row" };
  board[0][1] = { type: 4, special: null };
  const result = resolveMatches(board, () => 0, null, [[0, 0], [0, 1]]);

  assert.equal(result.clearedCount, BOARD_SIZE);
  assert.equal(result.clearedCells.includes(0), true);
  assert.equal(result.clearedCells.includes(1), true);
  assert.ok(board.flat().every(Boolean));
});

test("legal play keeps the board full and resolves every cascade", () => {
  let seed = 682731;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };

  for (let game = 0; game < 3; game += 1) {
    const board = createBoard(random);
    for (let move = 0; move < MOVE_LIMIT; move += 1) {
      const legalSwaps = [];
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let column = 0; column < BOARD_SIZE; column += 1) {
          if (column + 1 < BOARD_SIZE && isValidSwap(board, [row, column], [row, column + 1])) {
            legalSwaps.push([[row, column], [row, column + 1]]);
          }
          if (row + 1 < BOARD_SIZE && isValidSwap(board, [row, column], [row + 1, column])) {
            legalSwaps.push([[row, column], [row + 1, column]]);
          }
        }
      }
      if (legalSwaps.length === 0) break;

      const [first, second] = legalSwaps[Math.floor(random() * legalSwaps.length)];
      const forcedCells = board[first[0]][first[1]].special || board[second[0]][second[1]].special
        ? [first, second]
        : [];
      swapTiles(board, first, second);
      let cascade = 0;
      while (resolveMatches(board, random, cascade === 0 ? second : null, cascade === 0 ? forcedCells : [])) {
        cascade += 1;
        assert.ok(cascade <= BOARD_SIZE * BOARD_SIZE);
        assert.ok(board.every((row) => row.every(Boolean)));
      }

      assert.equal(findMatches(board).size, 0);
      if (!hasPossibleMoves(board)) {
        board.splice(0, board.length, ...createBoard(random));
      }
    }
  }
});

test("swaps the requested tiles in place", () => {
  const board = patternedBoard(2);
  const first = board[0][0];
  const second = board[0][1];
  swapTiles(board, [0, 0], [0, 1]);
  assert.equal(board[0][0], second);
  assert.equal(board[0][1], first);
});
