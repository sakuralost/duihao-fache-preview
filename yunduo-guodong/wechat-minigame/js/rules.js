(function (root) {
  var NS = root.JellyShop || (root.JellyShop = {});
  var COLS = 6;
  var ROWS = 9;
  var DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  function emptyGrid() {
    var grid = [];
    for (var c = 0; c < COLS; c++) {
      var col = [];
      for (var r = 0; r < ROWS; r++) col.push(null);
      grid.push(col);
    }
    return grid;
  }

  function cloneGrid(grid) {
    return grid.map(function (col) {
      return col.slice();
    });
  }

  function gridFromColumns(columns) {
    var grid = emptyGrid();
    for (var c = 0; c < COLS; c++) {
      var src = columns[c] || [];
      for (var r = 0; r < src.length && r < ROWS; r++) grid[c][r] = src[r];
    }
    return grid;
  }

  function inBounds(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }

  function lowestOccupied(grid, col) {
    for (var r = ROWS - 1; r >= 0; r--) {
      if (grid[col][r]) return r;
    }
    return -1;
  }

  // Bottom-most consecutive run, at most 5. Index 0 is the bottom piece.
  function peekRun(grid, col) {
    var bottom = lowestOccupied(grid, col);
    if (bottom < 0) return null;
    var type = grid[col][bottom];
    var run = [];
    for (var r = bottom; r >= 0; r--) {
      if (grid[col][r] !== type) break;
      if (run.length >= 5) break;
      run.push({ type: type, row: r });
    }
    return run;
  }

  function takeRun(grid, col) {
    var run = peekRun(grid, col);
    if (!run) return null;
    for (var i = 0; i < run.length; i++) grid[col][run[i].row] = null;
    return run;
  }

  // Rows from the contact cell downward. Null when the run would pass the bottom.
  function placeRows(grid, col, count) {
    var start = lowestOccupied(grid, col) + 1;
    if (start + count - 1 >= ROWS) return null;
    var rows = [];
    for (var i = 0; i < count; i++) rows.push(start + i);
    return rows;
  }

  function findGroups(grid) {
    var seen = emptyGrid();
    var groups = [];
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) {
        if (!grid[c][r] || seen[c][r]) continue;
        var type = grid[c][r];
        var stack = [{ c: c, r: r }];
        var cells = [];
        seen[c][r] = true;
        while (stack.length) {
          var cur = stack.pop();
          cells.push(cur);
          for (var d = 0; d < DIRS.length; d++) {
            var nc = cur.c + DIRS[d][0];
            var nr = cur.r + DIRS[d][1];
            if (!inBounds(nc, nr) || seen[nc][nr] || grid[nc][nr] !== type) continue;
            seen[nc][nr] = true;
            stack.push({ c: nc, r: nr });
          }
        }
        if (cells.length >= 3) groups.push(cells);
      }
    }
    return groups;
  }

  function planFalls(grid) {
    var moves = [];
    for (var c = 0; c < COLS; c++) {
      var pieces = [];
      for (var r = ROWS - 1; r >= 0; r--) {
        if (grid[c][r]) pieces.push(r);
      }
      var support = null;
      for (var i = 0; i < pieces.length; i++) {
        var from = pieces[i];
        var to = support === null ? from : support - 1;
        if (to !== from) moves.push({ col: c, from: from, to: to });
        support = to;
      }
    }
    return moves;
  }

  function applyFalls(grid) {
    var moves = planFalls(grid);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      grid[m.col][m.to] = grid[m.col][m.from];
      grid[m.col][m.from] = null;
    }
    return moves;
  }

  function removeCells(grid, cells) {
    for (var i = 0; i < cells.length; i++) grid[cells[i].c][cells[i].r] = null;
  }

  function resolve(grid) {
    var waves = 0;
    var maxGroup = 0;
    var guard = 24;
    while (guard--) {
      var groups = findGroups(grid);
      if (!groups.length) break;
      waves += 1;
      for (var g = 0; g < groups.length; g++) {
        if (groups[g].length > maxGroup) maxGroup = groups[g].length;
        removeCells(grid, groups[g]);
      }
      applyFalls(grid);
    }
    return { waves: waves, maxGroup: maxGroup };
  }

  function isEmpty(grid) {
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) if (grid[c][r]) return false;
    }
    return true;
  }

  function hashGrid(grid) {
    var parts = [];
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) parts.push(grid[c][r] || '.');
    }
    return parts.join('');
  }

  function applyMove(grid, from, to) {
    var next = cloneGrid(grid);
    var run = takeRun(next, from);
    if (!run) return null;
    var rows = placeRows(next, to, run.length);
    if (!rows) return null;
    for (var i = 0; i < run.length; i++) {
      next[to][rows[rows.length - 1 - i]] = run[i].type;
    }
    var resolved = resolve(next);
    return {
      grid: next,
      waves: resolved.waves,
      maxGroup: resolved.maxGroup,
      count: run.length
    };
  }

  function legalTargets(grid, from) {
    var run = peekRun(grid, from);
    if (!run) return [];
    var targets = [];
    var scratch = cloneGrid(grid);
    takeRun(scratch, from);
    for (var to = 0; to < COLS; to++) {
      if (to === from) continue;
      if (placeRows(scratch, to, run.length)) targets.push(to);
    }
    return targets;
  }

  NS.COLS = COLS;
  NS.ROWS = ROWS;
  NS.emptyGrid = emptyGrid;
  NS.cloneGrid = cloneGrid;
  NS.gridFromColumns = gridFromColumns;
  NS.lowestOccupied = lowestOccupied;
  NS.peekRun = peekRun;
  NS.takeRun = takeRun;
  NS.placeRows = placeRows;
  NS.findGroups = findGroups;
  NS.planFalls = planFalls;
  NS.applyFalls = applyFalls;
  NS.resolve = resolve;
  NS.isEmpty = isEmpty;
  NS.hashGrid = hashGrid;
  NS.applyMove = applyMove;
  NS.legalTargets = legalTargets;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : typeof globalThis !== 'undefined' ? globalThis : this);
