/* game.js — Bugman (фикс динамических размеров уровня и корректного канваса) */

/* --------- CANVAS & DPR --------- */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });

let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const TILE = 24;           // размер тайла в логических единицах
let ROWS = 0, COLS = 0;    // берём из LEVELS[levelIndex] каждый раз

function fitCanvas() {
  const w = COLS * TILE;
  const h = ROWS * TILE;
  canvas.width  = Math.round(w * DPR);
  canvas.height = Math.round(h * DPR);
  canvas.style.aspectRatio = `${w}/${h}`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => {
  if (COLS && ROWS) fitCanvas();
});

/* --------- INPUT --------- */
const DIRS = {
  left:  { x: -1, y:  0 },
  right: { x:  1, y:  0 },
  up:    { x:  0, y: -1 },
  down:  { x:  0, y:  1 },
};
const DIR_KEYS = {
  ArrowLeft:  'left',
  ArrowRight: 'right',
  ArrowUp:    'up',
  ArrowDown:  'down',
};

let touchStart = null;
function bindInput() {
  document.addEventListener('keydown', (e) => {
    if (DIR_KEYS[e.key]) {
      pacman.nextDir = DIR_KEYS[e.key];
      e.preventDefault();
    }
    if (e.key === ' ' || e.key === 'Enter') {
      // Старт/пауза
      if (overlayShown) hideOverlay();
      else { paused = !paused; if (!paused) loop(); }
      e.preventDefault();
    }
  }, { passive: false });

  // свайпы (тач + тачпад, PointerEvents)
  const start = (x, y) => (touchStart = { x, y, t: performance.now() });
  const end = (x, y) => {
    if (!touchStart) return;
    const dx = x - touchStart.x;
    const dy = y - touchStart.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const dist = Math.max(adx, ady);
    touchStart = null;
    if (dist < 15) return;
    pacman.nextDir = (adx > ady) ? (dx > 0 ? 'right' : 'left')
                                 : (dy > 0 ? 'down' : 'up');
  };

  // Pointer (тачпад/мышь с жестами)
  canvas.addEventListener('pointerdown', (e) => start(e.clientX, e.clientY), { passive: true });
  canvas.addEventListener('pointerup',   (e) => end(e.clientX, e.clientY),   { passive: true });

  // Touch (мобилки)
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    end(t.clientX, t.clientY);
  }, { passive: true });
}

/* --------- LEVEL --------- */

const LEVELS = [[
  "1111111111111111111111111111",
  "1............11............1",
  "1.1111.11111.11.11111.1111.1",
  "1.3..1.3...1.11.1...3.1..3.1",
  "1.1111.11111.11.11111.1111.1",
  "1..22..................22..1",
  "1.1111.11.11111111.11.1111.1",
  "1.1111.11.11111111.11.1111.1",
  "1......11....11....11......1",
  "11111. 11111 11 11111 .11111",
  "00001. 11111 11 11111 .10000",
  "00001. 11          11 .10000",
  "11111. 11 111--111 11 .11111",
  "     .    1G B P1    .     ",
  "11111. 11 11111111 11 .11111",
  "00001. 11    22    11 .10000",
  "00001. 11 11111111 11 .10000",
  "11111. 11 11    11 11 .11111",
  "1............11............1",
  "1.1111.11111.11.11111.1111.1",
  "1.3..1.....1.11.1.....1..3.1",
  "1..11.11111.11.11111.11..3.1",
  "1..22..................22..1",
  "1.111111111111111111111111.1",
  "1..........................1",
  "1.1111111111.11.1111111111.1",
  "1.3......................3.1",
  "1.1111111111.11.1111111111.1",
  "1............11............1",
  "1..........................1",
  "1111111111111111111111111111"
]];

// grid codes: 1=wall, 0=empty, 2=pellet, 3=power
let levelIndex = 0;
let grid = [];
let pellets = 0;

/* --------- GAME STATE --------- */
const pacman = { x: 14, y: 23, dir: 'left', nextDir: 'left', speed: 0.1, alive: true };
const ghosts = [
  { name: 'Blinky', color: '#ff4b5c', x: 13, y: 14, dir: 'left',  speed: 0.09, mode: 'chase'  },
  { name: 'Pinky',  color: '#ff7ad9', x: 14, y: 14, dir: 'right', speed: 0.085, mode: 'ambush' },
  { name: 'Inky',   color: '#00d1d1', x: 13, y: 15, dir: 'up',    speed: 0.085, mode: 'random' },
  { name: 'Clyde',  color: '#ffb84d', x: 14, y: 15, dir: 'down',  speed: 0.08,  mode: 'shy'    },
];

let score = 0, lives = 3, frightenedTimer = 0, tick = 0;
let paused = false;
let overlayShown = true;

/* --------- UTIL --------- */
function nearestFree(x, y) {
  const q = [[x, y]];
  const seen = new Set([`${x},${y}`]);
  while (q.length) {
    const [cx, cy] = q.shift();
    if (grid[cy] && grid[cy][cx] !== 1) return [cx, cy];
    for (const d of Object.values(DIRS)) {
      const nx = cx + d.x, ny = cy + d.y;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !seen.has(key)) {
        seen.add(key); q.push([nx, ny]);
      }
    }
  }
  return [x, y];
}

function isWallTile(x, y) { return grid[y] && grid[y][x] === 1; }
function canMoveFrom(x, y, dir) {
  const nx = x + DIRS[dir].x, ny = y + DIRS[dir].y;
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return true;
  return !isWallTile(nx, ny);
}
function wrapCoords(x, y) {
  if (x < 0) x = COLS - 1; else if (x >= COLS) x = 0;
  if (y < 0) y = ROWS - 1; else if (y >= ROWS) y = 0;
  return [x, y];
}

/* --------- LEVEL BUILD --------- */
function buildLevel() {
  const raw = LEVELS[levelIndex];
  ROWS = raw.length;
  COLS = raw[0].length;

  fitCanvas();

  pellets = 0;
  grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      const ch = (raw[r] || '')[c] || ' ';
      if (ch === '1') return 1;       // wall
      if (ch === '3') { pellets++; return 3; } // power
      if (ch === '0' || ch === '-' || ch === 'G' || ch === 'B' || ch === 'P' || ch === '1') return 0;
      if (ch === ' ') return 0;
      // точки ставим только там, где явно нет стен и спецсимволов
      pellets++; return 2;
    })
  );

  // стартовые позиции
  Object.assign(pacman, { x: 14, y: 23, dir: 'left', nextDir: 'left', speed: 0.1, alive: true });
  [[13,14,'left'], [14,14,'right'], [13,15,'up'], [14,15,'down']].forEach((v, i) => {
    ghosts[i].x = v[0]; ghosts[i].y = v[1]; ghosts[i].dir = v[2];
  });

  // если вдруг спавн — стена, снэп в ближайшую свободную
  [pacman.x, pacman.y] = nearestFree(Math.round(pacman.x), Math.round(pacman.y));

  frightenedTimer = 0;
  updateHUD();
}

/* --------- HUD --------- */
function updateHUD() {
  const s = document.getElementById('score');
  const l = document.getElementById('lives');
  const lv = document.getElementById('level');
  if (s) s.textContent = score;
  if (l) l.textContent = Math.max(0, lives);
  if (lv) lv.textContent = levelIndex + 1;
}

/* --------- MOVEMENT --------- */
function stepActor(a) {
  // Текущая дискретная клетка (центр)
  const cx = Math.round(a.x), cy = Math.round(a.y);
  const centered = Math.abs(a.x - cx) < 0.05 && Math.abs(a.y - cy) < 0.05;

  // На центрах — смена направления, если можно
  if (centered && a.nextDir && canMoveFrom(cx, cy, a.nextDir)) a.dir = a.nextDir;

  // Пробуем сместиться по текущему dir
  const vx = DIRS[a.dir].x * a.speed;
  const vy = DIRS[a.dir].y * a.speed;

  // прогноз следующей клетки по центрам
  let nx = a.x + vx, ny = a.y + vy;
  let tx = Math.round(nx), ty = Math.round(ny);

  // Если упираемся в стену — остаёмся на центре, НЕ «проламываем»
  if ((tx !== cx || ty !== cy) && tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && isWallTile(tx, ty)) {
    a.x = cx; a.y = cy; // фиксируемся у центра, без проникновения
    return;
  }

  // Тоннели
  if (nx < -0.51) nx = COLS - 0.51;
  if (nx > COLS - 0.49) nx = -0.49;
  if (ny < -0.51) ny = ROWS - 0.51;
  if (ny > ROWS - 0.49) ny = -0.49;

  a.x = nx; a.y = ny;
}

/* --------- GHOST AI (разнообразие путей) --------- */
const REVERSE = { left: 'right', right: 'left', up: 'down', down: 'up' };

function ghostAI(g) {
  const cx = Math.round(g.x), cy = Math.round(g.y);

  // на центрах — переопределяем направление
  if (!(Math.abs(g.x - cx) < 0.05 && Math.abs(g.y - cy) < 0.05)) return;

  // список допустимых направлений
  let options = Object.keys(DIRS).filter(d => canMoveFrom(cx, cy, d));
  // не разворачиваемся без нужды
  options = options.filter(d => d !== REVERSE[g.dir]) || options;

  if (frightenedTimer > 0) {
    // испуг — больше рандома
    g.dir = options[Math.floor(Math.random() * options.length)];
    return;
  }

  // цели в зависимости от режима
  let target = { x: pacman.x, y: pacman.y };
  if (g.mode === 'ambush') {
    // Пинки: заглядывает на 3 клетки вперёд
    const fx = DIRS[pacman.dir]?.x || 0;
    const fy = DIRS[pacman.dir]?.y || 0;
    target = { x: pacman.x + fx * 3, y: pacman.y + fy * 3 };
  } else if (g.mode === 'random') {
    // Инки: слабый шум — иногда берёт случайную цель
    if (Math.random() < 0.35) {
      target = { x: Math.random() * COLS, y: Math.random() * ROWS };
    }
  } else if (g.mode === 'shy') {
    // Клайд: если близко — уходит в угол, если далеко — гонится
    const dx = g.x - pacman.x, dy = g.y - pacman.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 25) target = { x: 1, y: ROWS - 2 }; // нижний левый угол
  }

  // выбираем направление с минимальной эвристикой расстояния
  let best = options[0], bestScore = Infinity;
  for (const d of options) {
    const nx = cx + DIRS[d].x, ny = cy + DIRS[d].y;
    // с обёрткой
    const [wx, wy] = wrapCoords(nx, ny);
    const dx = (wx - target.x), dy = (wy - target.y);
    // маленький шум, чтобы не «строиться паровозом»
    const noise = (Math.random() * 0.2);
    const s = dx * dx + dy * dy + (d === g.dir ? -0.15 : 0) + noise;
    if (s < bestScore) { bestScore = s; best = d; }
  }
  g.dir = best;
}

/* --------- GAME LOGIC --------- */
function nextLevel() {
  levelIndex = (levelIndex + 1) % LEVELS.length;
  pacman.speed += 0.01;
  ghosts.forEach((g, i) => g.speed += 0.012 + i * 0.001);
  // ВОЗВРАТ ЖИЗНЕЙ на новый уровень
  lives = 3;
  buildLevel();
}

function update() {
  if (paused) return;
  tick++;

  // Пакмен
  if (pacman.alive) {
    stepActor(pacman);
    const cx = Math.round(pacman.x), cy = Math.round(pacman.y);
    if (grid[cy] && (grid[cy][cx] === 2 || grid[cy][cx] === 3)) {
      score += (grid[cy][cx] === 3 ? 50 : 10);
      updateHUD();
      if (grid[cy][cx] === 3) frightenedTimer = 600;
      grid[cy][cx] = 0;
      pellets--;
      if (pellets <= 0) nextLevel();
    }
  }

  // Призраки
  for (const g of ghosts) {
    ghostAI(g);
    stepActor(g);
  }

  if (frightenedTimer > 0) frightenedTimer--;

  // Столкновения
  for (const g of ghosts) {
    const dx = g.x - pacman.x, dy = g.y - pacman.y;
    if (dx * dx + dy * dy < 0.6) {
      if (frightenedTimer > 0) {
        score += 200; updateHUD();
        // отправим в дом
        g.x = 13; g.y = 14; g.dir = 'left';
      } else if (pacman.alive) {
        pacman.alive = false;
        lives = Math.max(0, lives - 1);
        updateHUD();
        if (lives <= 0) {
          paused = true;
          showBanner('Игра окончена', 'Нажми «Заново», чтобы сыграть снова.');
        } else {
          // рестарт позиции из центра, но не в стене
          Object.assign(pacman, { x: 14, y: 23, dir: 'left', nextDir: 'left', alive: true });
          [pacman.x, pacman.y] = nearestFree(Math.round(pacman.x), Math.round(pacman.y));
          frightenedTimer = 0;
          [[13,14,'left'], [14,14,'right'], [13,15,'up'], [14,15,'down']].forEach((v, i) => {
            ghosts[i].x = v[0]; ghosts[i].y = v[1]; ghosts[i].dir = v[2];
          });
        }
      }
    }
  }
}

/* --------- RENDER --------- */
function drawMaze() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // фоновые «звёзды»
  for (let i = 0; i < 40; i++) {
    const x = (i * 53) % (COLS * TILE), y = ((i * 97) % (ROWS * TILE));
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(x, y, 2, 2);
  }

  // стены
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c] === 1) {
      const x = c * TILE, y = r * TILE;
      const grad = ctx.createLinearGradient(x, y, x, y + TILE);
      grad.addColorStop(0, 'rgba(22,42,112,1)');
      grad.addColorStop(1, 'rgba(8,18,56,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(98,224,255,.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    }
  }

  // точки
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
    if (grid[r][c] === 2) {
      ctx.fillStyle = '#ffeaae';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (grid[r][c] === 3) {
      const t = (tick % 60) / 60;
      const rad = 6 + Math.sin(t * 2 * Math.PI) * 2;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 18);
      glow.addColorStop(0, 'rgba(255,210,63,.95)');
      glow.addColorStop(1, 'rgba(255,210,63,.05)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawActors() {
  // Пакмен
  const t = (tick % 20) / 20;
  const open = 0.25 + 0.15 * Math.sin(t * 2 * Math.PI);
  const angle = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[pacman.dir] || 0;

  ctx.save();
  ctx.translate(pacman.x * TILE + TILE / 2, pacman.y * TILE + TILE / 2);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(0, -4, 2, 0, 0, 14);
  g.addColorStop(0, '#fff4a8'); g.addColorStop(1, '#ffcc00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 10, open, Math.PI * 2 - open);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#071b3a';
  ctx.beginPath();
  ctx.arc(2, -4, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Призраки
  for (const gh of ghosts) {
    ctx.save();
    ctx.translate(gh.x * TILE + TILE / 2, gh.y * TILE + TILE / 2);
    const color = frightenedTimer > 0 ? '#4466ff' : gh.color;
    const grd = ctx.createLinearGradient(0, -12, 0, 12);
    grd.addColorStop(0, color);
    grd.addColorStop(1, '#0a1230');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, -2, 10, Math.PI, 0, false);
    ctx.lineTo(10, 8);
    for (let i = 0; i < 4; i++) {
      ctx.lineTo(6 - i * 4, 12);
      ctx.lineTo(3 - i * 4, 8);
    }
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();

    const d = DIRS[gh.dir];
    const ex = (frightenedTimer > 0 ? 0 : (d.x || 0) * 2);
    const ey = (frightenedTimer > 0 ? 0 : (d.y || 0) * 2);
    ctx.fillStyle = '#ecf5ff';
    ctx.beginPath(); ctx.arc(-3, -4, 3, 0, Math.PI * 2); ctx.arc(3, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#182a5e';
    ctx.beginPath(); ctx.arc(-3 + ex, -4 + ey, 1.5, 0, Math.PI * 2); ctx.arc(3 + ex, -4 + ey, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function render() {
  drawMaze();
  drawActors();
  if (paused && lives > 0 && !overlayShown) showBanner('Пауза', 'Пробел/Enter или «Продолжить».');
}

/* --------- OVERLAY --------- */
function showOverlay() {
  const el = document.getElementById('start');
  if (el) el.style.display = 'grid';
  overlayShown = true;
}
function hideOverlay() {
  const el = document.getElementById('start');
  if (el) el.style.display = 'none';
  overlayShown = false;
  canvas.focus();
}
function showBanner(title, subtitle) {
  // рисуем полупрозрачную карточку поверх канваса
  const w = COLS * TILE, h = ROWS * TILE, cx = w / 2, cy = h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(14,26,54,.92)'; ctx.strokeStyle = '#3554c6'; ctx.lineWidth = 3;
  ctx.beginPath();
  const rw = 420, rh = 120, r = 16;
  ctx.moveTo(cx - rw, cy - rh);
  ctx.lineTo(cx + rw, cy - rh);
  ctx.lineTo(cx + rw, cy + rh);
  ctx.lineTo(cx - rw, cy + rh);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e6f0ff';
  ctx.font = '700 24px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, cx, cy - 8);
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#a9b9df';
  ctx.fillText(subtitle, cx, cy + 18);
  ctx.restore();
}

/* --------- LOOP --------- */
function loop() {
  if (paused) { render(); return; }
  update();
  render();
  requestAnimationFrame(loop);
}

/* --------- PUBLIC BUTTONS --------- */
window.BUGMAN = {
  start: () => {
    hideOverlay();
    paused = false;
    loop();
  },
  pause: (btn) => {
    paused = !paused;
    if (!paused) loop();
    if (btn) btn.textContent = paused ? 'Продолжить ▶' : 'Пауза ⏸';
  },
  restart: () => {
    score = 0; lives = 3; levelIndex = 0; updateHUD();
    buildLevel(); paused = false; loop();
  },
  toggleSound: (btn) => {
    // заглушка под звук, если используешь свой аудио-код — подключи тут
    if (btn) btn.textContent = 'Звук 🔊';
  },
  toggleMusic: (btn) => {
    if (btn) btn.textContent = 'Мелодия ♫';
  }
};

/* --------- INIT --------- */
bindInput();
buildLevel();
showOverlay();
render();
