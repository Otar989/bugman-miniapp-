/* ===== Bugman – game.js (полная версия) ===== */

/* --- Константы и утилиты --- */
const TILE = 24, ROWS = 31, COLS = 28;

const DIRS = {
  left:  {x:-1, y: 0},
  right: {x: 1, y: 0},
  up:    {x: 0, y:-1},
  down:  {x: 0, y: 1}
};
const REVERSE = {left:'right', right:'left', up:'down', down:'up'};
const DIR_KEYS = {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down'};

let grid = [], pellets = 0;
let score = 0, lives = 3, levelIndex = 0;
let paused = false, frightenedTimer = 0, tick = 0;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

function fitCanvas(){
  const w = COLS*TILE, h = ROWS*TILE;
  canvas.width = w * DPR;
  canvas.height = h * DPR;
  canvas.style.aspectRatio = `${w}/${h}`;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
fitCanvas();
addEventListener('resize', fitCanvas);

/* --- Аудио (проще, но аккуратно) --- */
let audioEnabled = true, audioCtx, master, musicGain, sfxGain, musicOn=false, musicTimer=null;
function ensureAudio(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    master = audioCtx.createGain(); master.gain.value = 0.9;
    sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.9;
    musicGain = audioCtx.createGain(); musicGain.gain.value = 0.38;
    sfxGain.connect(master); musicGain.connect(master); master.connect(audioCtx.destination);
  }
}
function tone(freq, dur=0.12, type='sine', gain=sfxGain){
  if(!audioEnabled) return;
  ensureAudio();
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.2, t+0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g).connect(gain);
  o.start(t); o.stop(t+dur+0.02);
}
const SFX = {
  chomp:  ()=>tone(620,0.06,'triangle'),
  power:  ()=>tone(230,0.25,'sawtooth'),
  eat:    ()=>tone(180,0.22,'square'),
  death1: ()=>tone(90,0.5,'square'),
  death2: ()=>tone(55,0.5,'sine'),
  start:  ()=>tone(880,0.16,'triangle')
};

/* «Новая» короткая мелодия (не как раньше) */
const THEME = [
  {n:440, t:0.20}, {n:554.37, t:0.20}, {n:659.25, t:0.24}, {n:0, t:0.08},
  {n:523.25, t:0.18}, {n:659.25, t:0.18}, {n:784.00, t:0.26}, {n:0, t:0.1},
];
function startMusic(){
  ensureAudio(); stopMusic(); musicOn = true;
  let i=0;
  musicTimer = setInterval(()=>{
    if(!musicOn) return;
    const step = THEME[i % THEME.length];
    if(step.n>0){
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type='square'; o.frequency.setValueAtTime(step.n, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.12, t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t+step.t);
      o.connect(g).connect(musicGain);
      o.start(t); o.stop(t+step.t+0.05);
    }
    i++;
  }, 220);
}
function stopMusic(){ musicOn=false; if(musicTimer) clearInterval(musicTimer); }
document.addEventListener('visibilitychange',()=>{ if(document.hidden) stopMusic(); });

/* --- Уровень (как раньше) --- */
const LEVELS=[[
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

/* --- Состояния актёров --- */
const pacman = { x:14, y:23, dir:'right', nextDir:'right', speed:0.1, alive:true };
const ghosts = [
  {name:'Blinky', color:'#ff4b5c', x:13, y:14, dir:'left',  speed:0.09, mode:'chase', corner:{x:COLS-2,y:1}},
  {name:'Pinky',  color:'#ff7ad9', x:14, y:14, dir:'right', speed:0.085,mode:'chase', corner:{x:1,y:1}},
  {name:'Inky',   color:'#00d1d1', x:13, y:15, dir:'up',    speed:0.085,mode:'chase', corner:{x:COLS-2,y:ROWS-2}},
  {name:'Clyde',  color:'#ffb84d', x:14, y:15, dir:'down',  speed:0.080,mode:'chase', corner:{x:1,y:ROWS-2}}
];

/* --- Служебные --- */
function isWallTile(x,y){ return grid[y] && grid[y][x]===1; }
function isInside(x,y){ return x>=0 && x<COLS && y>=0 && y<ROWS; }

function canMoveFrom(x,y,dir){
  const nx = x + DIRS[dir].x, ny = y + DIRS[dir].y;
  if(!isInside(nx,ny)) return true;  // выход к «туннелю»
  return !isWallTile(nx,ny);
}

/* BFS — ближайшая свободная клетка (выталкивание из стены) */
function nearestOpenCell(x, y){
  const sx=Math.round(x), sy=Math.round(y);
  const seen=new Set([`${sx},${sy}`]);
  const q=[[sx,sy]];
  while(q.length){
    const [cx,cy]=q.shift();
    if(isInside(cx,cy) && !isWallTile(cx,cy)) return {x:cx, y:cy};
    for(const d of Object.values(DIRS)){
      const nx=cx+d.x, ny=cy+d.y;
      if(isInside(nx,ny)){
        const k=`${nx},${ny}`;
        if(!seen.has(k)){ seen.add(k); q.push([nx,ny]); }
      }
    }
  }
  return {x:1,y:1};
}

/* Формирование уровня + корректный спавн */
function buildLevel(){
  pellets = 0;
  const raw = LEVELS[levelIndex];
  grid = Array.from({length:ROWS},(_,r)=>
    Array.from({length:COLS},(_,c)=>{
      const ch=(raw[r]||'')[c]||' ';
      if(ch==='1') return 1;        // стена
      if(ch==='3'){ pellets++; return 3; } // силовая
      return 0;                     // временно пусто
    })
  );
  // заполняем дорожками, кроме «домика»
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(grid[r][c]===0 && !((r>=11&&r<=16)&&(c>=10&&c<=17))){
      grid[r][c]=2; pellets++;
    }
  }
  // бонусные большие точки
  for(const [r,c] of [[1,1],[1,COLS-2],[ROWS-2,1],[ROWS-2,COLS-2]]){
    if(grid[r][c]!==1){ if(grid[r][c]===2) pellets--; grid[r][c]=3; pellets++; }
  }

  // стартовые позиции и «выталкивание»
  Object.assign(pacman, {x:14, y:23, dir:'right', nextDir:'right', speed:0.1, alive:true});
  if(isWallTile(Math.round(pacman.x), Math.round(pacman.y))){
    const p = nearestOpenCell(pacman.x, pacman.y);
    pacman.x = p.x; pacman.y = p.y;
  }
  [[13,14,'left'],[14,14,'right'],[13,15,'up'],[14,15,'down']]
    .forEach((v,i)=>{ghosts[i].x=v[0]; ghosts[i].y=v[1]; ghosts[i].dir=v[2]; ghosts[i].mode='chase';});

  frightenedTimer = 0;
}
buildLevel();

/* --- HUD --- */
const elScore = document.getElementById('score');
const elLives = document.getElementById('lives');
const elLevel = document.getElementById('level');
function updateHUD(){
  if(elScore) elScore.textContent = score;
  if(elLives) elLives.textContent = Math.max(0,lives);
  if(elLevel) elLevel.textContent = levelIndex+1;
}
updateHUD();

/* --- Кнопки --- */
const btnPause   = document.getElementById('btnPause');
const btnRestart = document.getElementById('btnRestart');
const btnSound   = document.getElementById('btnSound');
const btnMusic   = document.getElementById('btnMusic');
const btnStart   = document.getElementById('btnStart');
const startOverlay = document.getElementById('start');

btnPause && btnPause.addEventListener('click',()=>{
  paused = !paused;
  btnPause.textContent = paused ? 'Продолжить ▶' : 'Пауза ⏸';
  if(!paused) loop();
});
btnRestart && btnRestart.addEventListener('click',()=>{
  score=0; lives=3; levelIndex=0; updateHUD(); buildLevel(); paused=false; loop();
});
btnSound && btnSound.addEventListener('click',()=>{
  audioEnabled = !audioEnabled;
  btnSound.textContent = audioEnabled ? 'Звук 🔊' : 'Звук 🔈';
  SFX.start();
});
btnMusic && btnMusic.addEventListener('click',()=>{
  ensureAudio(); if(audioCtx.state==='suspended') audioCtx.resume();
  if(!musicOn){ startMusic(); btnMusic.textContent='Мелодия ⏹'; } else { stopMusic(); btnMusic.textContent='Мелодия ♫'; }
});
btnStart && btnStart.addEventListener('click', startGameByButton);
function startGameByButton(){
  ensureAudio(); if(audioCtx.state==='suspended') audioCtx.resume();
  SFX.start();
  startOverlay && (startOverlay.style.display='none');
  canvas.focus();
  if(!musicOn) startMusic();
}
addEventListener('keydown',(e)=>{
  if(DIR_KEYS[e.key]){ pacman.nextDir = DIR_KEYS[e.key]; e.preventDefault(); }
  else if(e.key===' '){ paused=!paused; btnPause && (btnPause.textContent = paused?'Продолжить ▶':'Пауза ⏸'); if(!paused) loop(); e.preventDefault(); }
  else if(e.key==='Enter'){ // запуск как просили
    if(startOverlay && startOverlay.style.display!=='none') startGameByButton();
  }
},{passive:false});

/* --- Свайпы (работает и на тачпаде как pointer-gesture) --- */
let swipeStart=null;
function onStart(pt){ swipeStart = {x:pt.clientX, y:pt.clientY}; }
function onEnd(pt){
  if(!swipeStart) return;
  const dx = pt.clientX - swipeStart.x, dy = pt.clientY - swipeStart.y;
  if(Math.max(Math.abs(dx), Math.abs(dy)) > 18){
    pacman.nextDir = (Math.abs(dx)>Math.abs(dy)) ? (dx>0?'right':'left') : (dy>0?'down':'up');
  }
  swipeStart=null;
}
canvas.addEventListener('pointerdown', e=>onStart(e), {passive:true});
canvas.addEventListener('pointerup',   e=>onEnd(e),   {passive:true});
canvas.addEventListener('touchstart',  e=>onStart(e.changedTouches[0]), {passive:true});
canvas.addEventListener('touchend',    e=>onEnd(e.changedTouches[0]),   {passive:true});

/* --- Движение: «не проламывать» стену --- */
function wrap(x,y){
  if(x< -0.51) x = COLS-0.51; else if(x>COLS-0.49) x = -0.49;
  if(y< -0.51) y = ROWS-0.51; else if(y>ROWS-0.49) y = -0.49;
  return [x,y];
}
function stepActor(a){
  const cx = Math.round(a.x), cy = Math.round(a.y);
  const centered = Math.abs(a.x-cx)<0.05 && Math.abs(a.y-cy)<0.05;

  // попытка сменить направление только из центра клетки
  if(centered && a.nextDir && canMoveFrom(cx,cy,a.nextDir)) a.dir = a.nextDir;

  // если впереди стена — прилипнуть к центру, не «вдавливать»
  const fx = cx + DIRS[a.dir].x, fy = cy + DIRS[a.dir].y;
  if(centered && isInside(fx,fy) && isWallTile(fx,fy)){
    a.x = cx; a.y = cy; return;
  }

  let nx = a.x + DIRS[a.dir].x * a.speed;
  let ny = a.y + DIRS[a.dir].y * a.speed;
  [nx,ny] = wrap(nx,ny);

  // переход на соседнюю ячейку: проверка стены по целевому тайлу
  const tx = Math.round(nx), ty = Math.round(ny);
  if(isInside(tx,ty) && isWallTile(tx,ty)){
    a.x = cx; a.y = cy; // остаёмся в центре
  } else {
    a.x = nx; a.y = ny;
  }
}

/* --- Простой «не в кучке» ИИ --- */
let phaseTimer = 0; // чередование фаз
function targetFor(gh){
  const px = Math.round(pacman.x), py = Math.round(pacman.y);
  if(gh.mode==='scatter') return gh.corner;

  switch(gh.name){
    case 'Blinky': return {x:px, y:py};
    case 'Pinky': {
      const ahead = 4;
      return {x:Math.max(0,Math.min(COLS-1, px + DIRS[pacman.dir].x*ahead)),
              y:Math.max(0,Math.min(ROWS-1, py + DIRS[pacman.dir].y*ahead))};
    }
    case 'Inky': {
      // приблизительный «векторный» таргет: точка 2 клетки впереди пакмэна
      const ax = px + DIRS[pacman.dir].x*2;
      const ay = py + DIRS[pacman.dir].y*2;
      return {x:Math.max(0,Math.min(COLS-1, ax)), y:Math.max(0,Math.min(ROWS-1, ay))};
    }
    case 'Clyde': {
      const dx = gh.x - pacman.x, dy = gh.y - pacman.y;
      const d2 = dx*dx + dy*dy;
      return d2 > 64 ? {x:px, y:py} : gh.corner; // близко — уходит в угол
    }
  }
  return {x:px,y:py};
}
function ghostAI(gh){
  // в испуге — рандом
  if(frightenedTimer>0){
    if(Math.random()<0.15){
      const cx=Math.round(gh.x), cy=Math.round(gh.y);
      let opts = Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d) && REVERSE[gh.dir]!==d);
      if(!opts.length) opts = Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d));
      if(opts.length) gh.dir = opts[Math.floor(Math.random()*opts.length)];
    }
    return;
  }

  const cx=Math.round(gh.x), cy=Math.round(gh.y);
  if(Math.abs(gh.x-cx)<0.05 && Math.abs(gh.y-cy)<0.05){
    const t = targetFor(gh);
    let opts = Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d) && REVERSE[gh.dir]!==d);
    if(!opts.length) opts = Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d));

    let best=opts[0], bestDist=1e9;
    for(const d of opts){
      const nx=cx+DIRS[d].x, ny=cy+DIRS[d].y;
      const dx = (nx - t.x), dy = (ny - t.y);
      const dist = dx*dx + dy*dy + (d===gh.dir?-0.15:0); // небольшой бонус за «не сворачивать»
      if(dist<bestDist){ bestDist=dist; best=d; }
    }
    gh.dir = best || gh.dir;
  }
}

/* --- Логика апдейта/отрисовки --- */
function nextLevel(){
  levelIndex = (levelIndex+1) % LEVELS.length;
  pacman.speed += 0.01;
  ghosts.forEach((g,i)=> g.speed += 0.012 + i*0.001);
  lives = 3; // как просили — новые 3 жизни при переходе
  updateHUD();
  buildLevel();
}

function banner(title,subtitle){
  const w=COLS*TILE, h=ROWS*TILE, cx=w/2, cy=h/2;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(14,26,54,.92)'; ctx.strokeStyle='#3554c6'; ctx.lineWidth=3;
  const r=16;
  ctx.beginPath();
  ctx.moveTo(cx-220+r,cy-70);
  ctx.arcTo(cx+220,cy-70,cx+220,cy+70,r);
  ctx.arcTo(cx+220,cy+70,cx-220,cy+70,r);
  ctx.arcTo(cx-220,cy+70,cx-220,cy-70,r);
  ctx.arcTo(cx-220,cy-70,cx+220,cy-70,r);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#e6f0ff'; ctx.font='700 24px Inter, system-ui'; ctx.textAlign='center';
  ctx.fillText(title,cx,cy-16);
  ctx.font='600 14px Inter, system-ui'; ctx.fillStyle='#a9b9df';
  ctx.fillText(subtitle,cx,cy+10);
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // фон‑сетка
  for(let i=0;i<40;i++){
    const x=(i*53)%(COLS*TILE), y=((i*97)%(ROWS*TILE));
    ctx.fillStyle='rgba(255,255,255,.05)'; ctx.fillRect(x,y,2,2);
  }

  // стены
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(grid[r][c]===1){
      const x=c*TILE, y=r*TILE;
      const g=ctx.createLinearGradient(x,y,x,y+TILE);
      g.addColorStop(0,'rgba(22,42,112,1)'); g.addColorStop(1,'rgba(8,18,56,1)');
      ctx.fillStyle=g; ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle='rgba(98,224,255,.65)'; ctx.lineWidth=2; ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
    }
  }
  // крошки
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const x=c*TILE+TILE/2, y=r*TILE+TILE/2;
    if(grid[r][c]===2){
      ctx.fillStyle='#ffeaae'; ctx.beginPath(); ctx.arc(x,y,2.6,0,Math.PI*2); ctx.fill();
    } else if(grid[r][c]===3){
      const t=(tick%60)/60, rad=6+Math.sin(t*2*Math.PI)*2;
      const glow=ctx.createRadialGradient(x,y,2,x,y,18);
      glow.addColorStop(0,'rgba(255,210,63,.95)'); glow.addColorStop(1,'rgba(255,210,63,.05)');
      ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2); ctx.fill();
    }
  }

  // пакмэн
  const t=(tick%20)/20, open=0.25+0.15*Math.sin(t*2*Math.PI),
        ang={left:Math.PI,right:0,up:-Math.PI/2,down:Math.PI/2}[pacman.dir]||0;
  ctx.save();
  ctx.translate(pacman.x*TILE+TILE/2, pacman.y*TILE+TILE/2);
  ctx.rotate(ang);
  const g=ctx.createRadialGradient(0,-4,2,0,0,14);
  g.addColorStop(0,'#fff4a8'); g.addColorStop(1,'#ffcc00');
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(0,0);
  ctx.arc(0,0,10,open,Math.PI*2-open); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#071b3a'; ctx.beginPath(); ctx.arc(2,-4,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // призраки
  ghosts.forEach(gh=>{
    ctx.save();
    ctx.translate(gh.x*TILE+TILE/2, gh.y*TILE+TILE/2);
    const body = (frightenedTimer>0)?'#4466ff':gh.color;
    const grd=ctx.createLinearGradient(0,-12,0,12);
    grd.addColorStop(0,body); grd.addColorStop(1,'#0a1230');
    ctx.fillStyle=grd; ctx.beginPath();
    ctx.arc(0,-2,10,Math.PI,0,false); ctx.lineTo(10,8);
    for(let i=0;i<4;i++){ ctx.lineTo(6-i*4,12); ctx.lineTo(3-i*4,8); }
    ctx.lineTo(-10,8); ctx.closePath(); ctx.fill();

    const d=DIRS[gh.dir]; const ex=(frightenedTimer>0?0:d.x*2), ey=(frightenedTimer>0?0:d.y*2);
    ctx.fillStyle='#ecf5ff'; ctx.beginPath(); ctx.arc(-3,-4,3,0,Math.PI*2); ctx.arc(3,-4,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#182a5e'; ctx.beginPath(); ctx.arc(-3+ex,-4+ey,1.5,0,Math.PI*2); ctx.arc(3+ex,-4+ey,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  if(paused && lives>0) banner('Пауза','Пробел или «Продолжить».');
}

function update(){
  if(paused) return;
  tick++;

  // страховка: если вдруг в стене — выталкиваем
  if(isWallTile(Math.round(pacman.x), Math.round(pacman.y))){
    const p = nearestOpenCell(pacman.x, pacman.y);
    pacman.x = p.x; pacman.y = p.y; pacman.dir='right'; pacman.nextDir='right';
  }

  // фазы призраков (scatter/chase) — каждые ~7 сек переключение
  if(tick%420===0) ghosts.forEach(g=> g.mode = (g.mode==='chase'?'scatter':'chase'));

  if(pacman.alive){
    stepActor(pacman);
    const cx=Math.round(pacman.x), cy=Math.round(pacman.y);
    if(grid[cy] && (grid[cy][cx]===2 || grid[cy][cx]===3)){
      score += (grid[cy][cx]===3?50:10); updateHUD();
      if(grid[cy][cx]===3){ frightenedTimer=600; SFX.power(); } else { if(tick%6===0) SFX.chomp(); }
      grid[cy][cx]=0; pellets--; if(pellets<=0) nextLevel();
    }
  }

  ghosts.forEach(g=>{ ghostAI(g); stepActor(g); });

  if(frightenedTimer>0) frightenedTimer--;

  // столкновения
  for(const g of ghosts){
    const dx=g.x-pacman.x, dy=g.y-pacman.y;
    if(dx*dx+dy*dy < 0.6){
      if(frightenedTimer>0){
        score += 200; updateHUD(); SFX.eat();
        g.x=13; g.y=14; g.dir='left';
      } else if(pacman.alive){
        pacman.alive=false; SFX.death1(); setTimeout(()=>SFX.death2(),160);
        lives = Math.max(0, lives-1); updateHUD();
        if(lives<=0){ paused=true; banner('Игра окончена','Нажми «Заново», чтобы сыграть ещё.'); }
        else {
          Object.assign(pacman,{x:14,y:23,dir:'right',nextDir:'right',alive:true});
          if(isWallTile(14,23)){ const p=nearestOpenCell(14,23); pacman.x=p.x; pacman.y=p.y; }
          frightenedTimer=0;
          [[13,14,'left'],[14,14,'right'],[13,15,'up'],[14,15,'down']].forEach((v,i)=>{ghosts[i].x=v[0]; ghosts[i].y=v[1]; ghosts[i].dir=v[2];});
        }
      }
    }
  }
}

function loop(){ if(paused){ draw(); return; } update(); draw(); requestAnimationFrame(loop); }
loop();

/* ===== end game.js ===== */
