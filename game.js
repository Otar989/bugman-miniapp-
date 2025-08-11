/* ====== BUGMAN (полный файл) ====== */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

/* DPR / размер */
let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
function fitCanvas(){
  const w = 28*24, h = 31*24;
  canvas.width = w * DPR; canvas.height = h * DPR;
  canvas.style.aspectRatio = `${w}/${h}`;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
fitCanvas(); addEventListener('resize', fitCanvas);

/* ---------- АУДИО ---------- */
let audioCtx, master, sfxGain, musicGain, musicTimer=null, musicOn=false, soundOn=true;
function ensureAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  master = audioCtx.createGain(); master.gain.value = 0.8;
  sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.9;
  musicGain = audioCtx.createGain(); musicGain.gain.value = 0.35;
  sfxGain.connect(master); musicGain.connect(master); master.connect(audioCtx.destination);
}
function playBeep(freq=600, dur=0.06){
  if (!soundOn || !audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type='triangle'; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0.001,t);
  g.gain.linearRampToValueAtTime(0.2,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g).connect(sfxGain); o.start(t); o.stop(t+dur+0.02);
}
const THEME=[523,659,784,659,587,739,880,0,523,659,784,988];
function startMusic(){
  if (!audioCtx || musicOn) return; musicOn=true;
  let i=0; musicTimer=setInterval(()=>{
    if (!musicOn) return;
    const n = THEME[i%THEME.length];
    if (n>0){
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator(), g=audioCtx.createGain();
      o.type='square'; o.frequency.setValueAtTime(n,t);
      g.gain.setValueAtTime(0.001,t);
      g.gain.linearRampToValueAtTime(0.12,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
      o.connect(g).connect(musicGain); o.start(t); o.stop(t+0.22);
    }
    i++;
  },180);
}
function stopMusic(){ musicOn=false; if(musicTimer){clearInterval(musicTimer); musicTimer=null;} }
document.addEventListener('visibilitychange',()=>{ if(!audioCtx) return; musicGain.gain.value = document.hidden?0:0.35; });

/* ---------- Константы/уровень ---------- */
const TILE=24, ROWS=31, COLS=28;
const DIRS={left:{x:-1,y:0}, right:{x:1,y:0}, up:{x:0,y:-1}, down:{x:0,y:1}};
const DIR_KEYS={ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down'};
const REVERSE={left:'right', right:'left', up:'down', down:'up'};

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

/* ---------- Состояние ---------- */
let levelIndex=0, grid=[], pellets=0, score=0, lives=3, paused=false, frightenedTimer=0, tick=0;
const pacman={x:14,y:23,dir:'left',nextDir:'left',speed:0.105,alive:true};
const ghosts=[
  {name:'Blinky',color:'#ff4b5c',x:13,y:14,dir:'left',speed:0.092, mode:'chase', seed:1},
  {name:'Pinky', color:'#ff7ad9',x:14,y:14,dir:'right',speed:0.088, mode:'chase', seed:2},
  {name:'Inky',  color:'#00d1d1',x:13,y:15,dir:'up',   speed:0.088, mode:'chase', seed:3},
  {name:'Clyde', color:'#ffb84d',x:14,y:15,dir:'down', speed:0.084, mode:'scatter', seed:4}
];

function buildLevel(){
  pellets=0;
  const raw=LEVELS[levelIndex];
  grid=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
    const ch=(raw[r]||'')[c]||' ';
    if(ch==='1') return 1;
    if(ch==='3'){ pellets++; return 3; }
    return 0;
  }));
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(grid[r][c]===0 && !((r>=11&&r<=16)&&(c>=10&&c<=17))){ grid[r][c]=2; pellets++; }
  }
  for(const [r,c] of [[1,1],[1,COLS-2],[ROWS-2,1],[ROWS-2,COLS-2]]){
    if(grid[r][c]!==1){ if(grid[r][c]===2) pellets--; grid[r][c]=3; pellets++; }
  }
  // «обход» для удаления недостижимых точек
  const visited=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  const q=[[Math.round(pacman.x),Math.round(pacman.y)]];
  visited[q[0][1]][q[0][0]]=true;
  while(q.length){
    const [x,y]=q.shift();
    for(const d of Object.values(DIRS)){
      const nx=x+d.x, ny=y+d.y;
      if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS&&!visited[ny][nx]&&grid[ny][nx]!==1){
        visited[ny][nx]=true; q.push([nx,ny]);
      }
    }
  }
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(!visited[r][c] && (grid[r][c]===2||grid[r][c]===3)){ grid[r][c]=0; pellets--; }
  }

  // стартовые позиции (строго в центре клетки)
  Object.assign(pacman,{x:14,y:23,dir:'left',nextDir:'left',speed:pacman.speed,alive:true});
  [[13,14,'left'],[14,14,'right'],[13,15,'up'],[14,15,'down']].forEach((v,i)=>{
    ghosts[i].x=v[0]; ghosts[i].y=v[1]; ghosts[i].dir=v[2];
  });
  frightenedTimer=0;
}
buildLevel();

/* ---------- Вспомогательные ---------- */
function updateHUD(){
  document.getElementById('score').textContent=score;
  document.getElementById('lives').textContent=Math.max(0,lives);
  document.getElementById('level').textContent=levelIndex+1;
}
function isWallTile(x,y){ return grid[y] && grid[y][x]===1; }
function canMoveFrom(x,y,dir){
  const nx=x+DIRS[dir].x, ny=y+DIRS[dir].y;
  if(nx<0||nx>=COLS||ny<0||ny>=ROWS) return true;
  return !isWallTile(nx,ny);
}
function stepActor(a){
  let x=a.x, y=a.y;
  const cx=Math.round(x), cy=Math.round(y);
  const centered=Math.abs(x-cx)<0.05 && Math.abs(y-cy)<0.05;

  if(centered && a.nextDir && canMoveFrom(cx,cy,a.nextDir)) a.dir=a.nextDir;

  let nx=x+DIRS[a.dir].x*a.speed, ny=y+DIRS[a.dir].y*a.speed;
  const tx=Math.round(nx), ty=Math.round(ny);

  if((tx!==cx||ty!==cy) && tx>=0&&tx<COLS&&ty>=0&&ty<ROWS && isWallTile(tx,ty)){
    // аккуратно «ставим» к центру клетки, не пробивая стену
    a.x=cx; a.y=cy;
  }else{
    if(nx<-0.51) nx=COLS-0.51; if(nx>COLS-0.49) nx=-0.49;
    if(ny<-0.51) ny=ROWS-0.51; if(ny>ROWS-0.49) ny=-0.49;
    a.x=nx; a.y=ny;
  }
}
function wrapCoords(x,y){
  if(x<0) x=COLS-1; else if(x>=COLS) x=0;
  if(y<0) y=ROWS-1; else if(y>=ROWS) y=0;
  return [x,y];
}

function ghostAI(g){
  // испуг
  if(frightenedTimer>0){
    if(Math.random()<0.15){
      const cx=Math.round(g.x), cy=Math.round(g.y);
      let opts=Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d) && REVERSE[g.dir]!==d);
      if(!opts.length) opts=Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d));
      if(opts.length) g.dir=opts[Math.floor(Math.random()*opts.length)];
    }
    return;
  }
  // смешанный режим: scatter/chase c разными целями
  const cx=Math.round(g.x), cy=Math.round(g.y);
  if(Math.abs(g.x-cx)<0.05 && Math.abs(g.y-cy)<0.05){
    const options=Object.keys(DIRS).filter(d=>canMoveFrom(cx,cy,d));
    let opts=options.filter(o=>o!==REVERSE[g.dir]); if(!opts.length) opts=options;

    // цель зависит от призрака
    let target={x:pacman.x,y:pacman.y};
    if(g.name==='Pinky'){ target={x:pacman.x+2*DIRS[pacman.dir].x, y:pacman.y+2*DIRS[pacman.dir].y}; }
    if(g.name==='Inky'){  target={x:pacman.x-1, y:pacman.y-1}; }
    if(g.name==='Clyde'){ const dx=pacman.x-g.x, dy=pacman.y-g.y; const d2=dx*dx+dy*dy; target = d2<16 ? {x:1,y:ROWS-2}:{x:COLS-2,y:1}; }

    // чуть «шума», чтобы не шли поездом
    const jitter = (v)=> v + (Math.random()*0.6-0.3);
    let best=opts[0], bestDist=1e9;
    for(const d of opts){
      const [nx,ny]=wrapCoords(cx+DIRS[d].x,cy+DIRS[d].y);
      const dx=jitter(nx)-target.x, dy=jitter(ny)-target.y;
      const dist=dx*dx+dy*dy + (d===g.dir?-0.25:0);
      if(dist<bestDist){ bestDist=dist; best=d; }
    }
    g.dir=best;
  }
}

/* ---------- Игровой цикл ---------- */
function update(){
  if(paused) return;
  tick++;

  if(pacman.alive){
    stepActor(pacman);
    const cx=Math.round(pacman.x), cy=Math.round(pacman.y);
    if(grid[cy] && (grid[cy][cx]===2 || grid[cy][cx]===3)){
      score+=(grid[cy][cx]===3?50:10); updateHUD();
      if(grid[cy][cx]===3){ frightenedTimer=600; playBeep(220,0.22); }
      else { if(tick%6===0) playBeep(600,0.06); }
      grid[cy][cx]=0; pellets--; if(pellets<=0) nextLevel();
    }
  }

  ghosts.forEach(g=>{ ghostAI(g); stepActor(g); });

  if(frightenedTimer>0) frightenedTimer--;

  for(const g of ghosts){
    const dx=g.x-pacman.x, dy=g.y-pacman.y;
    if(dx*dx+dy*dy<0.6){
      if(frightenedTimer>0){
        score+=200; updateHUD(); playBeep(160,0.22);
        g.x=13; g.y=14; g.dir='left';
      }else if(pacman.alive){
        pacman.alive=false; playBeep(90,0.25); setTimeout(()=>playBeep(60,0.25),160);
        lives=Math.max(0,lives-1); updateHUD();
        if(lives<=0){ paused=true; showBanner('Игра окончена','Нажми «Заново», чтобы сыграть снова.'); }
        else {
          // перезапуск с центра, НЕ в стене
          Object.assign(pacman,{x:14,y:23,dir:'left',nextDir:'left',alive:true});
          frightenedTimer=0;
          [[13,14,'left'],[14,14,'right'],[13,15,'up'],[14,15,'down']]
            .forEach((v,i)=>{ ghosts[i].x=v[0]; ghosts[i].y=v[1]; ghosts[i].dir=v[2]; });
        }
      }
    }
  }
}

function nextLevel(){
  levelIndex=(levelIndex+1)%LEVELS.length;
  updateHUD();
  pacman.speed+=0.01; ghosts.forEach((g,i)=>g.speed+=0.012+i*0.001);
  // на новый уровень — 3 жизни
  lives=3; updateHUD();
  buildLevel();
}

function drawBackdrop(){
  ctx.save();
  for(let i=0;i<40;i++){
    const x=(i*53)%(COLS*TILE), y=((i*97)%(ROWS*TILE));
    ctx.fillStyle='rgba(255,255,255,.05)'; ctx.fillRect(x,y,2,2);
  }
  ctx.restore();
}
function drawMaze(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackdrop();
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(grid[r][c]===1){
      const x=c*TILE,y=r*TILE;
      const grad=ctx.createLinearGradient(x,y,x,y+TILE);
      grad.addColorStop(0,'rgba(22,42,112,1)'); grad.addColorStop(1,'rgba(8,18,56,1)');
      ctx.fillStyle=grad; ctx.fillRect(x,y,TILE,TILE);
      ctx.strokeStyle='rgba(98,224,255,.65)'; ctx.lineWidth=2; ctx.strokeRect(x+2,y+2,TILE-4,TILE-4);
      ctx.shadowColor='rgba(74,109,255,.4)'; ctx.shadowBlur=8;
      ctx.strokeStyle='rgba(74,109,255,.3)'; ctx.strokeRect(x+3,y+3,TILE-6,TILE-6);
      ctx.shadowBlur=0;
    }
  }
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
}
function drawActors(){
  const t=(tick%20)/20, open=0.25+0.15*Math.sin(t*2*Math.PI);
  const angle={left:Math.PI,right:0,up:-Math.PI/2,down:Math.PI/2}[pacman.dir]||0;

  ctx.save();
  ctx.translate(pacman.x*TILE+TILE/2,pacman.y*TILE+TILE/2);
  ctx.rotate(angle);
  const g=ctx.createRadialGradient(0,-4,2,0,0,14); g.addColorStop(0,'#fff4a8'); g.addColorStop(1,'#ffcc00');
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,10,open,Math.PI*2-open); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#071b3a'; ctx.beginPath(); ctx.arc(2,-4,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ghosts.forEach(gh=>{
    ctx.save();
    ctx.translate(gh.x*TILE+TILE/2,gh.y*TILE+TILE/2);
    const color=frightenedTimer>0?'#4466ff':gh.color;
    const grd=ctx.createLinearGradient(0,-12,0,12); grd.addColorStop(0,color); grd.addColorStop(1,'#0a1230');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(0,-2,10,Math.PI,0,false);
    ctx.lineTo(10,8);
    for(let i=0;i<4;i++){ ctx.lineTo(6-i*4,12); ctx.lineTo(3-i*4,8); }
    ctx.lineTo(-10,8); ctx.closePath(); ctx.fill();
    const d=DIRS[gh.dir]; const ex=(frightenedTimer>0?0:d.x*2), ey=(frightenedTimer>0?0:d.y*2);
    ctx.fillStyle='#ecf5ff'; ctx.beginPath(); ctx.arc(-3,-4,3,0,Math.PI*2); ctx.arc(3,-4,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#182a5e'; ctx.beginPath(); ctx.arc(-3+ex,-4+ey,1.5,0,Math.PI*2); ctx.arc(3+ex,-4+ey,1.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}
function showBanner(title,subtitle){
  const w=28*24,h=31*24,cx=w/2,cy=h/2;
  ctx.save(); ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,w,h); ctx.restore();
  ctx.save();
  ctx.fillStyle='rgba(14,26,54,.92)'; ctx.strokeStyle='#3554c6'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(cx-220+16,cy-70);
  ctx.arcTo(cx+220,cy-70,cx+220,cy+70,16); ctx.arcTo(cx+220,cy+70,cx-220,cy+70,16);
  ctx.arcTo(cx-220,cy+70,cx-220,cy-70,16); ctx.arcTo(cx-220,cy-70,cx+220,cy-70,16);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#e6f0ff'; ctx.font='700 24px Inter, system-ui, sans-serif'; ctx.textAlign='center'; ctx.fillText(title,cx,cy-16);
  ctx.font='600 14px Inter, system-ui, sans-serif'; ctx.fillStyle='#a9b9df'; ctx.fillText(subtitle,cx,cy+10);
  ctx.restore();
}
function render(){ ctx.save(); drawMaze(); drawActors(); if(paused && lives>0) showBanner('Пауза','Нажми «P» или кнопку «Продолжить».'); ctx.restore(); }
function loop(){ if(paused){ render(); return; } update(); render(); requestAnimationFrame(loop); }

/* ---------- Старт/управление ---------- */
const btnPause=document.getElementById('btnPause');
const btnRestart=document.getElementById('btnRestart');
const btnSound=document.getElementById('btnSound');
const btnMusic=document.getElementById('btnMusic');
const btnStart=document.getElementById('btnStart');
const startOverlay=document.getElementById('start');

let overlayShown=true;
function hideOverlay(){ startOverlay.style.display='none'; overlayShown=false; }
function showOverlay(){ startOverlay.style.display='grid'; overlayShown=true; }

btnStart.addEventListener('click',()=>BUGMAN.start(),{passive:true});
btnPause.addEventListener('click',()=>BUGMAN.pause());
btnRestart.addEventListener('click',()=>BUGMAN.restart());
btnSound.addEventListener('click',()=>{ soundOn=!soundOn; btnSound.textContent = soundOn?'Звук 🔊':'Звук 🔈'; playBeep(700,0.08); });
btnMusic.addEventListener('click',()=>{ if(!audioCtx){ ensureAudio(); audioCtx.resume?.(); } if(!musicOn){ startMusic(); btnMusic.textContent='Мелодия ⏹'; } else { stopMusic(); btnMusic.textContent='Мелодия ♫'; } });

function bindInput(){
  // стрелки / Enter/Space / P
  document.addEventListener('keydown',(e)=>{
    const key=e.key;
    const ae=document.activeElement;
    const focusedCanvas = (ae===document.body) || (ae===canvas);

    if(key in DIR_KEYS){ pacman.nextDir=DIR_KEYS[key]; e.preventDefault(); return; }

    if(overlayShown && (key==='Enter' || key===' ')){ BUGMAN.start(); e.preventDefault(); return; }

    if((key==='p'||key==='P') && focusedCanvas){ BUGMAN.pause(); e.preventDefault(); return; }
  },{passive:false});

  // свайпы (тачпад/тач/мышь)
  let startPt=null;
  const start=(x,y)=> startPt={x,y};
  const end=(x,y)=>{
    if(!startPt) return;
    const dx=x-startPt.x, dy=y-startPt.y; startPt=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<15) return;
    pacman.nextDir=(Math.abs(dx)>Math.abs(dy))?(dx>0?'right':'left'):(dy>0?'down':'up');
  };
  canvas.addEventListener('pointerdown',e=>start(e.clientX,e.clientY),{passive:true});
  canvas.addEventListener('pointerup',  e=>end(e.clientX,e.clientY),  {passive:true});
  canvas.addEventListener('touchstart',e=>{const t=e.changedTouches[0];start(t.clientX,t.clientY);},{passive:true});
  canvas.addEventListener('touchend',  e=>{const t=e.changedTouches[0];end(t.clientX,t.clientY);},{passive:true});
}
bindInput();

/* ---------- API ---------- */
const BUGMAN={
  start: async ()=>{
    hideOverlay(); paused=false;
    ensureAudio(); try{ await audioCtx.resume(); }catch{}
    soundOn=true; startMusic(); btnMusic.textContent='Мелодия ⏹';
    canvas.focus(); loop();
  },
  pause: ()=>{
    paused=!paused; btnPause.textContent=paused?'Продолжить ▶':'Пауза ⏸';
    if(!paused) loop();
  },
  restart: ()=>{
    score=0; lives=3; levelIndex=0; updateHUD();
    buildLevel(); paused=false; hideOverlay(); loop();
  }
};
updateHUD();
render();
/* ====== /BUGMAN ====== */
