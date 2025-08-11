/* ===== Bugman game (compact, readable) ===== */

/* -------------------- Canvas & DPI -------------------- */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

function fitCanvas() {
  const w = COLS * TILE;
  const h = ROWS * TILE;
  canvas.width = w * DPR;
  canvas.height = h * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', fitCanvas);

/* -------------------- Level (smaller, reachable) -------------------- */
const TILE = 22;                  // компактный тайл (мобайл friendly)
const ROWS = 29;                  // немного меньше классики
const COLS = 26;
const DIRS = { left:{x:-1,y:0}, right:{x:1,y:0}, up:{x:0,y:-1}, down:{x:0,y:1} };
const REVERSE = { left:'right', right:'left', up:'down', down:'up' };

const LEVEL = [
"11111111111111111111111111",
"1..........11.......... 1",
"1.1111.111.11.111.1111. 1",
"1.1  1.  1.11.1  1.  1. 1",
"1.1111.111.11.111.1111. 1",
"1...................... 1",
"1.1111.11.111111.11.111 1",
"1.1111.11.111111.11.111 1",
"1......11....11....11.. 1",
"11111. 11111 11 11111 .11",
"00001. 11          11 .00",
"00001. 11 111--111 11 .00",
"11111. 11 1G B P1 11 .111",
"1...................... 1",
"1.111.11111.11.11111.11 1",
"1.1 1.....1.11.1.....1  1",
"1.1 111111.11.111111 1  1",
"1...................... 1",
"1.11111111111111111111. 1",
"1...................... 1",
"1111111111111111111111111"
];

/* We’ll convert spaces to walls on edges, then place pellets everywhere reachable */
let grid = [];
let pellets = 0;

function buildGrid() {
  pellets = 0;
  grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      const ch = (LEVEL[r] || '')[c] || ' ';
      if (ch === '1') return 1;         // wall
      if (ch === '0') return 0;         // empty
      return 2;                         // pellet by default
    })
  );

  // big pellets (power) — четыре угла + пара внутри
  const big = [[1,1],[1,COLS-2],[ROWS-2,1],[ROWS-2,COLS-2],[ROWS-9, COLS-6],[ROWS-9, 6]];
  for (const [r,c] of big) if (grid[r]?.[c] !== 1) grid[r][c] = 3;

  // исправление «недостижимых» мест — пробиваем узкие горлышки
  // (где раньше залипали и куда нельзя дойти)
  // Просто превращаем один узкий «столбик» в дорожку:
  for (let r = 2; r < ROWS-2; r++) {
    if (grid[r][COLS-1] === 1 && grid[r][COLS-2] !== 1) grid[r][COLS-1] = 1; // стенка остается
  }

  // Посчитать пеллеты
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++)
    if (grid[r][c]===2 || grid[r][c]===3) pellets++;

  // Проверка связности — оставить только достижимое от центра
  const reachable = floodFillReachable(CENTER.x, CENTER.y);
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if ( (grid[r][c]===2 || grid[r][c]===3) && !reachable[r][c]) { grid[r][c]=0; pellets--; }
  }
}

function floodFillReachable(sx, sy) {
  const seen = Array.from({length:ROWS},()=>Array(COLS).fill(false));
  const q = [[sx, sy]];
  seen[sy][sx] = true;
  while (q.length) {
    const [x,y] = q.shift();
    for (const d of Object.values(DIRS)) {
      let nx = x + d.x, ny = y + d.y;
      // wrap
      if (nx < 0) nx = COLS - 1; else if (nx >= COLS) nx = 0;
      if (ny < 0) ny = ROWS - 1; else if (ny >= ROWS) ny = 0;
      if (!seen[ny][nx] && grid[ny][nx] !== 1) {
        seen[ny][nx] = true; q.push([nx,ny]);
      }
    }
  }
  return seen;
}

/* -------------------- Actors -------------------- */
const CENTER = { x: Math.floor(COLS/2), y: Math.floor(ROWS/2)+2}; // гарантированно коридор
const SPEED = 0.15;        // быстрее чем раньше
const GHOST_SPEED = 0.13;

const pacman = { x: CENTER.x + 0.0, y: CENTER.y + 0.0, dir: 'left', nextDir: 'left', speed: SPEED, alive:true };

const ghosts = [
  { name:'Blinky', color:'#ff4b5c', x:CENTER.x-1, y:CENTER.y-1, dir:'left',  speed:GHOST_SPEED, mode:'chase', scatter:{x:COLS-2,y:1} },
  { name:'Pinky',  color:'#ff7ad9', x:CENTER.x+1, y:CENTER.y-1, dir:'right', speed:GHOST_SPEED*0.97, mode:'chase', scatter:{x:1,y:1} },
  { name:'Inky',   color:'#00d1d1', x:CENTER.x-1, y:CENTER.y+1, dir:'up',    speed:GHOST_SPEED*0.95, mode:'chase', scatter:{x:COLS-2,y:ROWS-2} },
  { name:'Clyde',  color:'#ffb84d', x:CENTER.x+1, y:CENTER.y+1, dir:'down',  speed:GHOST_SPEED*0.92, mode:'chase', scatter:{x:1,y:ROWS-2} }
];

let frightenedTimer = 0;
let score = 0, lives = 3, level = 1;
let paused = false;
let tick = 0;

/* -------------------- Utils -------------------- */
function updateHUD(){
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  document.getElementById('level').textContent = level;
}
function isWall(x,y){ return grid[y]?.[x] === 1; }
function centerClamp(a){ a.x = Math.round(a.x*100)/100; a.y = Math.round(a.y*100)/100; }
function canMove(x,y,dir){
  const nx = Math.round(x) + DIRS[dir].x;
  const ny = Math.round(y) + DIRS[dir].y;
  if (nx<0 || nx>=COLS || ny<0 || ny>=ROWS) return true; // wrap разрешён
  return !isWall(nx,ny);
}
function wrap(a){
  if (a.x < -0.51) a.x = COLS-0.51;
  if (a.x > COLS-0.49) a.x = -0.49;
  if (a.y < -0.51) a.y = ROWS-0.51;
  if (a.y > ROWS-0.49) a.y = -0.49;
}

/* -------------------- Movement (чёткие клетки, без «тарани» стен) -------------------- */
function step(a){
  const cx = Math.round(a.x), cy = Math.round(a.y);
  const centered = Math.abs(a.x-cx) < 0.05 && Math.abs(a.y-cy) < 0.05;

  // если стоим на центре клетки — разрули поворот
  if (centered && a.nextDir && canMove(cx,cy,a.nextDir)) a.dir = a.nextDir;

  // кандидат
  let nx = a.x + DIRS[a.dir].x * a.speed;
  let ny = a.y + DIRS[a.dir].y * a.speed;

  // если пересекаем границу клетки — проверяем следующую клетку
  const tx = Math.round(nx), ty = Math.round(ny);
  if ((tx!==cx || ty!==cy) && tx>=0 && tx<COLS && ty>=0 && ty<ROWS && isWall(tx,ty)) {
    // в стену — стоп на центре текущей клетки
    a.x = cx; a.y = cy;
    return;
  }

  a.x = nx; a.y = ny;
  wrap(a);
}

/* -------------------- Ghost AI (разные цели + анти-залипание) -------------------- */
function ghostAI(g){
  const cx = Math.round(g.x), cy = Math.round(g.y);
  const centered = Math.abs(g.x-cx)<0.05 && Math.abs(g.y-cy)<0.05;

  // режим страха — рандом
  if (frightenedTimer>0) {
    if (centered) {
      let opts = Object.keys(DIRS).filter(d => canMove(cx,cy,d) && REVERSE[g.dir]!==d);
      if (!opts.length) opts = Object.keys(DIRS).filter(d => canMove(cx,cy,d));
      g.dir = opts[Math.floor(Math.random()*opts.length)];
    }
    return;
  }

  // цель по «ролям»
  let target = {x:pacman.x, y:pacman.y};
  if (g.name==='Pinky'){ // на 3 клетки вперёд
    target = {x: pacman.x + DIRS[pacman.dir].x*3, y: pacman.y + DIRS[pacman.dir].y*3};
  } else if (g.name==='Inky'){ // точка вокруг центра
    target = {x: CENTER.x + Math.sin(tick/30)*4, y: CENTER.y + Math.cos(tick/29)*4};
  } else if (g.name==='Clyde'){ // если близко — убегает в scatter
    const dx=g.x-pacman.x,dy=g.y-pacman.y;
    if (dx*dx+dy*dy < 25) target={...g.scatter}; else target={x:pacman.x,y:pacman.y};
  }

  // «разброс» чтобы не толпились
  target.x += (Math.sin((tick%97)/7)+Math.random()*0.5-0.25)*0.7;
  target.y += (Math.cos((tick%83)/5)+Math.random()*0.5-0.25)*0.7;

  if (centered){
    const options = Object.keys(DIRS).filter(d => canMove(cx,cy,d));
    let opts = options.filter(d => d !== REVERSE[g.dir]);
    if (!opts.length) opts = options;

    // выбрать направление, которое сокращает расстояние до target
    let best = opts[0], bestDist = Infinity;
    for (const d of opts){
      const nx = (cx + DIRS[d].x + COLS) % COLS;
      const ny = (cy + DIRS[d].y + ROWS) % ROWS;
      const dx = (nx - target.x), dy = (ny - target.y);
      const dist = dx*dx + dy*dy + (d===g.dir?-0.15:0);
      if (dist < bestDist){ bestDist = dist; best = d; }
    }
    g.dir = best;
  }
}

/* -------------------- Rendering -------------------- */
function drawMaze(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // backdrop dots
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  for (let i=0;i<40;i++){ ctx.fillRect((i*53)%(COLS*TILE),(i*97)%(ROWS*TILE),2,2); }

  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const x=c*TILE, y=r*TILE;
    if (grid[r][c]===1){
      const g=ctx.createLinearGradient(x,y,x,y+TILE);
      g.addColorStop(0,'#1b2c62'); g.addColorStop(1,'#0b1434');
      ctx.fillStyle=g; ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle='rgba(98,224,255,.55)'; ctx.lineWidth=2;
      ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
    }
  }
  // pellets
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const x=c*TILE+TILE/2, y=r*TILE+TILE/2;
    if (grid[r][c]===2){
      ctx.fillStyle='#ffeaae';
      ctx.beginPath(); ctx.arc(x,y,2.4,0,Math.PI*2); ctx.fill();
    } else if (grid[r][c]===3){
      const t=(tick%60)/60, rad=5.5+Math.sin(t*2*Math.PI)*1.6;
      const glow=ctx.createRadialGradient(x,y,2,x,y,16);
      glow.addColorStop(0,'rgba(255,210,63,.95)');
      glow.addColorStop(1,'rgba(255,210,63,.08)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
    }
  }
}

function drawActors(){
  // pacman
  const t=(tick%20)/20, open=0.25+0.15*Math.sin(t*2*Math.PI),
        angle={left:Math.PI,right:0,up:-Math.PI/2,down:Math.PI/2}[pacman.dir]||0;
  ctx.save();
  ctx.translate(pacman.x*TILE+TILE/2,pacman.y*TILE+TILE/2); ctx.rotate(angle);
  const g=ctx.createRadialGradient(0,-4,2,0,0,14); g.addColorStop(0,'#fff4a8'); g.addColorStop(1,'#ffcc00');
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,10,open,Math.PI*2-open); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#071b3a'; ctx.beginPath(); ctx.arc(2,-4,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // ghosts
  ghosts.forEach(gh=>{
    ctx.save();
    ctx.translate(gh.x*TILE+TILE/2, gh.y*TILE+TILE/2);
    const col = frightenedTimer>0 ? '#4466ff' : gh.color;
    const grd = ctx.createLinearGradient(0,-12,0,12);
    grd.addColorStop(0,col); grd.addColorStop(1,'#0a1230');
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(0,-2,10,Math.PI,0,false); ctx.lineTo(10,8);
    for(let i=0;i<4;i++){ ctx.lineTo(6-i*4,12); ctx.lineTo(3-i*4,8); }
    ctx.lineTo(-10,8); ctx.closePath(); ctx.fill();
    const d=DIRS[gh.dir], ex=(frightenedTimer>0?0:d.x*2), ey=(frightenedTimer>0?0:d.y*2);
    ctx.fillStyle='#ecf5ff'; ctx.beginPath(); ctx.arc(-3,-4,3,0,Math.PI*2); ctx.arc(3,-4,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#182a5e'; ctx.beginPath(); ctx.arc(-3+ex,-4+ey,1.5,0,Math.PI*2); ctx.arc(3+ex,-4+ey,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

/* -------------------- Update -------------------- */
function update(){
  if (paused) return;

  tick++;

  if (pacman.alive){
    step(pacman);
    const cx=Math.round(pacman.x), cy=Math.round(pacman.y);
    const cell = grid[cy]?.[cx];
    if (cell===2 || cell===3){
      score += (cell===3?50:10);
      if (cell===3) frightenedTimer=600;
      grid[cy][cx]=0; pellets--; updateHUD();
      if (pellets<=0){ nextLevel(); }
    }
  }

  ghosts.forEach(g=>{ ghostAI(g); step(g); });

  if (frightenedTimer>0) frightenedTimer--;

  // столкновения
  for (const gh of ghosts){
    const dx=gh.x-pacman.x, dy=gh.y-pacman.y;
    if (dx*dx+dy*dy < 0.6){
      if (frightenedTimer>0){
        score += 200; updateHUD();
        gh.x=CENTER.x; gh.y=CENTER.y-1; gh.dir='left';
      } else if (pacman.alive){
        lives--; updateHUD();
        if (lives<0){ paused=true; showBanner("Игра окончена","Нажми «Заново» чтобы начать снова"); }
        respawn();
        break;
      }
    }
  }
}

function respawn(){
  Object.assign(pacman, { x:CENTER.x, y:CENTER.y, dir:'left', nextDir:'left', alive:true });
  ghosts[0].x=CENTER.x-1; ghosts[0].y=CENTER.y-1; ghosts[0].dir='left';
  ghosts[1].x=CENTER.x+1; ghosts[1].y=CENTER.y-1; ghosts[1].dir='right';
  ghosts[2].x=CENTER.x-1; ghosts[2].y=CENTER.y+1; ghosts[2].dir='up';
  ghosts[3].x=CENTER.x+1; ghosts[3].y=CENTER.y+1; ghosts[3].dir='down';
  frightenedTimer=0;
}

function nextLevel(){
  level++;
  lives = 3;                   // как просил — на новом уровне 3 жизни
  buildGrid();
  respawn();
  updateHUD();
}

/* -------------------- Music & SFX -------------------- */
let audioEnabled = true, musicOn = true;
let audioCtx, master, musicGain, sfxGain, melodyTimer;

function ensureAudio(){
  if (!audioCtx){
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    master = audioCtx.createGain(); master.gain.value = 0.9;
    sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.9;
    musicGain = audioCtx.createGain(); musicGain.gain.value = 0.35;
    sfxGain.connect(master); musicGain.connect(master); master.connect(audioCtx.destination);
  }
}
function playTone(freq=600, dur=0.06, type='triangle', gainNode=sfxGain){
  if (!audioEnabled) return; ensureAudio();
  const now=audioCtx.currentTime, o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,now);
  g.gain.setValueAtTime(0.001,now); g.gain.linearRampToValueAtTime(0.18,now+0.01);
  g.gain.exponentialRampToValueAtTime(0.001,now+dur);
  o.connect(g).connect(gainNode); o.start(now); o.stop(now+dur+0.02);
}

/* Внимание: точную мелодию «Крёстный отец» я дать не могу (авторские права),
   поэтому включил короткую оригинальную 3/4-мелодию «в вайбе» старого рингтона. */
const WALTZ = [
  {n:392,t:0.24},{n:523,t:0.24},{n:493,t:0.24},{n:392,t:0.36},{n:0,t:0.08},
  {n:392,t:0.24},{n:587,t:0.24},{n:523,t:0.24},{n:392,t:0.36},{n:0,t:0.12},
  {n:392,t:0.24},{n:523,t:0.24},{n:493,t:0.24},{n:392,t:0.48}
];
function startMusic(){
  if (!musicOn) return;
  ensureAudio(); stopMusic();
  let i=0;
  melodyTimer = setInterval(()=>{
    const step=WALTZ[i%WALTZ.length];
    if (step.n>0){
      const now=audioCtx.currentTime, o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='square'; o.frequency.setValueAtTime(step.n,now);
      g.gain.setValueAtTime(0.001,now); g.gain.linearRampToValueAtTime(0.10,now+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,now+step.t);
      o.connect(g).connect(musicGain); o.start(now); o.stop(now+step.t+0.05);
    }
    i++;
  }, 220);
}
function stopMusic(){ if (melodyTimer) clearInterval(melodyTimer); }

/* -------------------- UI & Controls -------------------- */
const btnPause   = document.getElementById('btnPause');
const btnRestart = document.getElementById('btnRestart');
const btnSound   = document.getElementById('btnSound');
const btnMusic   = document.getElementById('btnMusic');
const btnStart   = document.getElementById('btnStart');
const startOverlay = document.getElementById('start');

btnPause.addEventListener('click', ()=>{
  paused = !paused;
  btnPause.textContent = paused ? 'Продолжить ▶' : 'Пауза ⏸';
  if (!paused) loop();
});
btnRestart.addEventListener('click', ()=>{ startNewGame(); });
btnSound.addEventListener('click', ()=>{
  audioEnabled = !audioEnabled;
  btnSound.textContent = audioEnabled ? 'Звук 🔊' : 'Звук 🔈';
  if (audioEnabled) playTone(880,0.12,'triangle');
});
btnMusic.addEventListener('click', ()=>{
  musicOn = !musicOn;
  btnMusic.textContent = musicOn ? 'Мелодия ⏹' : 'Мелодия ♫';
  if (musicOn) startMusic(); else stopMusic();
});

btnStart.addEventListener('click', beginFromOverlay);
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter' && startOverlay.style.display !== 'none'){ beginFromOverlay(); }
});

function beginFromOverlay(){
  startOverlay.style.display = 'none';
  ensureAudio();
  if (audioCtx.state==='suspended') audioCtx.resume();
  playTone(880,0.14,'triangle');
  if (musicOn) startMusic();
  canvas.focus();
}

/* клавиатура */
const DIR_KEYS = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
document.addEventListener('keydown', (e)=>{
  if (DIR_KEYS[e.key]){ pacman.nextDir = DIR_KEYS[e.key]; e.preventDefault(); }
  if (e.key===' '){ paused=!paused; btnPause.textContent = paused?'Продолжить ▶':'Пауза ⏸'; if(!paused) loop(); e.preventDefault(); }
},{passive:false});

/* мобильные свайпы */
let tStart=null;
canvas.addEventListener('touchstart', (e)=>{ const t=e.changedTouches[0]; tStart={x:t.clientX,y:t.clientY}; }, {passive:true});
canvas.addEventListener('touchend', (e)=>{
  if (!tStart) return;
  const t=e.changedTouches[0]; const dx=t.clientX-tStart.x, dy=t.clientY-tStart.y;
  if (Math.max(Math.abs(dx),Math.abs(dy))>18){
    pacman.nextDir = (Math.abs(dx)>Math.abs(dy)) ? (dx>0?'right':'left') : (dy>0?'down':'up');
  }
  tStart=null;
}, {passive:true});

/* тачпад свайпы (по wheel) */
let wheelLockUntil = 0;
canvas.addEventListener('wheel', (e)=>{
  const now = performance.now();
  if (now < wheelLockUntil) return;
  const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
  if (ax>ay && ax>6){ pacman.nextDir = e.deltaX>0?'right':'left'; wheelLockUntil = now+120; }
  else if (ay>ax && ay>6){ pacman.nextDir = e.deltaY>0?'down':'up'; wheelLockUntil = now+120; }
  e.preventDefault();
},{passive:false});

/* -------------------- Loop & Start -------------------- */
function showBanner(title,subtitle){
  const w=COLS*TILE, h=ROWS*TILE, cx=w/2, cy=h/2;
  ctx.save(); ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,w,h); ctx.restore();
  ctx.save(); ctx.fillStyle='rgba(14,26,54,.92)'; ctx.strokeStyle='#3554c6'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.roundRect(cx-220, cy-70, 440, 140, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#e6f0ff'; ctx.font='700 24px Inter, system-ui, sans-serif'; ctx.textAlign='center';
  ctx.fillText(title,cx,cy-16); ctx.font='600 14px Inter, system-ui, sans-serif'; ctx.fillStyle='#a9b9df';
  ctx.fillText(subtitle,cx,cy+10); ctx.restore();
}

function render(){ drawMaze(); drawActors(); if (paused && lives>=0) showBanner('Пауза','Пробел или «Продолжить».'); }

function loop(){
  if (paused) { render(); return; }
  update(); render(); requestAnimationFrame(loop);
}

function startNewGame(){
  level = 1; lives = 3; score = 0;
  buildGrid(); respawn(); updateHUD(); paused = false;
  loop();
}

/* init */
buildGrid(); fitCanvas(); updateHUD(); render();
