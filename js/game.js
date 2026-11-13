const CONFIG = {
  cols: 10,
  rows: 20,
  cell: 32,
  previewCell: 28,
  maxStage: 15,
  linesPerStage: 10,
  baseDropInterval: 900,
  speedStep: 0.3,
  minDropInterval: 150,
  randomSpeedStageStart: 11,
  randomSpeedMin: 1.5,
  randomSpeedMax: 2.5,
  stagePause: 950,
  highScoreKey: 'tetris-palace-high-score-v2'
};

const PIECES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

const PIECE_COLORS = {
  I: '#5fdfff',
  O: '#ffd86c',
  T: '#c895ff',
  S: '#70f0a5',
  Z: '#ff7b87',
  J: '#6ea8ff',
  L: '#ffb46c'
};

const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 700,
  4: 1500
};

const safeStorage = {
  getHighScore() {
    try {
      return Number(window.localStorage.getItem(CONFIG.highScoreKey) || 0);
    } catch (error) {
      return Number(window.__tetrisPalaceFallbackHighScore || 0);
    }
  },
  setHighScore(value) {
    try {
      window.localStorage.setItem(CONFIG.highScoreKey, String(value));
    } catch (error) {
      window.__tetrisPalaceFallbackHighScore = String(value);
    }
  }
};

function padScore(value) {
  return String(Math.max(0, Math.floor(value))).padStart(7, '0');
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function createBoard() {
  return Array.from({ length: CONFIG.rows }, () => Array(CONFIG.cols).fill(0));
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  const result = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      result[x][size - 1 - y] = matrix[y][x];
    }
  }
  return result;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value;
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function tint(hex, amount) {
  const rgb = hexToRgb(hex);
  const adjusted = {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount
  };
  return rgbToHex(adjusted);
}

function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  const adjusted = {
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount)
  };
  return rgbToHex(adjusted);
}

function randomStageMultiplier() {
  const span = CONFIG.randomSpeedMax - CONFIG.randomSpeedMin;
  return Number((CONFIG.randomSpeedMin + Math.random() * span).toFixed(1));
}

function calculateStageSpeed(stage, lateStageMultipliers = {}) {
  let multiplier;
  if (stage < CONFIG.randomSpeedStageStart) {
    multiplier = Number((1 + (stage - 1) * CONFIG.speedStep).toFixed(1));
  } else {
    if (!lateStageMultipliers[stage]) {
      lateStageMultipliers[stage] = randomStageMultiplier();
    }
    multiplier = lateStageMultipliers[stage];
  }

  const interval = Math.max(CONFIG.minDropInterval, Math.round(CONFIG.baseDropInterval / multiplier));
  return {
    multiplier,
    interval
  };
}

class Bag {
  constructor() {
    this.queue = [];
  }

  next() {
    if (this.queue.length === 0) {
      this.queue = shuffle(Object.keys(PIECES));
    }
    return this.queue.pop();
  }
}

class TetrisPlayer {
  constructor(config) {
    this.id = config.id;
    this.label = config.label;
    this.canvas = config.canvas;
    this.ctx = this.canvas.getContext('2d');
    this.previewCanvas = config.previewCanvas;
    this.previewCtx = this.previewCanvas.getContext('2d');
    this.controls = config.controls;
    this.messageEl = config.messageEl;
    this.statusEl = config.statusEl;
    this.dom = config.dom;
    this.reset();
  }

  reset() {
    this.board = createBoard();
    this.bag = new Bag();
    this.score = 0;
    this.totalLines = 0;
    this.stage = 1;
    this.stageProgress = 0;
    this.lateStageMultipliers = {};
    this.speedMultiplier = 1;
    this.dropInterval = CONFIG.baseDropInterval;
    this.applyStageSpeed();
    this.dropCounter = 0;
    this.freezeTimer = 0;
    this.status = 'READY';
    this.active = true;
    this.gameOver = false;
    this.won = false;
    this.pendingSoftDrop = false;
    this.skipSpawnOnce = false;
    this.nextType = this.bag.next();
    this.current = null;
    this.spawnPiece();
    this.setBadge('READY', 'ready');
    this.setStateText('WAITING', 'RANK READY');
    this.hideMessage();
    this.updateInfo(true);
    this.draw();
  }

  applyStageSpeed() {
    const stageSpeed = calculateStageSpeed(this.stage, this.lateStageMultipliers);
    this.speedMultiplier = stageSpeed.multiplier;
    this.dropInterval = stageSpeed.interval;
  }

  resetStageBoard() {
    this.board = createBoard();
    this.bag = new Bag();
    this.dropCounter = 0;
    this.pendingSoftDrop = false;
    this.nextType = this.bag.next();
    this.current = null;
    this.spawnPiece();
    this.skipSpawnOnce = true;
  }

  createPiece(type) {
    const matrix = cloneMatrix(PIECES[type]);
    return {
      type,
      matrix,
      x: Math.floor(CONFIG.cols / 2) - Math.ceil(matrix[0].length / 2),
      y: -1
    };
  }

  spawnPiece() {
    const type = this.nextType;
    this.current = this.createPiece(type);
    this.nextType = this.bag.next();
    if (this.collides(this.current)) {
      this.endGame(false);
    }
  }

  collides(piece) {
    const { matrix, x: offsetX, y: offsetY } = piece;
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        const boardX = offsetX + x;
        const boardY = offsetY + y;
        if (boardX < 0 || boardX >= CONFIG.cols || boardY >= CONFIG.rows) {
          return true;
        }
        if (boardY < 0) continue;
        if (this.board[boardY][boardX]) {
          return true;
        }
      }
    }
    return false;
  }

  mergePiece() {
    const { matrix, x: offsetX, y: offsetY, type } = this.current;
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        const boardY = offsetY + y;
        if (boardY < 0) {
          this.endGame(false);
          return;
        }
        this.board[boardY][offsetX + x] = type;
      }
    }

    this.skipSpawnOnce = false;
    this.clearLines();
    if (!this.gameOver && !this.won) {
      if (this.skipSpawnOnce) {
        this.skipSpawnOnce = false;
      } else {
        this.spawnPiece();
      }
    }
    this.updateInfo();
    this.draw();
  }

  clearLines() {
    let cleared = 0;
    outer: for (let y = this.board.length - 1; y >= 0; y -= 1) {
      for (let x = 0; x < CONFIG.cols; x += 1) {
        if (!this.board[y][x]) {
          continue outer;
        }
      }
      const removed = this.board.splice(y, 1)[0];
      removed.fill(0);
      this.board.unshift(removed);
      cleared += 1;
      y += 1;
    }

    if (cleared > 0) {
      this.totalLines += cleared;
      this.stageProgress += cleared;
      this.score += (SCORE_TABLE[cleared] || 0) * this.stage;
      game.updateHighScore(this.score);
      this.showMessage(cleared === 4 ? 'TETRIS!' : `${cleared} LINE CLEAR!`, 680);

      while (this.stageProgress >= CONFIG.linesPerStage && !this.won && !this.gameOver) {
        if (this.stage >= CONFIG.maxStage) {
          this.stageProgress = CONFIG.linesPerStage;
          this.endGame(true);
          return cleared;
        }
        this.stageProgress -= CONFIG.linesPerStage;
        const clearedStage = this.stage;
        this.stage += 1;
        this.applyStageSpeed();
        this.resetStageBoard();
        this.freezeTimer += CONFIG.stagePause;
        const randomLabel = this.stage >= CONFIG.randomSpeedStageStart
          ? `  SPEED ${this.speedMultiplier.toFixed(1)}x RANDOM`
          : `  SPEED ${this.speedMultiplier.toFixed(1)}x`;
        this.showMessage(`STAGE ${clearedStage} CLEAR → ${this.stage}${randomLabel}`, 1400);
      }
    }

    return cleared;
  }

  move(direction) {
    if (!this.canAct()) return false;
    this.current.x += direction;
    if (this.collides(this.current)) {
      this.current.x -= direction;
      return false;
    }
    this.draw();
    return true;
  }

  rotate() {
    if (!this.canAct()) return false;
    const originalMatrix = this.current.matrix;
    const originalX = this.current.x;
    const rotated = rotateMatrix(originalMatrix);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      this.current.matrix = rotated;
      this.current.x = originalX + kick;
      if (!this.collides(this.current)) {
        this.draw();
        return true;
      }
    }
    this.current.matrix = originalMatrix;
    this.current.x = originalX;
    return false;
  }

  softDrop() {
    this.pendingSoftDrop = true;
  }

  hardDrop() {
    if (!this.canAct()) return false;
    let distance = 0;
    while (!this.collides({ ...this.current, y: this.current.y + 1 })) {
      this.current.y += 1;
      distance += 1;
    }
    if (distance > 0) {
      this.score += distance * 2;
      game.updateHighScore(this.score);
    }
    this.mergePiece();
    return true;
  }

  stepDown(manualBonus = false) {
    if (!this.canAct()) return false;
    this.current.y += 1;
    if (this.collides(this.current)) {
      this.current.y -= 1;
      this.mergePiece();
      return false;
    }
    if (manualBonus) {
      this.score += 1;
      game.updateHighScore(this.score);
    }
    this.updateInfo();
    this.draw();
    return true;
  }

  canAct() {
    return this.active && !this.gameOver && !this.won && game.state === 'playing';
  }

  update(delta) {
    if (!this.active || this.gameOver || this.won || game.state !== 'playing') {
      return;
    }

    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - delta);
      return;
    }

    const accelerated = this.pendingSoftDrop;
    const interval = accelerated ? Math.max(46, this.dropInterval * 0.08) : this.dropInterval;
    this.dropCounter += delta;

    while (this.dropCounter >= interval) {
      this.dropCounter -= interval;
      const moved = this.stepDown(accelerated);
      if (!moved) {
        break;
      }
    }
  }

  releaseSoftDrop() {
    this.pendingSoftDrop = false;
  }

  endGame(isWin) {
    this.active = false;
    this.gameOver = !isWin;
    this.won = isWin;
    if (isWin) {
      this.status = 'VICTORY';
      this.setBadge('VICTORY', 'win');
      this.setStateText('STAGE 15 CLEAR', 'RANK PALACE CHAMP');
      this.showMessage('ALL 15 STAGES CLEAR!', 2400);
    } else {
      this.status = 'GAME OVER';
      this.setBadge('GAME OVER', 'over');
      this.setStateText('TOP OUT', `RANK STAGE ${this.stage}`);
      this.showMessage('GAME OVER', 1800);
    }
    this.updateInfo();
    this.draw();
    game.handlePlayerEnd();
  }

  showMessage(text, duration = 900) {
    const span = this.messageEl.querySelector('span');
    span.textContent = text;
    this.messageEl.classList.add('visible');
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.messageEl.classList.remove('visible');
    }, duration);
  }

  hideMessage() {
    clearTimeout(this.messageTimer);
    this.messageEl.classList.remove('visible');
  }

  setBadge(text, theme) {
    this.statusEl.textContent = text;
    this.statusEl.className = `status-badge status-${theme}`;
  }

  setStateText(main, sub) {
    this.dom.state.textContent = main;
    this.dom.rank.textContent = sub;
  }

  updateInfo(forcePlayingBadge = false) {
    this.dom.score.textContent = this.score.toLocaleString('ko-KR');
    this.dom.lines.textContent = `LINES ${this.totalLines}`;
    this.dom.stage.textContent = String(this.stage);
    this.dom.goal.textContent = this.won
      ? `GOAL ${CONFIG.linesPerStage} / ${CONFIG.linesPerStage}`
      : `GOAL ${this.stageProgress} / ${CONFIG.linesPerStage}`;
    const speedRate = this.speedMultiplier.toFixed(1);
    this.dom.speed.textContent = `${speedRate}x`;
    this.dom.drop.textContent = `DROP ${this.dropInterval}ms`;
    if (forcePlayingBadge) {
      this.setBadge('PLAYING', 'playing');
      this.setStateText(`STAGE ${this.stage}`, `RANK ${this.label}`);
    } else if (this.active && !this.gameOver && !this.won && game.state === 'playing') {
      this.setBadge('PLAYING', 'playing');
      this.setStateText(`STAGE ${this.stage}`, `RANK ${this.label}`);
    } else if (this.active && game.state === 'paused') {
      this.setBadge('PAUSED', 'paused');
      this.setStateText('PAUSE', `RANK STAGE ${this.stage}`);
    }
    this.drawPreview();
  }

  drawBlock(ctx, x, y, type, cellSize, alpha = 1) {
    const color = PIECE_COLORS[type];
    const px = x * cellSize;
    const py = y * cellSize;
    const light = tint(color, 0.45);
    const dark = shade(color, 0.4);
    const shadow = shade(color, 0.62);

    ctx.save();
    ctx.globalAlpha = alpha;
    const gradient = ctx.createLinearGradient(px, py, px + cellSize, py + cellSize);
    gradient.addColorStop(0, light);
    gradient.addColorStop(0.48, color);
    gradient.addColorStop(1, dark);
    ctx.fillStyle = gradient;
    ctx.fillRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);

    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(px + 5, py + 5, cellSize - 10, Math.max(5, cellSize * 0.18));

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 3, py + cellSize - 4);
    ctx.lineTo(px + 3, py + 3);
    ctx.lineTo(px + cellSize - 4, py + 3);
    ctx.stroke();

    ctx.strokeStyle = shade(color, 0.55);
    ctx.beginPath();
    ctx.moveTo(px + cellSize - 3, py + 4);
    ctx.lineTo(px + cellSize - 3, py + cellSize - 3);
    ctx.lineTo(px + 4, py + cellSize - 3);
    ctx.stroke();

    ctx.strokeStyle = shadow;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
    ctx.restore();
  }

  drawGridBackground(ctx, width, height, cellSize) {
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, 'rgba(10, 16, 42, 0.96)');
    background.addColorStop(1, 'rgba(4, 8, 18, 0.98)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(98, 131, 255, 0.05)';
    ctx.fillRect(0, 0, width, height * 0.25);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }
  }

  getGhostY() {
    const ghost = {
      ...this.current,
      matrix: this.current.matrix.map((row) => row.slice())
    };
    while (!this.collides({ ...ghost, y: ghost.y + 1 })) {
      ghost.y += 1;
    }
    return ghost.y;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGridBackground(ctx, this.canvas.width, this.canvas.height, CONFIG.cell);

    for (let y = 0; y < this.board.length; y += 1) {
      for (let x = 0; x < this.board[y].length; x += 1) {
        const type = this.board[y][x];
        if (!type) continue;
        this.drawBlock(ctx, x, y, type, CONFIG.cell, 1);
      }
    }

    if (this.current && !this.gameOver) {
      const ghostY = this.getGhostY();
      for (let y = 0; y < this.current.matrix.length; y += 1) {
        for (let x = 0; x < this.current.matrix[y].length; x += 1) {
          if (!this.current.matrix[y][x]) continue;
          const boardX = this.current.x + x;
          const boardY = ghostY + y;
          if (boardY >= 0) {
            this.drawBlock(ctx, boardX, boardY, this.current.type, CONFIG.cell, 0.18);
          }
        }
      }

      for (let y = 0; y < this.current.matrix.length; y += 1) {
        for (let x = 0; x < this.current.matrix[y].length; x += 1) {
          if (!this.current.matrix[y][x]) continue;
          const boardX = this.current.x + x;
          const boardY = this.current.y + y;
          if (boardY >= 0) {
            this.drawBlock(ctx, boardX, boardY, this.current.type, CONFIG.cell, 1);
          }
        }
      }
    }

    if (this.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(5, 10, 22, 0.18)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (this.gameOver || this.won) {
      ctx.fillStyle = this.won ? 'rgba(8, 34, 20, 0.28)' : 'rgba(33, 6, 12, 0.35)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  drawPreview() {
    const ctx = this.previewCtx;
    const size = this.previewCanvas.width;
    ctx.clearRect(0, 0, size, size);
    const bg = ctx.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, 'rgba(10, 16, 42, 0.98)');
    bg.addColorStop(1, 'rgba(5, 8, 22, 1)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= size; x += CONFIG.previewCell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += CONFIG.previewCell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(size, y + 0.5);
      ctx.stroke();
    }

    const matrix = PIECES[this.nextType];
    const offsetX = Math.floor((size / CONFIG.previewCell - matrix[0].length) / 2);
    const offsetY = Math.floor((size / CONFIG.previewCell - matrix.length) / 2);
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;
        this.drawBlock(ctx, offsetX + x, offsetY + y, this.nextType, CONFIG.previewCell, 1);
      }
    }
  }
}

const dom = {
  topbar: document.querySelector('.topbar'),
  highScoreValue: document.getElementById('highScoreValue'),
  menuOverlay: document.getElementById('menuOverlay'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  resultStats: document.getElementById('resultStats'),
  pauseBtn: document.getElementById('pauseBtn'),
  menuBtn: document.getElementById('menuBtn'),
  retryCurrentBtn: document.getElementById('retryCurrentBtn'),
  backToMenuBtn: document.getElementById('backToMenuBtn'),
  boardZone: document.getElementById('boardZone'),
  player1Card: document.getElementById('player1Card'),
  player2Card: document.getElementById('player2Card'),
  mobileControls: document.getElementById('mobileControls'),
  touchPanelP1: document.getElementById('touchPanelP1'),
  touchPanelP2: document.getElementById('touchPanelP2')
};

const players = [
  new TetrisPlayer({
    id: 1,
    label: 'PLAYER 1',
    canvas: document.getElementById('board1'),
    previewCanvas: document.getElementById('next1'),
    messageEl: document.getElementById('messageP1'),
    statusEl: document.getElementById('statusP1'),
    controls: {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      down: 'ArrowDown',
      rotate: 'ArrowUp',
      drop: 'Space'
    },
    dom: {
      score: document.getElementById('scoreP1'),
      lines: document.getElementById('linesP1'),
      stage: document.getElementById('stageP1'),
      goal: document.getElementById('goalP1'),
      speed: document.getElementById('speedP1'),
      drop: document.getElementById('dropP1'),
      state: document.getElementById('stateP1'),
      rank: document.getElementById('rankP1')
    }
  }),
  new TetrisPlayer({
    id: 2,
    label: 'PLAYER 2',
    canvas: document.getElementById('board2'),
    previewCanvas: document.getElementById('next2'),
    messageEl: document.getElementById('messageP2'),
    statusEl: document.getElementById('statusP2'),
    controls: {
      left: 'KeyA',
      right: 'KeyD',
      down: 'KeyS',
      rotate: 'KeyW',
      drop: 'ShiftLeft'
    },
    dom: {
      score: document.getElementById('scoreP2'),
      lines: document.getElementById('linesP2'),
      stage: document.getElementById('stageP2'),
      goal: document.getElementById('goalP2'),
      speed: document.getElementById('speedP2'),
      drop: document.getElementById('dropP2'),
      state: document.getElementById('stateP2'),
      rank: document.getElementById('rankP2')
    }
  })
];

const game = {
  state: 'menu',
  mode: 1,
  highScore: safeStorage.getHighScore(),
  lastTime: 0,

  start(mode) {
    this.mode = mode;
    this.state = 'playing';
    this.lastTime = performance.now();
    dom.menuOverlay.classList.add('hidden');
    dom.resultOverlay.classList.add('hidden');
    dom.player2Card.classList.toggle('hidden', mode !== 2);

    players.forEach((player, index) => {
      player.reset();
      player.active = index === 0 || mode === 2;
      if (!player.active) {
        player.setBadge('HIDDEN', 'ready');
        player.setStateText('OFF', 'RANK HIDDEN');
        player.hideMessage();
        player.draw();
      } else {
        player.setBadge('PLAYING', 'playing');
        player.setStateText(`STAGE ${player.stage}`, `RANK ${player.label}`);
        player.updateInfo(true);
      }
    });

    this.renderHighScore();
    dom.pauseBtn.textContent = '일시정지';
    updateTouchPanels();
    ensureGameplayVisible();
  },

  pauseToggle() {
    if (this.state === 'menu' || this.state === 'finished') return;
    this.state = this.state === 'paused' ? 'playing' : 'paused';
    dom.pauseBtn.textContent = this.state === 'paused' ? '계속하기' : '일시정지';
    players.forEach((player, index) => {
      if (index === 1 && this.mode !== 2) return;
      if (this.state === 'paused' && player.active) {
        player.setBadge('PAUSED', 'paused');
        player.setStateText('PAUSE', `RANK STAGE ${player.stage}`);
      } else if (this.state === 'playing' && player.active && !player.gameOver && !player.won) {
        player.setBadge('PLAYING', 'playing');
        player.setStateText(`STAGE ${player.stage}`, `RANK ${player.label}`);
      }
      player.draw();
    });
  },

  returnToMenu() {
    this.state = 'menu';
    dom.menuOverlay.classList.remove('hidden');
    dom.resultOverlay.classList.add('hidden');
    dom.pauseBtn.textContent = '일시정지';
    players.forEach((player) => {
      if (player.active && !player.gameOver && !player.won) {
        player.setBadge('READY', 'ready');
        player.setStateText('WAITING', 'RANK READY');
      }
    });
    updateTouchPanels();
  },

  updateHighScore(candidate) {
    if (candidate > this.highScore) {
      this.highScore = candidate;
      safeStorage.setHighScore(candidate);
      this.renderHighScore();
    }
  },

  renderHighScore() {
    dom.highScoreValue.textContent = padScore(this.highScore);
  },

  handlePlayerEnd() {
    const activePlayers = players.filter((player, index) => index === 0 || this.mode === 2);
    const winner = activePlayers.find((player) => player.won);

    if (winner) {
      this.state = 'finished';
      activePlayers.forEach((player) => {
        player.active = false;
        if (!player.won && !player.gameOver) {
          player.setBadge('STOP', 'paused');
          player.setStateText('MATCH END', `RANK ${player.label}`);
        }
        player.draw();
      });
      this.showResult(winner);
      return;
    }

    const remaining = activePlayers.filter((player) => !player.gameOver && !player.won);
    if (remaining.length === 0) {
      this.state = 'finished';
      this.showResult(null);
    }
  },

  showResult(winner) {
    const activePlayers = players.filter((player, index) => index === 0 || this.mode === 2);
    let title = 'RESULT';
    let text = '';

    if (this.mode === 1) {
      if (winner) {
        title = 'STAGE 15 CLEAR';
        text = `PLAYER 1이 15스테이지를 모두 돌파했습니다. 최종 점수 ${players[0].score.toLocaleString('ko-KR')}점.`;
      } else {
        title = 'GAME OVER';
        text = `PLAYER 1이 스테이지 ${players[0].stage}에서 종료되었습니다. 최고 기록을 갱신했는지 중앙 상단에서 바로 확인할 수 있습니다.`;
      }
    } else {
      if (winner) {
        title = `${winner.label} WIN`;
        text = `${winner.label}가 15스테이지를 먼저 돌파했습니다. 궁전의 왕관이 해당 플레이어에게 넘어갔습니다.`;
      } else {
        const ranking = activePlayers.slice().sort((a, b) => {
          if (b.stage !== a.stage) return b.stage - a.stage;
          if (b.stageProgress !== a.stageProgress) return b.stageProgress - a.stageProgress;
          return b.score - a.score;
        });
        const [first, second] = ranking;
        if (first.stage === second.stage && first.stageProgress === second.stageProgress && first.score === second.score) {
          title = 'DRAW';
          text = '두 플레이어가 같은 스테이지, 같은 진행도, 같은 점수로 종료되었습니다.';
        } else {
          title = `${first.label} WIN`;
          text = `${first.label}가 더 높은 진행도와 점수로 승리했습니다.`;
        }
      }
    }

    dom.resultTitle.textContent = title;
    dom.resultText.textContent = text;
    dom.resultStats.innerHTML = activePlayers.map((player) => {
      const state = player.won ? 'VICTORY' : `STAGE ${player.stage}`;
      return `
        <div class="result-chip">
          <strong>${player.label}</strong>
          <span>${player.score.toLocaleString('ko-KR')}점</span>
          <div style="margin-top:8px;font-size:12px;color:var(--muted);line-height:1.6;">
            ${state}<br>
            진행 ${player.stageProgress} / ${CONFIG.linesPerStage}<br>
            누적 ${player.totalLines}줄
          </div>
        </div>
      `;
    }).join('');
    dom.resultOverlay.classList.remove('hidden');
    updateTouchPanels();
  },

  loop(time) {
    const delta = time - this.lastTime;
    this.lastTime = time;
    if (this.state === 'playing') {
      players.forEach((player, index) => {
        if (index === 1 && this.mode !== 2) return;
        player.update(delta);
      });
    }
    requestAnimationFrame((next) => this.loop(next));
  }
};


function createSakuraPetals(count = 56) {
  const container = document.getElementById('sakuraPetals');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    const size = (10 + Math.random() * 16).toFixed(1);
    const left = (-8 + Math.random() * 116).toFixed(2);
    const drift = (-24 + Math.random() * 42).toFixed(2);
    const sway = (-4.2 + Math.random() * 8.4).toFixed(2);
    const delay = (-Math.random() * 22).toFixed(2);
    const fall = (8.5 + Math.random() * 12.5).toFixed(2);
    const spin = (2.8 + Math.random() * 4.6).toFixed(2);
    const opacity = (0.30 + Math.random() * 0.58).toFixed(2);
    const blur = (Math.random() * 1.8).toFixed(2);
    petal.style.setProperty('--size', `${size}px`);
    petal.style.setProperty('--left', `${left}vw`);
    petal.style.setProperty('--drift', `${drift}vw`);
    petal.style.setProperty('--sway', `${sway}vw`);
    petal.style.setProperty('--delay', `${delay}s`);
    petal.style.setProperty('--fall', `${fall}s`);
    petal.style.setProperty('--spin', `${spin}s`);
    petal.style.setProperty('--opacity', opacity);
    petal.style.setProperty('--blur', `${blur}px`);
    container.appendChild(petal);
  }
}


const mobileMediaQuery = window.matchMedia('(max-width: 1100px), (pointer: coarse)');
const touchHoldState = new Map();

function isMobileTouchLayout() {
  return mobileMediaQuery.matches;
}

function isPhoneTouchLayout() {
  return isMobileTouchLayout() && getViewportSize().width <= 767;
}

function isTabletTouchLayout() {
  return isMobileTouchLayout() && getViewportSize().width > 767;
}

function updateResponsiveModeClasses() {
  document.body.classList.toggle('layout-touch', isMobileTouchLayout());
  document.body.classList.toggle('layout-phone', isPhoneTouchLayout());
  document.body.classList.toggle('layout-tablet', isTabletTouchLayout());
}

function getViewportSize() {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv ? vv.width : window.innerWidth),
    height: Math.round(vv ? vv.height : window.innerHeight)
  };
}

function applyResponsiveBoardSizing() {
  const { width: vw, height: vh } = getViewportSize();
  const touchLayout = isMobileTouchLayout();
  const phoneLayout = isPhoneTouchLayout();
  const tabletLayout = isTabletTouchLayout();
  const topbarHeight = dom.topbar ? dom.topbar.offsetHeight : 0;
  const controlsVisible = touchLayout && dom.mobileControls && dom.mobileControls.classList.contains('is-visible');
  const estimatedTouchHeight = phoneLayout ? (vw <= 680 ? 26 : 32) : (tabletLayout ? 0 : 0);
  const touchHeight = controlsVisible ? dom.mobileControls.offsetHeight : estimatedTouchHeight;
  document.documentElement.style.setProperty('--touch-ui-height', `${phoneLayout ? touchHeight : 0}px`);

  let boardWidth = 320;
  if (phoneLayout) {
    const horizontalPad = vw <= 680 ? 4 : 10;
    const reservedHeight = topbarHeight + touchHeight + (vw <= 680 ? 8 : 12);
    const maxWidthByScreen = Math.max(228, vw - horizontalPad);
    const maxWidthByHeight = Math.max(228, Math.floor((vh - reservedHeight) / 2));
    boardWidth = Math.min(488, maxWidthByScreen, maxWidthByHeight);
    if (vw <= 420) boardWidth = Math.min(boardWidth, 372);
    if (vw <= 390) boardWidth = Math.min(boardWidth, 348);
  } else if (tabletLayout) {
    const horizontalPad = game.mode === 2 ? 64 : 52;
    const maxWidthByScreen = Math.max(240, Math.floor((vw - horizontalPad) / (game.mode === 2 ? 2.15 : 1.45)));
    const maxWidthByHeight = Math.max(240, Math.floor((vh - topbarHeight - 88) / 2));
    boardWidth = Math.min(360, maxWidthByScreen, maxWidthByHeight);
  } else if (vw < 1320) {
    boardWidth = Math.max(260, Math.min(320, Math.floor((vw - 460) / (game.mode === 2 ? 2.25 : 1.6))));
  }

  const boardHeight = Math.round(boardWidth * 2);
  document.documentElement.style.setProperty('--board-width', `${boardWidth}px`);
  document.documentElement.style.setProperty('--board-height', `${boardHeight}px`);
}

function getPlayablePlayer(playerId) {
  const player = players[playerId - 1];
  if (!player) return null;
  if (playerId === 2 && game.mode !== 2) return null;
  return player;
}

function runPlayerAction(playerId, action) {
  const player = getPlayablePlayer(playerId);
  if (!player || !player.active || player.gameOver || player.won) return false;
  switch (action) {
    case 'left':
      return player.move(-1);
    case 'right':
      return player.move(1);
    case 'rotate':
      return player.rotate();
    case 'drop':
      return player.hardDrop();
    case 'downStart':
      player.softDrop();
      return true;
    case 'downStop':
      player.releaseSoftDrop();
      return true;
    default:
      return false;
  }
}

function endTouchHold(key) {
  const hold = touchHoldState.get(key);
  if (!hold) return;
  if (hold.delay) clearTimeout(hold.delay);
  if (hold.interval) clearInterval(hold.interval);
  if (hold.playerId && hold.action === 'down') {
    runPlayerAction(hold.playerId, 'downStop');
  }
  if (hold.button) {
    hold.button.classList.remove('active');
  }
  touchHoldState.delete(key);
}

function startTouchHold(button) {
  if (game.state !== 'playing' && game.state !== 'paused') return;
  const playerId = Number(button.dataset.player || 0);
  const action = button.dataset.action;
  const holdKey = `${playerId}:${action}`;
  endTouchHold(holdKey);
  button.classList.add('active');

  if (action === 'down') {
    runPlayerAction(playerId, 'downStart');
    touchHoldState.set(holdKey, { playerId, action, button });
    return;
  }

  if (game.state !== 'playing') {
    button.classList.remove('active');
    return;
  }

  runPlayerAction(playerId, action);

  if (action === 'left' || action === 'right') {
    const hold = { playerId, action, button };
    hold.delay = setTimeout(() => {
      hold.interval = setInterval(() => {
        if (game.state !== 'playing') return;
        runPlayerAction(playerId, action);
      }, 90);
    }, 170);
    touchHoldState.set(holdKey, hold);
  } else {
    setTimeout(() => button.classList.remove('active'), 110);
  }
}

function updateTouchPanels() {
  if (!dom.mobileControls) return;
  updateResponsiveModeClasses();
  const visible = isMobileTouchLayout() && (game.state === 'playing' || game.state === 'paused');
  dom.mobileControls.classList.toggle('is-visible', visible);
  if (dom.touchPanelP1) {
    dom.touchPanelP1.classList.toggle('hidden', !visible);
  }
  if (dom.touchPanelP2) {
    dom.touchPanelP2.classList.toggle('hidden', !visible || game.mode !== 2);
  }
  if (!visible) {
    Array.from(touchHoldState.keys()).forEach((key) => endTouchHold(key));
  }
}

function updateTouchButtonLabels() {
  const phone = isPhoneTouchLayout();
  document.querySelectorAll('.touch-btn.action-drop').forEach((button) => {
    button.textContent = phone ? 'HD' : 'HD';
  });
}


function bindTouchControls() {
  document.querySelectorAll('[data-player][data-action]').forEach((button) => {
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      startTouchHold(button);
    }, { passive: false });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
      button.addEventListener(eventName, (event) => {
        event.preventDefault();
        const holdKey = `${button.dataset.player}:${button.dataset.action}`;
        endTouchHold(holdKey);
      }, { passive: false });
    });
  });

  document.querySelectorAll('[data-global-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.classList.add('active');
      const action = button.dataset.globalAction;
      if (action === 'pause') {
        game.pauseToggle();
      } else if (action === 'menu') {
        game.returnToMenu();
      }
      setTimeout(() => button.classList.remove('active'), 120);
    }, { passive: false });
  });
}

function ensureGameplayVisible(immediate = false) {
  if (!isMobileTouchLayout()) return;
  if (game.state !== 'playing' && game.state !== 'paused') return;
  const target = game.mode === 2 ? dom.boardZone : dom.player1Card;
  if (!target) return;
  const run = () => {
    target.scrollIntoView({
      behavior: immediate ? 'auto' : 'smooth',
      block: 'start',
      inline: 'nearest'
    });
  };
  requestAnimationFrame(() => setTimeout(run, immediate ? 0 : 120));
}

function refreshResponsiveUI() {
  updateResponsiveModeClasses();
  updateTouchPanels();
  updateTouchButtonLabels();
  applyResponsiveBoardSizing();
  createSakuraPetals(isMobileTouchLayout() ? 28 : 56);
  players.forEach((player) => player.draw());
  if (isMobileTouchLayout() && (game.state === 'playing' || game.state === 'paused')) {
    ensureGameplayVisible(true);
  }
}


function normalizeCode(code, key) {
  if (code === 'ShiftRight') return 'ShiftLeft';
  if (code === 'ControlRight') return 'ControlLeft';
  if (key === ' ') return 'Space';
  return code;
}

function handleKeyDown(event) {
  const code = normalizeCode(event.code, event.key);
  const controlledCodes = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
    'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ShiftLeft', 'KeyP'
  ];
  if (controlledCodes.includes(code)) {
    event.preventDefault();
  }

  if (code === 'KeyP') {
    game.pauseToggle();
    return;
  }

  if (game.state !== 'playing') {
    return;
  }

  players.forEach((player, index) => {
    if (index === 1 && game.mode !== 2) return;
    if (!player.active || player.gameOver || player.won) return;

    switch (code) {
      case player.controls.left:
        player.move(-1);
        break;
      case player.controls.right:
        player.move(1);
        break;
      case player.controls.rotate:
        player.rotate();
        break;
      case player.controls.down:
        player.softDrop();
        break;
      case player.controls.drop:
        if (!event.repeat) {
          player.hardDrop();
        }
        break;
      default:
        break;
    }
  });
}

function handleKeyUp(event) {
  const code = normalizeCode(event.code, event.key);
  players.forEach((player, index) => {
    if (index === 1 && game.mode !== 2) return;
    if (code === player.controls.down) {
      player.releaseSoftDrop();
    }
  });
}

window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp, { passive: false });

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    game.start(Number(button.dataset.mode));
  });
});

dom.pauseBtn.addEventListener('click', () => game.pauseToggle());
dom.menuBtn.addEventListener('click', () => game.returnToMenu());
dom.retryCurrentBtn.addEventListener('click', () => game.start(game.mode));
dom.backToMenuBtn.addEventListener('click', () => game.returnToMenu());

bindTouchControls();
refreshResponsiveUI();
mobileMediaQuery.addEventListener('change', refreshResponsiveUI);
window.addEventListener('orientationchange', () => setTimeout(refreshResponsiveUI, 220));
window.addEventListener('resize', refreshResponsiveUI);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', refreshResponsiveUI);
  window.visualViewport.addEventListener('scroll', refreshResponsiveUI);
}

game.renderHighScore();
applyResponsiveBoardSizing();
players[0].draw();
players[1].draw();
requestAnimationFrame((time) => game.loop(time));
