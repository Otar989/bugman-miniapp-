/* Bugman — core */

const tg = window.Telegram?.WebApp;
let DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
const COLS = 28, ROWS = 31;
const app = document.getElementById('app');
const stage = document.getElementById('stage');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha:false });
let TILE = 24;

function getViewportHeight(){
  if (tg && tg.viewportStableHeight) return tg.viewportStableHeight;
  return window.innerHeight;
}

function layout(){
  const hud = document.getElementById('hud');
  const appW = app.clientWidth;
  const appH = getViewportHeight();
  const hudH = hud?.offsetHeight || 0;

  const stageW = appW;
  const stageH = appH - hudH;

  const tileW = Math.floor(stageW / COLS);
  const tileH = Math.floor(stageH / ROWS);
  const tile = Math.max(1, Math.min(tileW, tileH));

  const drawW = tile * COLS;
  const drawH = tile * ROWS;

  DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  canvas.width  = drawW * DPR;
  canvas.height = drawH * DPR;
  canvas.style.width  = `${drawW}px`;
  canvas.style.height = `${drawH}px`;

  ctx.setTransform(DPR,0,0,DPR,0,0);

  stage.style.gridTemplateColumns = `${drawW}px`;
  stage.style.gridTemplateRows = `${drawH}px`;

  TILE = tile;

  if (typeof ctx.clearRect === 'function' && typeof ctx.createLinearGradient === 'function') draw();
}

let raf;
function safeLayout(){
  const rAF = globalThis.requestAnimationFrame || setTimeout;
  const cAF = globalThis.cancelAnimationFrame || clearTimeout;
  cAF(raf);
  raf = rAF(layout);
}

window.addEventListener('resize', safeLayout);
window.addEventListener('orientationchange', () => setTimeout(safeLayout,50));
if (tg) tg.onEvent('viewportChanged', safeLayout);

safeLayout();

// ===== Audio (минимум, чтобы не падало без жеста)
let audioCtx, master, sfxGain, musicGain, musicTimer=null, musicOn=false, melodyIndex=0, audioEnabled=true;
function ensureAudio(){
  if (!audioCtx) {
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    master = audioCtx.createGain(); master.gain.value = 0.8;
    sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.9;
    musicGain = audioCtx.createGain(); musicGain.gain.value = 0.35;
    sfxGain.connect(master); musicGain.connect(master); master.connect(audioCtx.destination);
  }
}
function tone(freq, dur, type='sine', gainNode=sfxGain){
  if (!audioEnabled) return;
  ensureAudio(); const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.18, now+0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now+dur);
  o.connect(g).connect(gainNode); o.start(now); o.stop(now+dur+0.02);
}
const THEMES = [
  [523, 659, 784, 659, 587, 739, 880, 0, 523, 659, 784, 988],
  [659, 523, 587, 523, 494, 587, 659, 0, 659, 587, 523, 587],
  [440, 554, 659, 554, 440, 554, 659, 0, 659, 554, 440, 554]
];

function startMusic(){
  ensureAudio();
  stopMusic();
  if (musicTimer !== null){ clearInterval(musicTimer); musicTimer=null; }
  musicOn = true;
  const THEME = THEMES[melodyIndex];
  let i=0;
  musicTimer = setInterval(()=>{
    if (!musicOn) return;
    const n = THEME[i%THEME.length];
    if (n>0) tone(n, 0.18, 'square', musicGain);
    i++;
  }, 200);
}
function stopMusic(){ musicOn=false; if (musicTimer){ clearInterval(musicTimer); musicTimer=null; } }

// не паузим игру сами по себе, только звук глушим при сворачивании
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden) stopMusic();
});

// ===== Level
// '1' — стена, ' ' — проход (пусто), всё проходимое будет заполнено обычными точками,
// крупные точки добавим вручную.
const RAW = [
"1111111111111111111111111111",
"1            11            1",
"1 1111 11111 11 11111 1111 1",
"1 1  1 1   1 11 1   1 1  1 1",
"1 1111 11111 11 11111 1111 1",
"1                        oo 1",
"1 1111 11 11111111 11 1111 1",
"1 1111 11 11111111 11 1111 1",
"1      11    11    11      1",
"11111  11111 11 11111  11111",
"00001  11111 11 11111  10000",
"00001  11          11  10000",
"11111  11 111--111 11  11111",
"     .    1G B P1    .      ",
"11111  11 11111111 11  11111",
"00001  11    22    11  10000",
"00001  11 11111111 11  10000",
"11111  11 11    11 11  11111",
"1            11            1",
"1 1111 11111 11 11111 1111 1",
"1 1        1 11 1        1 1",
"1  111111 11 11 11 111111  1",
"1   22                22   1",
"1 111111111111111111111111 1",
"1            p             1",
"1 1111111111 11 1111111111 1",
"1                          1",
"1 1111111111 11 1111111111 1",
"1            11            1",
"1                          1",
"1111111111111111111111111111"
];
// нормализуем сетку
const WALL=1, EMPTY=0, DOT=2, POWER=3;
let grid=[], pellets=0;

// стартовые координаты (строго центр клетки)
let spawn = { x:13.5, y:23.5, dir:'left' };
const ghosts = [
  {name:'Blinky', color:'#ff4b5c', x:13.5, y:14.5, dir:'left',  speed:0.095, mode:'chase'},
  {name:'Pinky',  color:'#ff7ad9', x:14.5, y:14.5, dir:'right', speed:0.090, mode:'chase'},
  {name:'Inky',   color:'#00d1d1', x:13.5, y:15.5, dir:'up',    speed:0.088, mode:'chase'},
  {name:'Clyde',  color:'#ffb84d', x:14.5, y:15.5, dir:'down',  speed:0.085, mode:'chase'}
];
const pacman = { x:spawn.x, y:spawn.y, dir:spawn.dir, nextDir:spawn.dir, speed:0.11, alive:true };

function inBounds(c,r){ return c>=0&&c<COLS&&r>=0&&r<ROWS; }

function findNearestPassable(tx,ty){
  const seen = Array.from({length:ROWS},()=>Array(COLS).fill(false));
  const q=[[tx,ty]]; seen[ty][tx]=true;
  while(q.length){
    const [cx,cy]=q.shift();
    if (grid[cy] && grid[cy][cx]!==WALL) return {x:cx+0.5,y:cy+0.5};
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=cx+dx, ny=cy+dy;
      if(!inBounds(nx,ny) || seen[ny][nx]) continue;
      seen[ny][nx]=true; q.push([nx,ny]);
    }
  }
  return {x:tx+0.5,y:ty+0.5};
}

function getValidSpawn(){
  let sx=Math.floor(spawn.x), sy=Math.floor(spawn.y);
  for(let r=0;r<ROWS;r++){
    const c=(RAW[r]||'').indexOf('p');
    if(c>=0){ sx=c; sy=r; break; }
  }
  return findNearestPassable(sx,sy);
}

function spawnPlayer(){
  const s=getValidSpawn();
  pacman.x=Math.floor(s.x)+0.5;
  pacman.y=Math.floor(s.y)+0.5;
  pacman.dir=spawn.dir;
  pacman.nextDir=spawn.dir;
  pacman.speed=0.11;
  pacman.alive=true;
  const tile=grid[Math.floor(pacman.y)]?.[Math.floor(pacman.x)];
  if(tile===WALL){
    const safe=findNearestPassable(Math.floor(pacman.x),Math.floor(pacman.y));
    pacman.x=safe.x; pacman.y=safe.y;
  }
}

function buildLevel(){
  pellets=0;
  // первичный разбор: стены / «дверь» -- считаем стеной
  grid = Array.from({length:ROWS}, (_,r)=> Array.from({length:COLS}, (_,c)=>{
    const ch = (RAW[r]||'')[c] || ' ';
    if (ch==='1' || ch==='-') return WALL;
    return EMPTY; // всё остальное пока пусто
  }));

  const valid = getValidSpawn();
  spawn.x = valid.x; spawn.y = valid.y;

  // заполняем съедобное везде, где не стены и не «дом призраков»
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    // дом призраков: прямоугольник 11..16 / 10..17 — оставляем пустым
    const inHouse = (r>=11&&r<=16)&&(c>=10&&c<=17);
    if (grid[r][c]!==WALL && !inHouse){
      grid[r][c]=DOT; pellets++;
    }
  }
  // крупные точки по углам
  const powers = [[1,1],[COLS-2,1],[1,ROWS-2],[COLS-2,ROWS-2]];
  for (const [c,r] of powers){
    if (grid[r][c]!==WALL){ if (grid[r][c]===DOT) pellets--; grid[r][c]=POWER; pellets++; }
  }

  // удаляем недостижимые точки (BFS от старта)
  const seen = Array.from({length:ROWS}, ()=> Array(COLS).fill(false));
  const Q = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
  seen[Q[0][1]][Q[0][0]] = true;
  while(Q.length){
    const [cx,cy]=Q.shift();
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=cx+dx, ny=cy+dy;
      if (inBounds(nx,ny) && !seen[ny][nx] && grid[ny][nx]!==WALL){
        seen[ny][nx]=true; Q.push([nx,ny]);
      }
    }
  }
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    if (!seen[r][c] && (grid[r][c]===DOT || grid[r][c]===POWER)){ grid[r][c]=EMPTY; pellets--; }
  }

  // сброс позиций
  spawnPlayer();
  ghosts[0].x=13.5; ghosts[0].y=14.5; ghosts[0].dir='left';
  ghosts[1].x=14.5; ghosts[1].y=14.5; ghosts[1].dir='right';
  ghosts[2].x=13.5; ghosts[2].y=15.5; ghosts[2].dir='up';
  ghosts[3].x=14.5; ghosts[3].y=15.5; ghosts[3].dir='down';
}
buildLevel();

// ===== HUD
let levelIndex=0, score=0, lives=3, paused=false, frightened=0, tick=0, gameOver=false;
let resumeMusic=false; // помнить состояние мелодии во время паузы
let loopHandle=null;   // текущий кадр анимации
function HUD(){
  document.getElementById('score').textContent=score;
  document.getElementById('lives').textContent=lives;
  document.getElementById('level').textContent=levelIndex+1;
}

async function saveRecord(finalScore){
  const user = Telegram?.WebApp?.initDataUnsafe?.user;
  const name = user?.username || user?.first_name || 'Безымянный';
  try {
    if (typeof localStorage !== 'undefined'){
      const records = JSON.parse(localStorage.getItem('records') || '[]');
      const ex = records.find(r=>r.username===name);
      if (!ex || finalScore>ex.score){
        if (ex) ex.score = finalScore; else records.push({username:name, score:finalScore});
        localStorage.setItem('records', JSON.stringify(records));
      }
      localStorage.setItem('lastKnownScore', finalScore);
    }
  } catch(_){ }
  try {
    const { submitScore } = await import('./api.js');
    await submitScore(finalScore);
  } catch(_){ }
}

// ===== Управление
const DIRS = {left:{x:-1,y:0}, right:{x:1,y:0}, up:{x:0,y:-1}, down:{x:0,y:1}};
const KEYS = {
  ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
  a:'left', A:'left', ф:'left', Ф:'left',
  d:'right', D:'right', в:'right', В:'right',
  w:'up', W:'up', ц:'up', Ц:'up',
  s:'down', S:'down', ы:'down', Ы:'down'
};

addEventListener('keydown', (e)=>{
  if (KEYS[e.key]){ pacman.nextDir = KEYS[e.key]; e.preventDefault(); }
  else if (e.key===' '){
    // пробрасываем на кнопку паузы, чтобы логика совпадала
    document.getElementById('btnPause').click();
    e.preventDefault();
  }
}, {passive:false});

// свайпы: палец и тачпад
let tStart=null, lastWheel=0;
canvas.addEventListener('touchstart',(e)=>{ const t=e.changedTouches[0]; tStart={x:t.clientX,y:t.clientY}; }, {passive:true});
canvas.addEventListener('touchend',(e)=>{
  if (!tStart) return;
  const t=e.changedTouches[0], dx=t.clientX-tStart.x, dy=t.clientY-tStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy))>20){
    pacman.nextDir = (Math.abs(dx)>Math.abs(dy)) ? (dx>0?'right':'left') : (dy>0?'down':'up');
  }
  tStart=null;
}, {passive:true});
// тачпад (wheel)
canvas.addEventListener('wheel', (e)=>{
  const now=performance.now(); if (now-lastWheel<80) return; lastWheel=now;
  if (Math.abs(e.deltaX)>Math.abs(e.deltaY)) pacman.nextDir = e.deltaX>0?'right':'left';
  else pacman.nextDir = e.deltaY>0?'down':'up';
}, {passive:true});

// кнопки
const btnPause   = document.getElementById('btnPause');
const btnRestart = document.getElementById('btnRestart');
const btnSound   = document.getElementById('btnSound');
const btnMusic   = document.getElementById('btnMusic');
const btnStart   = document.getElementById('btnStart');
const gate       = document.getElementById('gate');
const startTitle = gate.querySelector('.title');
const startSub   = gate.querySelector('.sub');
const startDefaults = {
  title: startTitle.textContent,
  sub: startSub.textContent,
  btn: btnStart.textContent
};

btnPause.onclick = ()=>{
  const wasMusicOn = musicOn; // запоминаем текущую мелодию
  paused = !paused;
  btnPause.textContent = paused ? 'Продолжить ▶' : 'Пауза ⏸';
  if (paused){
    resumeMusic = wasMusicOn;
    stopMusic();
  } else {
    if (resumeMusic){
      startMusic();
      btnMusic.textContent = `Мелодия ${melodyIndex+1} ⏹`;
    } else {
      btnMusic.textContent = 'Мелодия ♫';
    }
    loop();
  }
};
btnRestart.onclick = ()=> restart();
btnSound.onclick = ()=>{
  audioEnabled=!audioEnabled;
  btnSound.textContent = audioEnabled?'Звук 🔊':'Звук 🔈';
  if (audioEnabled) tone(800,0.12,'triangle');
};
btnMusic.onclick = ()=>{
  if (!musicOn){
    startMusic();
    btnMusic.textContent = `Мелодия ${melodyIndex+1} ⏹`;
  } else {
    melodyIndex++;
    if (melodyIndex<3){
      startMusic();
      btnMusic.textContent = `Мелодия ${melodyIndex+1} ⏹`;
    } else {
      stopMusic();
      melodyIndex=0;
      btnMusic.textContent='Мелодия ♫';
    }
  }
};

function hideStartOverlay(){
  startTitle.textContent = startDefaults.title;
  startSub.textContent   = startDefaults.sub;
  btnStart.textContent   = startDefaults.btn;
  gate.hidden = true;
}

function showGameOver(){
  startTitle.textContent = 'Жизни закончились';
  startSub.textContent   = 'Нажми «Заново», чтобы начать сначала';
  btnStart.textContent   = 'Заново ↻';
  gate.hidden = false;
}

// Если TG меняет высоту/ориентацию — не возвращаем модалку случайно
tg?.onEvent?.('viewportChanged', () => {});

function startGame(){
  ensureAudio(); audioCtx.resume?.();
  hideStartOverlay();
  paused=false; btnPause.textContent='Пауза ⏸';
  if (!musicOn){
    startMusic();
    btnMusic.textContent = `Мелодия ${melodyIndex+1} ⏹`;
  }
  if (loopHandle){ cancelAnimationFrame(loopHandle); loopHandle=null; }
  loop();
}
function restart(){
  ensureAudio(); audioCtx.resume?.();
  score=0; lives=3; levelIndex=0; gameOver=false; HUD(); buildLevel(); paused=false; frightened=0;
  const wasMusicOn = musicOn || resumeMusic;
  musicOn = wasMusicOn;
  if (wasMusicOn){
    startMusic();
    btnMusic.textContent = `Мелодия ${melodyIndex+1} ⏹`;
  } else {
    btnMusic.textContent = 'Мелодия ♫';
  }
  resumeMusic=false;
  if (loopHandle){ cancelAnimationFrame(loopHandle); loopHandle=null; }
  loop();
}

// Старт игры по кнопке/Enter/Telegram MainButton
(()=> {
  const tg = window.Telegram?.WebApp;

  async function unlockAudio(){
    try { if (window.Howler?.ctx?.state === 'suspended') await Howler.ctx.resume(); } catch {}
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        window._actx = window._actx || new AC();
        if (window._actx.state === 'suspended') await window._actx.resume();
      }
    } catch {}
    try { ensureAudio(); if (audioCtx?.state === 'suspended') await audioCtx.resume(); } catch {}
  }

  async function startHandler(){
    if (gate.hidden) return;
    gate.setAttribute('hidden','');
    await unlockAudio();
    if (gameOver) restart(); else startGame();
  }

  function wireStart(){
    const btn = document.getElementById('btnStart');
    btn?.addEventListener('click', e => { e.preventDefault(); startHandler(); }, { once:true });
  }

  document.addEventListener('click', e => {
    if (!gate.hidden && e.target.closest('#btnStart')) {
      e.preventDefault(); startHandler();
    }
  });

  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.code === 'Enter') && !gate.hidden) {
      e.preventDefault(); startHandler();
    }
  });

  tg?.onEvent?.('mainButtonClicked', startHandler);

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', wireStart, { once:true });
  else
    wireStart();
})();

// ===== Движок тайлов
function tileAt(x,y){ // x,y — целые клетки
  if (!inBounds(x,y)) return WALL;
  return grid[y][x];
}
function canGo(cx,cy,dir){ // из центра клетки
  const nx=cx+DIRS[dir].x, ny=cy+DIRS[dir].y;
  if (!inBounds(nx,ny)) return true; // выход за край — тоннель
  return tileAt(nx,ny)!==WALL;
}
function stepActor(a){
  const cx=Math.floor(a.x), cy=Math.floor(a.y);
  const centered = Math.abs(a.x-(cx+0.5))<0.08 && Math.abs(a.y-(cy+0.5))<0.08;

  // смена курса только в центре
  if (centered && a.nextDir && canGo(cx,cy,a.nextDir)) a.dir=a.nextDir;

  // если впереди стена — останемся в центре
  if (centered && !canGo(cx,cy,a.dir)){ a.x=cx+0.5; a.y=cy+0.5; return; }

  // движемся
  a.x += DIRS[a.dir].x * a.speed;
  a.y += DIRS[a.dir].y * a.speed;

  // тоннели
  if (a.x < 0) a.x += COLS;
  else if (a.x >= COLS) a.x -= COLS;
  if (a.y < 0) a.y += ROWS;
  else if (a.y >= ROWS) a.y -= ROWS;
}

function ghostAI(g){
  // режим испуга — блуждаем
  if (frightened>0){
    const cx=Math.floor(g.x), cy=Math.floor(g.y);
    const centered = Math.abs(g.x-(cx+0.5))<0.08 && Math.abs(g.y-(cy+0.5))<0.08;
    if (centered){
      // не разворачиваемся в обратную сторону, если есть варианты
      const back = {left:'right',right:'left',up:'down',down:'up'}[g.dir];
      let opts = ['left','right','up','down'].filter(d=> d!==back && canGo(cx,cy,d));
      if (!opts.length) opts = ['left','right','up','down'].filter(d=> canGo(cx,cy,d));
      g.dir = opts[Math.floor(Math.random()*opts.length)];
    }
    return;
  }

  // преследование с разбросом целей
  const cx=Math.floor(g.x), cy=Math.floor(g.y);
  const centered = Math.abs(g.x-(cx+0.5))<0.08 && Math.abs(g.y-(cy+0.5))<0.08;
  if (!centered) return;

  const back = {left:'right',right:'left',up:'down',down:'up'}[g.dir];
  const opts = ['left','right','up','down'].filter(d=> d!==back && canGo(cx,cy,d));
  if (!opts.length){ g.dir = back; return; }

  // цель зависит от призрака
  let tx=pacman.x, ty=pacman.y;
  const idx = ghosts.indexOf(g);
  if (idx===1) { // Pinky — немного впереди игрока
    tx += DIRS[pacman.dir].x*2; ty += DIRS[pacman.dir].y*2;
  } else if (idx===2) { // Inky — диагональная путаница
    tx += 2; ty -= 1;
  } else if (idx===3) { // Clyde — ближе к левой нижней
    tx = pacman.x<14 ? 2 : COLS-3; ty = pacman.y>15 ? ROWS-3 : 2;
  }
  // лёгкий рандом, чтобы не шли строем
  tx += (Math.random()-.5)*1.5; ty += (Math.random()-.5)*1.5;

  // выбираем направление с минимальной дистанцией до цели
  let best=opts[0], bestD=1e9;
  for (const d of opts){
    const nx=cx+DIRS[d].x, ny=cy+DIRS[d].y;
    const dd=(nx-tx)*(nx-tx)+(ny-ty)*(ny-ty);
    if (dd<bestD){ bestD=dd; best=d; }
  }
  g.dir = best;
}

// ===== Игровой цикл
function eatAt(x,y){
  const c=Math.floor(x), r=Math.floor(y);
  if (!inBounds(c,r)) return;
  if (grid[r][c]===DOT){ grid[r][c]=EMPTY; score+=10; pellets--; tone(600,0.05,'triangle'); HUD(); }
  else if (grid[r][c]===POWER){ grid[r][c]=EMPTY; score+=50; pellets--; frightened=600; tone(220,0.20,'sawtooth'); HUD(); }
}

function nextLevel(){
  levelIndex++;
  // ускоряем всех слегка
  pacman.speed += 0.012;
  ghosts.forEach((g,i)=> g.speed += 0.010 + i*0.001);
  // жизни снова 3 по твоему запросу
  lives = 3; HUD();
  buildLevel();
  if (musicOn) startMusic();
}

function update(){
  if (paused) return;
  tick++;

  if (pacman.alive){
    stepActor(pacman);
    eatAt(pacman.x,pacman.y);
  }
  ghosts.forEach(g=>{ ghostAI(g); stepActor(g); });

  if (frightened>0) frightened--;

  // столкновения
  for (const g of ghosts){
    const dx=g.x-pacman.x, dy=g.y-pacman.y;
    if (dx*dx+dy*dy < 0.5){
      if (frightened>0){
        score+=200; HUD(); tone(150,0.22,'square');
        g.x=13.5; g.y=14.5; g.dir='left';
      } else if (pacman.alive){
        pacman.alive=false; tone(120,0.5,'square'); setTimeout(()=>tone(80,0.5,'sine'),150);
        lives=Math.max(0,lives-1); HUD();
        if (lives<=0 && !gameOver){
          paused=true; gameOver=true; saveRecord(score);
          resumeMusic = musicOn;
          if (musicOn){
            stopMusic();
            btnMusic.textContent = 'Мелодия ♫';
          }
          showGameOver();
        }
        else {
          // респавн в центр (не в стену)
          spawnPlayer();
          frightened=0;
          ghosts[0].x=13.5; ghosts[0].y=14.5; ghosts[0].dir='left';
          ghosts[1].x=14.5; ghosts[1].y=14.5; ghosts[1].dir='right';
          ghosts[2].x=13.5; ghosts[2].y=15.5; ghosts[2].dir='up';
          ghosts[3].x=14.5; ghosts[3].y=15.5; ghosts[3].dir='down';
        }
      }
    }
  }

  if (pellets<=0) nextLevel();
}

function draw(){
  ctx.clearRect(0,0,canvas.width/DPR,canvas.height/DPR);

  // лабиринт
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const x=c*TILE, y=r*TILE;
    if (grid[r][c]===WALL){
      const g=ctx.createLinearGradient(x,y,x,y+TILE);
      g.addColorStop(0,'#193077'); g.addColorStop(1,'#0a183f');
      ctx.fillStyle=g; ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle='rgba(98,224,255,.5)'; ctx.lineWidth=2;
      ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
    }
  }
  // точки
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++){
    const x=c*TILE+TILE/2, y=r*TILE+TILE/2;
    if (grid[r][c]===DOT){
      ctx.fillStyle='#ffeaae'; ctx.beginPath(); ctx.arc(x,y,2.6,0,Math.PI*2); ctx.fill();
    } else if (grid[r][c]===POWER){
      ctx.fillStyle='#ffd23f'; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
      // лёгкое свечение
      const glow=ctx.createRadialGradient(x,y,2, x,y,18);
      glow.addColorStop(0,'rgba(255,210,63,.9)'); glow.addColorStop(1,'rgba(255,210,63,.05)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.fill();
    }
  }

  // пакман
  const open = 0.25+0.15*Math.sin((tick%20)/20*Math.PI*2);
  const angle = {left:Math.PI, right:0, up:-Math.PI/2, down:Math.PI/2}[pacman.dir]||0;
  ctx.save(); ctx.translate(pacman.x*TILE, pacman.y*TILE); ctx.rotate(angle);
  const grad=ctx.createRadialGradient(0,-4,2,0,0,14);
  grad.addColorStop(0,'#fff4a8'); grad.addColorStop(1,'#ffcc00');
  ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(0,0);
  ctx.arc(0,0,10,open,Math.PI*2-open); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#071b3a'; ctx.beginPath(); ctx.arc(2,-4,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // призраки
  for (const g of ghosts){
    ctx.save(); ctx.translate(g.x*TILE, g.y*TILE);
    const body = frightened>0 ? '#4466ff' : g.color;
    const grd=ctx.createLinearGradient(0,-12,0,12);
    grd.addColorStop(0,body); grd.addColorStop(1,'#0a1230');
    ctx.fillStyle=grd;
    ctx.beginPath(); ctx.arc(0,-2,10,Math.PI,0,false); ctx.lineTo(10,8);
    for(let i=0;i<4;i++){ ctx.lineTo(6-i*4,12); ctx.lineTo(3-i*4,8); }
    ctx.lineTo(-10,8); ctx.closePath(); ctx.fill();
    // глаза
    const vx = frightened>0 ? 0 : DIRS[g.dir].x*2, vy = frightened>0 ? 0 : DIRS[g.dir].y*2;
    ctx.fillStyle='#ecf5ff'; ctx.beginPath(); ctx.arc(-3,-4,3,0,Math.PI*2); ctx.arc(3,-4,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#182a5e'; ctx.beginPath(); ctx.arc(-3+vx,-4+vy,1.5,0,Math.PI*2); ctx.arc(3+vx,-4+vy,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function loop(){
  if (paused){ draw(); loopHandle=null; return; }
  update(); draw();
  loopHandle = requestAnimationFrame(loop);
}

// инициализация HUD
HUD();

if (typeof module !== 'undefined') {
  module.exports = { buildLevel, spawnPlayer, getValidSpawn, grid, WALL, pacman, spawn, RAW };
}
