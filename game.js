// ====== Настройки канваса и масштаб ======
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
function fitCanvas(){
  const w = 28*24, h = 31*24;
  canvas.width = w * DPR;
  canvas.height = h * DPR;
  canvas.style.aspectRatio = `${w}/${h}`;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
fitCanvas();
addEventListener('resize', fitCanvas);

// ====== Аудио (простые SFX + мелодия) ======
let audioEnabled = true, soundOn = true, musicOn = false;
let audioCtx, master, musicGain, sfxGain, musicTimer;
const SOUND = {
  chomp:{freq:560,dur:0.06}, power:{freq:220,dur:0.25},
  eatGhost:{freq:150,dur:0.22}, deathA:{freq:90,dur:0.5}, deathB:{freq:70,dur:0.5}
};
function ensureAudio(){
  if (!audioCtx){
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    master = audioCtx.createGain(); master.gain.value=0.9;
    musicGain = audioCtx.createGain(); musicGain.gain.value=0.35;
    sfxGain = audioCtx.createGain();  sfxGain.gain.value=0.9;
    sfxGain.connect(master); musicGain.connect(master); master.connect(audioCtx.destination);
  }
}
function tone({freq,dur}, type='sine', gainNode=sfxGain){
  if(!audioEnabled || !soundOn) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.18, now+0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now+dur);
  o.connect(g).connect(gainNode); o.start(now); o.stop(now+dur+0.02);
}
// простая чиптюн-мелодия (без авторских прав)
const MELODY = [523,659,784,659,587,739,880,0,523,659,784,988];
function startMusic(){
  if(!audioEnabled) return;
  ensureAudio(); stopMusic(); musicOn = true;
  let i = 0;
  musicTimer = setInterval(()=>{
    if(!musicOn) return;
    const n = MELODY[i%MELODY.length];
    if(n>0){
      const now=audioCtx.currentTime, o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='square'; o.frequency.value=n;
      g.gain.value=0.001; g.gain.linearRampToValueAtTime(0.12, now+0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.2);
      o.connect(g).connect(musicGain); o.start(now); o.stop(now+0.25);
    }
    i++;
  }, 180);
}
function stopMusic(){ musicOn=false; if(musicTimer) clearInterval(musicTimer); }

// ====== Карта ======
/* 0 — пусто, 1 — стена. Лабиринт достижим полностью. */
const MAP = [
"1111111111111111111111111111",
"1............11............1",
"1.1111.11111.11.11111.1111.1",
"1.1..1.1...1.11.1...1.1..1.1",
"1.1..1.1...1.11.1...1.1..1.1",
"1....1......11......1....1.1",
"1.1111.11.11111.11.1111.11.1",
"1.1111.11.11111.11.1111.11.1",
"1......11...11...11......1.1",
"11111.11111.11.11111.11111.1",
"1.........................11",
"1.1111.11111111111111.1111.1",
"1.1111.11..........11.1111.1",
"1.1111.11.111--111.11.1111.1",
"1......11.1  G  1.11......1 ",
"1.1111111.1 BP 1.11111111.1 ",
"1......11.1     1.11......1 ",
"1.1111.11.11111111.11.1111.1",
"1.1111.11..........11.1111.1",
"1.1111.11111111111111.1111.1",
"1.........................11",
"11111.11111.11.11111.11111.1",
"1......11...11...11......1.1",
"1.1111.11.11111.11.1111.11.1",
"1.1111.11.11111.11.1111.11.1",
"1....1......11......1....1.1",
"1.1..1.1...1.11.1...1.1..1.1",
"1.1..1.1...1.11.1...1.1..1.1",
"1............11............1",
"1..........................1",
"1111111111111111111111111111"
];

const TILE=24, ROWS=MAP.length, COLS=MAP[0].length;
const grid = MAP.map(row => row.split('').map(ch => ch==='1'?1:0));
const pellets = Array.from({length:ROWS}, (_,r)=>Array.from({length:COLS},(_,c)=>{
  if(grid[r][c]===1) return 0;
  // без «тюрьмы» в центре
  if(r>=14&&r<=16 && c>=10&&c<=17) return 0;
  return 1;
}));
/* большие точки */
for (const [r,c] of [[1,1],[1,COLS-2],[ROWS-2,1],[ROWS-2,COLS-2]]) pellets[r][c]=2;

// ====== Игровые сущности ======
const DIRS={left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1},down:{x:0,y:1}};
const KEY2DIR={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',
               a:'left',d:'right',w:'up',s:'down','A':'left','D':'right','W':'up','S':'down'};
const REVERSE={left:'right',right:'left',up:'down',down:'up'};

let score=0,lives=3,level=1,paused=true,tick=0,fright=0;
const pacman = { x:14.5, y:23.5, dir:'left', next:'left', speed:0.12, alive:true };

const ghosts = [
  {name:'Blinky',color:'#ff4b5c',x:13.5,y:14.5,dir:'left', speed:0.10, role:'chase'},   // pursue
  {name:'Pinky', color:'#ff7ad9',x:14.5,y:14.5,dir:'right',speed:0.095, role:'ambush'}, // ahead of pac
  {name:'Inky',  color:'#00d1d1',x:13.5,y:15.5,dir:'up',   speed:0.095, role:'vector'}, // vector-ish
  {name:'Clyde', color:'#ffb84d',x:14.5,y:15.5,dir:'down', speed:0.090, role:'scatter'} // random / corner
];

// ====== Вспомогалки ======
const inBounds = (x,y)=> x>=0 && x<COLS && y>=0 && y<ROWS;
const isWall = (x,y)=> inBounds(x,y) && grid[y][x]===1;

function canGo(cx,cy,dir){
  const nx = cx + DIRS[dir].x, ny = cy + DIRS[dir].y;
  if(!inBounds(nx,ny)) return true; // туннели
  return !isWall(nx,ny);
}

// «щелкаем» к центру клетки — чтобы не проламывал стены
function snapMove(actor){
  const cx=Math.round(actor.x), cy=Math.round(actor.y);
  const centered = Math.abs(actor.x-cx)<0.05 && Math.abs(actor.y-cy)<0.05;

  if(centered && actor.next && canGo(cx,cy,actor.next)) actor.dir=actor.next;

  const d=DIRS[actor.dir];
  let nx = actor.x + d.x*actor.speed, ny = actor.y + d.y*actor.speed;

  // переход через край
  if (nx < -0.51) nx = COLS-0.51; if (nx > COLS-0.49) nx = -0.49;
  if (ny < -0.51) ny = ROWS-0.51; if (ny > ROWS-0.49) ny = -0.49;

  const nxCell=Math.round(nx), nyCell=Math.round(ny);
  // если следующая клетка — стена, останавливаемся у центра текущей
  if ((nxCell!==cx || nyCell!==cy) && isWall(nxCell,nyCell)){
    actor.x = cx; actor.y = cy;
  } else {
    actor.x = nx; actor.y = ny;
  }
}

function eatAt(x,y){
  if(!inBounds(x,y)) return;
  const v=pellets[y][x];
  if(v===1){ pellets[y][x]=0; score+=10; if(tick%6===0) tone(SOUND.chomp,'triangle'); }
  if(v===2){ pellets[y][x]=0; score+=50; fright=600; tone(SOUND.power,'sawtooth'); }
}

function resetPositions(){
  Object.assign(pacman,{x:14.5,y:23.5,dir:'left',next:'left',alive:true});
  [[13.5,14.5,'left'],[14.5,14.5,'right'],[13.5,15.5,'up'],[14.5,15.5,'down']]
    .forEach((v,i)=>{ghosts[i].x=v[0];ghosts[i].y=v[1];ghosts[i].dir=v[2];});
}

// ====== AI призраков (разные цели + шум) ======
function ghostTarget(g){
  const px=pacman.x, py=pacman.y;
  switch(g.role){
    case 'chase':   return {tx:px, ty:py};
    case 'ambush':  return {tx:px+2*DIRS[pacman.dir].x, ty:py+2*DIRS[pacman.dir].y};
    case 'vector':  return {tx:px + (ghosts[0].x-px)*0.5, ty:py + (ghosts[0].y-py)*0.5};
    case 'scatter': return {tx: (g.name==='Clyde'? 2 : COLS-3), ty: (g.name==='Clyde'? ROWS-3 : 2)};
    default:        return {tx:px,ty:py};
  }
}

function aiStep(g){
  if(fright>0){
    // паника — иногда меняют направление
    if(Math.random()<0.1){
      const cx=Math.round(g.x), cy=Math.round(g.y);
      let opts=Object.keys(DIRS).filter(d=>canGo(cx,cy,d) && REVERSE[g.dir]!==d);
      if(!opts.length) opts=Object.keys(DIRS).filter(d=>canGo(cx,cy,d));
      if(opts.length) g.dir = opts[Math.floor(Math.random()*opts.length)];
    }
    return;
  }
  const cx=Math.round(g.x), cy=Math.round(g.y);
  if(Math.abs(g.x-cx)<0.05 && Math.abs(g.y-cy)<0.05){
    const {tx,ty}=ghostTarget(g);
    // небольшой шум, чтобы не строились колонной
    const jitterX = (Math.random()-0.5)*0.8, jitterY=(Math.random()-0.5)*0.8;
    const targetX = tx + jitterX, targetY = ty + jitterY;

    let options = Object.keys(DIRS).filter(d=>canGo(cx,cy,d));
    let opts = options.filter(o=>o!==REVERSE[g.dir]); if(!opts.length) opts=options;

    let best=opts[0], bestDist=Infinity;
    for(const d of opts){
      const nx = cx + DIRS[d].x, ny = cy + DIRS[d].y;
      const dx = (nx - targetX), dy = (ny - targetY);
      const dist = dx*dx + dy*dy + (d===g.dir?-0.15:0);
      if(dist<bestDist){ bestDist=dist; best=d; }
    }
    g.dir = best;
  }
}

// ====== Рендер ======
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // сетка
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const x=c*TILE,y=r*TILE;
      if(grid[r][c]===1){
        const grad=ctx.createLinearGradient(x,y,x,y+TILE);
        grad.addColorStop(0,'rgba(22,42,112,1)'); grad.addColorStop(1,'rgba(8,18,56,1)');
        ctx.fillStyle=grad; ctx.fillRect(x,y,TILE,TILE);
        ctx.strokeStyle='rgba(98,224,255,.65)'; ctx.lineWidth=2;
        ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
      } else {
        const v = pellets[r][c];
        if(v===1){ ctx.fillStyle='#ffeaae'; ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,2.6,0,Math.PI*2); ctx.fill(); }
        if(v===2){ const t=(tick%60)/60, rad=6+Math.sin(t*2*Math.PI)*2;
          const g=ctx.createRadialGradient(x+TILE/2,y+TILE/2,2,x+TILE/2,y+TILE/2,18);
          g.addColorStop(0,'rgba(255,210,63,.95)'); g.addColorStop(1,'rgba(255,210,63,.05)');
          ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,rad,0,Math.PI*2); ctx.fill();
        }
      }
    }
  }
  // пакман
  const t=(tick%20)/20, open=0.25+0.15*Math.sin(t*2*Math.PI);
  const angle={left:Math.PI,right:0,up:-Math.PI/2,down:Math.PI/2}[pacman.dir]||0;
  ctx.save();
  ctx.translate(pacman.x*TILE, pacman.y*TILE);
  ctx.rotate(angle);
  const g=ctx.createRadialGradient(0,-4,2,0,0,14);
  g.addColorStop(0,'#fff4a8'); g.addColorStop(1,'#ffcc00');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,10,open,Math.PI*2-open); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#071b3a'; ctx.beginPath(); ctx.arc(2,-4,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // призраки
  ghosts.forEach(gh=>{
    ctx.save(); ctx.translate(gh.x*TILE, gh.y*TILE);
    const color=fright>0?'#4466ff':gh.color;
    const grd=ctx.createLinearGradient(0,-12,0,12);
    grd.addColorStop(0,color); grd.addColorStop(1,'#0a1230');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,-2,10,Math.PI,0,false); ctx.lineTo(10,8);
    for(let i=0;i<4;i++){ ctx.lineTo(6-i*4,12); ctx.lineTo(3-i*4,8); }
    ctx.lineTo(-10,8); ctx.closePath(); ctx.fill();
    const d=DIRS[gh.dir]; const ex=(fright>0?0:d.x*2), ey=(fright>0?0:d.y*2);
    ctx.fillStyle='#ecf5ff'; ctx.beginPath(); ctx.arc(-3,-4,3,0,Math.PI*2); ctx.arc(3,-4,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#182a5e'; ctx.beginPath(); ctx.arc(-3+ex,-4+ey,1.5,0,Math.PI*2); ctx.arc(3+ex,-4+ey,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ====== Логика цикла ======
function update(){
  if(paused) return;
  tick++;

  // движение
  if(pacman.alive){
    snapMove(pacman);
    const cx=Math.round(pacman.x), cy=Math.round(pacman.y);
    eatAt(cx,cy);
  }

  ghosts.forEach(g=>{ aiStep(g); snapMove(g); });

  // столкновения
  for(const g of ghosts){
    const dx=g.x-pacman.x, dy=g.y-pacman.y;
    if(dx*dx+dy*dy<0.6){
      if(fright>0){
        score+=200; tone(SOUND.eatGhost,'square');
        Object.assign(g,{x:13.5,y:14.5,dir:'left'});
      } else if(pacman.alive){
        pacman.alive=false;
        tone(SOUND.deathA,'square'); setTimeout(()=>tone(SOUND.deathB,'sine'),140);
        lives--; updateHUD();
        if(lives<=0){ paused=true; }
        else { resetPositions(); }
      }
    }
  }

  if(fright>0) fright--;
}

function loop(){
  update(); draw();
  requestAnimationFrame(loop);
}

// ====== HUD ======
const $score = document.getElementById('score');
const $lives = document.getElementById('lives');
const $level = document.getElementById('level');
function updateHUD(){ $score.textContent=score; $lives.textContent=Math.max(0,lives); $level.textContent=level; }
updateHUD();

// ====== Старт / управление ======
const btnPause=document.getElementById('btnPause');
const btnRestart=document.getElementById('btnRestart');
const btnSound=document.getElementById('btnSound');
const btnMusic=document.getElementById('btnMusic');
const startOverlay=document.getElementById('start');
const btnStart=document.getElementById('btnStart');

function hideOverlay(){ startOverlay.style.display='none'; }

function lockScrollDuringPlay(){
  const stop = (e)=>e.preventDefault();
  document.addEventListener('touchmove', stop, {passive:false});
  document.addEventListener('wheel', stop, {passive:false});
  document.addEventListener('gesturestart', stop, {passive:false});
}

const BUGMAN = {
  start: async () => {
    hideOverlay(); paused=false; ensureAudio();
    try{ await audioCtx.resume(); }catch{}
    soundOn=true; startMusic(); btnMusic.textContent='Мелодия ⏹';
    lockScrollDuringPlay();
    canvas.focus(); loop();
  },
  restart: () => {
    score=0; lives=3; level=1; updateHUD();
    // восстановим все точки
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
      if(grid[r][c]===1) { pellets[r][c]=0; continue; }
      pellets[r][c] = (r>=14&&r<=16 && c>=10&&c<=17)?0:1;
    }
    for (const [r,c] of [[1,1],[1,COLS-2],[ROWS-2,1],[ROWS-2,COLS-2]]) pellets[r][c]=2;
    resetPositions(); paused=false;
  }
};

btnStart.addEventListener('click', BUGMAN.start);
document.addEventListener('keydown',(e)=>{
  if(e.key==='Enter' && startOverlay.style.display!=='none'){ e.preventDefault(); BUGMAN.start(); return; }
  if(KEY2DIR[e.key]){ pacman.next = KEY2DIR[e.key]; e.preventDefault(); }
  if(e.key===' '){ paused=!paused; btnPause.textContent=paused?'Продолжить ▶':'Пауза ⏸'; e.preventDefault(); }
},{passive:false});

btnPause.addEventListener('click',()=>{ paused=!paused; btnPause.textContent=paused?'Продолжить ▶':'Пауза ⏸'; });
btnRestart.addEventListener('click',()=>BUGMAN.restart());
btnSound.addEventListener('click',()=>{ soundOn=!soundOn; btnSound.textContent=soundOn?'Звук 🔊':'Звук 🔈'; });
btnMusic.addEventListener('click',()=>{ if(!musicOn){ startMusic(); btnMusic.textContent='Мелодия ⏹'; } else { stopMusic(); btnMusic.textContent='Мелодия ♫'; }});

// свайпы (тач + тачпад)
let touchStart=null;
canvas.addEventListener('touchstart',(e)=>{ const t=e.changedTouches[0]; touchStart={x:t.clientX,y:t.clientY}; },{passive:true});
canvas.addEventListener('touchend',(e)=>{ if(!touchStart) return; const t=e.changedTouches[0];
  const dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>20){
    pacman.next=(Math.abs(dx)>Math.abs(dy))?(dx>0?'right':'left'):(dy>0?'down':'up');
  }
  touchStart=null;
},{passive:true});

// тачпад / колесо – определяем «жест» по интегралу
let wheelX=0, wheelY=0, lastWheel=0;
canvas.addEventListener('wheel',(e)=>{
  const now=performance.now();
  if(now-lastWheel>350){ wheelX=wheelY=0; }
  wheelX += e.deltaX; wheelY += e.deltaY; lastWheel=now;
  const TH=40; // порог
  if(Math.abs(wheelX)>Math.abs(wheelY)){
    if(wheelX>TH){ pacman.next='right'; wheelX=wheelY=0; }
    if(wheelX<-TH){ pacman.next='left';  wheelX=wheelY=0; }
  } else {
    if(wheelY>TH){ pacman.next='down'; wheelX=wheelY=0; }
    if(wheelY<-TH){ pacman.next='up';   wheelX=wheelY=0; }
  }
},{passive:false});

// не ставим игру на паузу автоматически при blur/visibilitychange — просили не мешать
