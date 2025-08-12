const assert = require('assert');

  function stubCtx(){
    return { setTransform:()=>{}, clearRect:()=>{} };
  }
function stubEl(){
  return {
      getContext: ()=>stubCtx(),
      style:{},
      addEventListener: ()=>{},
      removeEventListener: ()=>{},
      click: ()=>{},
      textContent:'',
      classList:{add:()=>{},remove:()=>{}},
      querySelector: ()=>({textContent:''})
    };
  }

global.window = { devicePixelRatio:1, addEventListener:()=>{} };
global.document = {
  getElementById: ()=>stubEl(),
  addEventListener: ()=>{}
};
global.addEventListener = ()=>{};

global.AudioContext = function(){
  return {
    createGain(){ return {connect:()=>{}, gain:{value:0}}; },
    createOscillator(){ return {connect:()=>{}, frequency:{setValueAtTime:()=>{}}, start:()=>{}, stop:()=>{}, type:''}; },
    currentTime:0
  };
};

const game = require('./game.js');

game.buildLevel();
assert.notStrictEqual(
  game.grid[Math.floor(game.pacman.y)][Math.floor(game.pacman.x)],
  game.WALL,
  'player overlaps wall on default spawn'
);

// move spawn marker onto a wall and reset spawn coords
const idx = game.RAW.findIndex(r=>r.includes('p'));
if (idx>=0) game.RAW[idx] = game.RAW[idx].replace('p','1');
game.spawn.x = 0;
game.spawn.y = 0;

game.buildLevel();
assert.notStrictEqual(
  game.grid[Math.floor(game.pacman.y)][Math.floor(game.pacman.x)],
  game.WALL,
  'player overlaps wall when spawn on wall'
);

console.log('Spawn tests passed');
