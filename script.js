/* ========================================================================
   Shadow Clone Escape — Full script.js (complete)
   - Works with index.html / style.css provided earlier.
   - Tolerant to slightly different element IDs (tries multiple selectors).
   - Edit ASSETS at top to match your filenames/paths exactly (case-sensitive).
   ======================================================================== */

/* =======================
   ASSET CONFIG - EDIT PATHS HERE
   ======================= */
const ASSETS = {
  // Images
  ninja:    "assets/ninja_spritesheet.png",    // sprite sheet, e.g. 1536x534 (4 cols)
  clones:   "assets/clones_spritesheet.png",   // clones spritesheet, e.g. 1060x433 (3 cols)
  portal:   "assets/portal.png",               // portal sprite
  bg:       "background.png",           // main background

  // Audio (optional - set to null if missing)
  bgMusic:  "assets/bg_music_loop.wav",
  spawnSfx: "assets/spawn.wav",
  pickupSfx: "assets/powerup.wav",
  portalSfx: "assets/portal.wav",
  deathSfx:  "assets/death.wav"
};

/* =======================
   Utilities to find DOM elements by multiple possible IDs (robust)
   ======================= */
function elBy(...ids){
  for(const id of ids){
    if(!id) continue;
    const e = document.getElementById(id) || document.querySelector(`#${id}`);
    if(e) return e;
  }
  return null;
}

/* =======================
   DOM references (robust selectors)
   ======================= */
const canvas = elBy('gameCanvas', 'game-canvas', 'canvas', 'gameCanvas');
if(!canvas) throw new Error('Missing canvas element with id "gameCanvas"');
const ctx = canvas.getContext('2d');

const minimap = elBy('minimap', 'mini-map', 'miniMap');
const miniCtx = minimap ? minimap.getContext('2d') : null;

const preloader = elBy('preloader', 'loading-screen', 'loadingScreen');
const startBtn = elBy('startBtn', 'start-btn', 'startBtnOverlay', 'startBtnOverlay');
const tutorialBtn = elBy('tutorialBtn', 'tutorial-btn');
const settingsBtn = elBy('settingsBtn', 'settings-btn');
const creditsBtn = elBy('creditsBtn', 'credits-btn');
const restartBtn = elBy('restartBtn', 'restart-btn');
const menuBtn = elBy('menuBtn', 'menu-btn', 'menuBtnHeader', 'menu-btn-header');
const menuRoot = elBy('menu', 'main-menu', 'menu-root');
const tutorialRoot = elBy('tutorial', 'tutorial-menu');
const settingsRoot = elBy('settings', 'settings-menu');
const titleOverlay = elBy('titleOverlay', 'title-overlay', 'titleOverlay');
const uiRoot = elBy('ui', 'game-container') || document.body;

const musicToggleEl = elBy('musicToggle', 'music-toggle');
const sfxToggleEl = elBy('sfxToggle', 'sfx-toggle');
const difficultyEl = elBy('difficulty', 'difficulty-select', 'difficulty');
const bestRecordText = elBy('bestRecordText', 'best-record', 'bestRecordText');
const statusText = elBy('status', 'statusText', 'status');
const timerText = elBy('timer', 'timerText', 'timer');
const powerupBox = elBy('powerupBox', 'powerup-box', 'powerupBox');
const leaderboardList = elBy('leaderboardList', 'leaderboard-list', 'leaderboardList');
const clearLeaderboardBtn = elBy('clearLeaderboard', 'clear-leaderboard', 'clearLeaderboard');

const mobileControls = elBy('mobileControls', 'mobile-controls');
const joystickContainer = elBy('joystickContainer', 'joystick-container');
const joystickEl = elBy('joystick', 'joystick');

const notifArea = document.getElementById('notifArea') || (() => {
  const d = document.createElement('div'); d.id = 'notifArea'; document.body.appendChild(d); return d;
})();

/* =======================
   Storage keys & default settings
   ======================= */
const STORAGE = {
  SETTINGS: 'sce_settings_v1',
  BEST: 'sce_best_v1',
  LEADER: 'sce_leader_v1'
};

let SETTINGS = {
  music: true,
  musicVolume: 0.45,
  sfxVolume: 1.0,
  difficulty: 'normal',     // 'easy'|'normal'|'hard'|'nightmare'
  joystickSensitivity: 0.9
};
try { const s = JSON.parse(localStorage.getItem(STORAGE.SETTINGS)); if(s) SETTINGS = {...SETTINGS, ...s}; } catch(e){}

/* =======================
   Runtime state variables
   ======================= */
let pixelRatio = window.devicePixelRatio || 1;
let cols = 19, rows = 19, tileSize = 30;
let maze = null;
let mazeCache = null;
let player = null;
let movesHistory = [];
let clones = [];
let powerups = [];
let particles = [];
let frameCount = 0;
let running = false;
let paused = false;
let startTime = 0;
let cloneInterval = 300;
let activePower = null;
let PORTAL = null;
let currentLevel = 0;

/* ASCII curated levels (can parse) */
const ASCII_LEVELS = [
  [
    "###################",
    "#.................#",
    "#.###.###...###...#",
    "#.#.#.#.#.#.#.#.#.#",
    "#...#.P.#...#.....#",
    "#.#.#.#.#.#.#.###.#",
    "#.....#...#.......#",
    "###################"
  ],
  [
    "########################",
    "#.........#............#",
    "#.###.###.#.###.###.###.#",
    "#.#...#...#.....#...#...#",
    "#.#.P.#.######.#.###.###.#",
    "#.#...#........#.......#.#",
    "#.###.########.#########.#",
    "#.......................#",
    "########################"
  ]
];

/* Procedural level configs */
const LEVELS = [
  { name:'Novice Shadow', scale:1.0 },
  { name:'Wandering Echo', scale:1.14 },
  { name:'Night Stalker', scale:1.28 },
  { name:'Spectral Onslaught', scale:1.6 },
  { name:"Ninja's Dread", scale:2.0 },
  { name:'Endless', scale:2.4 }
];

/* Asset containers */
const IMG = { ninja:null, clones:null, portal:null, bg:null, layers:[] };
const AUDIO = { bg:null, spawn:null, pickup:null, portal:null, death:null };
const SPR = { ninja:{cols:4,rows:1,w:0,h:0}, clones:{cols:3,rows:1,w:0,h:0}, portal:{cols:1,rows:1,w:0,h:0} };

/* =======================
   Basic helpers
   ======================= */
const clamp = (v,a,b)=> Math.max(a,Math.min(b,v));
const randInt = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
const shuffle = (a)=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
const nowSec = ()=> Math.floor((Date.now()-startTime)/1000);

/* =======================
   Asset loader (promises)
   ======================= */
function loadImage(src){
  return new Promise(res=>{
    if(!src){ res(null); return; }
    const i = new Image();
    i.onload = ()=> res(i);
    i.onerror = ()=> { console.warn('image failed', src); res(null); };
    i.src = src;
  });
}
function loadAudio(src){
  return new Promise(res=>{
    if(!src){ res(null); return; }
    try{
      const a = new Audio();
      a.addEventListener('canplaythrough', ()=>res(a), {once:true});
      a.addEventListener('error', ()=>{ console.warn('audio failed', src); res(null); }, {once:true});
      a.src = src;
    }catch(e){ console.warn('audio exception', e); res(null); }
  });
}

/* Preload all assets (with progress) */
async function preloadAll(showPreloader=true){
  if(showPreloader && preloader) preloader.style.display = 'flex';
  const tasks = [
    {type:'img', key:'ninja', path:ASSETS.ninja},
    {type:'img', key:'clones', path:ASSETS.clones},
    {type:'img', key:'portal', path:ASSETS.portal},
    {type:'img', key:'bg', path:ASSETS.bg},
    {type:'img', key:'bg1', path:ASSETS.bgLayers?.[0]},
    {type:'img', key:'bg2', path:ASSETS.bgLayers?.[1]},
    {type:'img', key:'bg3', path:ASSETS.bgLayers?.[2]},
    {type:'audio', key:'bg', path:ASSETS.bgMusic},
    {type:'audio', key:'spawn', path:ASSETS.spawnSfx},
    {type:'audio', key:'pickup', path:ASSETS.pickupSfx},
    {type:'audio', key:'portal', path:ASSETS.portalSfx},
    {type:'audio', key:'death', path:ASSETS.deathSfx}
  ];

  let done = 0;
  const total = tasks.filter(t=>t.path).length || tasks.length;

  for(const t of tasks){
    if(!t.path){ done++; continue; }
    if(t.type === 'img'){
      const img = await loadImage(t.path);
      if(img){
        if(t.key === 'ninja') IMG.ninja = img;
        else if(t.key === 'clones') IMG.clones = img;
        else if(t.key === 'portal') IMG.portal = img;
        else if(t.key === 'bg') IMG.bg = img;
        else if(t.key === 'bg1') IMG.layers[0] = img;
        else if(t.key === 'bg2') IMG.layers[1] = img;
        else if(t.key === 'bg3') IMG.layers[2] = img;
        console.log('Loaded image', t.path);
      } else console.warn('Missing image:', t.path);
    } else {
      const a = await loadAudio(t.path);
      if(a){
        if(t.key === 'bg') AUDIO.bg = a;
        else if(t.key === 'spawn') AUDIO.spawn = a;
        else if(t.key === 'pickup') AUDIO.pickup = a;
        else if(t.key === 'portal') AUDIO.portal = a;
        else if(t.key === 'death') AUDIO.death = a;
        console.log('Loaded audio', t.path);
      } else console.warn('Missing audio:', t.path);
    }
    done++;
    const pct = Math.floor((done/total)*100);
    if(preloader) {
      const p = preloader.querySelector('p');
      if(p) p.textContent = `Loading assets... ${pct}%`;
    }
    await new Promise(r => setTimeout(r, 20));
  }

  // audio setup
  if(AUDIO.bg){ AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.musicVolume; }
  if(AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfxVolume;
  if(AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfxVolume;
  if(AUDIO.portal) AUDIO.portal.volume = SETTINGS.sfxVolume;
  if(AUDIO.death) AUDIO.death.volume = SETTINGS.sfxVolume;

  // sprite frame size calc
  if(IMG.ninja){ SPR.ninja.w = Math.floor(IMG.ninja.naturalWidth / SPR.ninja.cols); SPR.ninja.h = Math.floor(IMG.ninja.naturalHeight / SPR.ninja.rows); }
  if(IMG.clones){ SPR.clones.w = Math.floor(IMG.clones.naturalWidth / SPR.clones.cols); SPR.clones.h = Math.floor(IMG.clones.naturalHeight / SPR.clones.rows); }
  if(IMG.portal){ SPR.portal.w = Math.floor(IMG.portal.naturalWidth / SPR.portal.cols); SPR.portal.h = Math.floor(IMG.portal.naturalHeight / SPR.portal.rows); }

  if(preloader) preloader.style.display = 'none';
}

/* =======================
   Canvas & sizing
   ======================= */
function resizeCanvas(){
  pixelRatio = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth - 40, 1200);
  const cssW = Math.min(maxW, window.innerWidth - 40);
  canvas.style.width = cssW + 'px';
  const logicalW = Math.floor(cssW);
  const logicalH = Math.floor(logicalW * 0.62);
  canvas.width = Math.floor(logicalW * pixelRatio);
  canvas.height = Math.floor(logicalH * pixelRatio);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);

  if(minimap){
    const mmW = Math.min(220, Math.floor(cssW * 0.28));
    const mmH = Math.floor(mmW * 0.55);
    minimap.width = mmW;
    minimap.height = mmH;
    minimap.style.width = mmW + 'px';
    minimap.style.height = mmH + 'px';
  }

  const preferred = window.innerWidth < 720 ? 24 : 36;
  cols = Math.max(11, Math.floor(logicalW / preferred));
  rows = Math.max(11, Math.floor(logicalH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(logicalW / cols, logicalH / rows));
}
window.addEventListener('resize', ()=>{ resizeCanvas(); cacheMaze(); });

/* =======================
   Maze generator / parser / cache
   ======================= */
function generateMaze(c, r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x]=0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x+dx, ny = y+dy;
      if(nx>0 && nx<c-1 && ny>0 && ny<r-1 && grid[ny][nx]===1){
        grid[y+dy/2][x+dx/2]=0;
        carve(nx, ny);
      }
    }
  }
  carve(1,1);
  grid[1][1]=0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}

function parseAsciiLevel(ascii){
  if(!ascii || !ascii.length) return null;
  const h = ascii.length, w = ascii[0].length;
  const grid = Array.from({length:h}, (_,y) => Array.from({length:w}, (_,x) => {
    const ch = ascii[y][x];
    if(ch === '#') return 1;
    if(ch === '.' || ch === ' ') return 0;
    if(ch === 'P'){ PORTAL = { x, y }; return 0; }
    return 0;
  }));
  return grid;
}

function cacheMaze(){
  if(!maze || !Array.isArray(maze) || !maze[0]){ mazeCache = null; return; }
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const v = (maze[y] && typeof maze[y][x] !== 'undefined') ? maze[y][x] : 1;
      if(v === 1){
        mctx.fillStyle = '#2e2e2e';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        mctx.fillStyle = 'rgba(0,0,0,0.06)';
        mctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        mctx.fillStyle = '#0f0f0f';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* place portal for procedural */
function placePortalProcedural(){
  let best=null, bestd=-1;
  for(let y=1;y<rows-1;y++){
    for(let x=1;x<cols-1;x++){
      if(maze[y] && maze[y][x] === 0 && !(x===1 && y===1)){
        const d = Math.abs(x-1) + Math.abs(y-1);
        if(d > bestd){ bestd = d; best = {x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* =======================
   Powerups & particles
   ======================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let tries = 0;
  while(tries++ < 300){
    const x = randInt(1, cols-2);
    const y = randInt(1, rows-2);
    if(maze[y] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x && p.y===y)){
      powerups.push({ x, y, type: POWER_TYPES[randInt(0, POWER_TYPES.length-1)], bob: Math.random()*Math.PI*2, spawned: Date.now() });
      break;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type==='cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type==='shock'){
    clones.forEach(c=>{ c.index = Math.max(0, (c.index||0) - 28); });
    spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#bfe8ff', 20);
    if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
  }
  if(SETTINGS.sfx && AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfxVolume);
  showToast(`${type.toUpperCase()}!`);
}

function spawnParticles(px,py,color,count=18){
  for(let i=0;i<count;i++){
    particles.push({ x:px + (Math.random()-0.5)*tileSize, y:py + (Math.random()-0.5)*tileSize, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:30 + Math.random()*40, color });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}

/* =======================
   Clone class
   ======================= */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.spawnFrame = frameCount;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
  }
  update(){
    if(this.type === 'fast') this.index += 1 + (Math.random() < 0.45 ? 1 : 0);
    else if(this.type === 'wraith'){
      if(Math.random() < 0.01 + Math.min(0.05, frameCount/60000)){
        const jump = Math.min(50, Math.floor(Math.random()*Math.min(200, this.path.length)));
        this.index = Math.min(this.path.length-1, this.index + jump);
      } else this.index++;
    } else this.index++;
    if(this.index < this.path.length){
      this.x = this.path[this.index].x;
      this.y = this.path[this.index].y;
    }
  }
  draw(){
    if(IMG.clones && SPR.clones.w){
      const tIndex = (this.type === 'wraith') ? 2 : (this.type === 'fast' ? 1 : 0);
      const sx = tIndex * SPR.clones.w;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clones, sx, 0, SPR.clones.w, SPR.clones.h, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
    }
  }
}

/* =======================
   Player & Input
   ======================= */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

function initInput(){
  document.addEventListener('keydown', (e)=>{
    const k = e.key;
    if(k==='w' || k==='W' || k==='ArrowUp'){ activeDirs.up = true; stepPlayer(); playFoot(); }
    if(k==='s' || k==='S' || k==='ArrowDown'){ activeDirs.down = true; stepPlayer(); playFoot(); }
    if(k==='a' || k==='A' || k==='ArrowLeft'){ activeDirs.left = true; stepPlayer(); playFoot(); }
    if(k==='d' || k==='D' || k==='ArrowRight'){ activeDirs.right = true; stepPlayer(); playFoot(); }
    if(k === ' ') applyPowerup('shock');
    if(k === 'Escape') togglePause();
  });
  document.addEventListener('keyup', (e)=>{
    const k = e.key;
    if(k==='w' || k==='W' || k==='ArrowUp') activeDirs.up = false;
    if(k==='s' || k==='S' || k==='ArrowDown') activeDirs.down = false;
    if(k==='a' || k==='A' || k==='ArrowLeft') activeDirs.left = false;
    if(k==='d' || k==='D' || k==='ArrowRight') activeDirs.right = false;
  });
}

function playFoot(){ if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type==='speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (difficultyNumeric()-1)*8));
  if(now - lastStepTime < ms) return;
  lastStepTime = now;
  if(!running || paused) return;

  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--;
  else if(activeDirs.down) ny++;
  else if(activeDirs.left) nx--;
  else if(activeDirs.right) nx++;

  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny] && maze[ny][nx] === 0){
    player.x = nx; player.y = ny;
    movesHistory.push({x:nx, y:ny});
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i];
      if(p.x === nx && p.y === ny){
        applyPowerup(p.type);
        powerups.splice(i,1);
        break;
      }
    }
    if(PORTAL && nx === PORTAL.x && ny === PORTAL.y){
      if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
      transitionToNextLevel();
    }
  }
}

/* =======================
   Mobile joystick
   ======================= */
let joystickActive=false, joystickPointerId=null, joystickOrigin={x:0,y:0}, joystickPos={x:0,y:0};
const joystickMax = 40;

function initJoystick(){
  if(!joystickContainer || !joystickEl) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if(!isTouch){ joystickContainer.classList.add('hidden'); return; }
  joystickContainer.classList.remove('hidden');

  joystickContainer.addEventListener('pointerdown', (ev)=>{
    joystickContainer.setPointerCapture(ev.pointerId);
    joystickActive = true; joystickPointerId = ev.pointerId;
    const rect = joystickContainer.getBoundingClientRect();
    joystickOrigin.x = rect.left + rect.width/2;
    joystickOrigin.y = rect.top + rect.height/2;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joystickContainer.addEventListener('pointermove', (ev)=>{
    if(!joystickActive || ev.pointerId !== joystickPointerId) return;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joystickContainer.addEventListener('pointerup', (ev)=>{
    if(ev.pointerId !== joystickPointerId) return;
    joystickActive=false; joystickPointerId=null; joystickPos={x:0,y:0};
    joystickEl.style.transform = `translate(0px,0px)`;
    activeDirs = { up:false, down:false, left:false, right:false };
  });
  joystickContainer.addEventListener('pointercancel', ()=>{ joystickActive=false; joystickPointerId=null; joystickPos={x:0,y:0}; joystickEl.style.transform = `translate(0px,0px)`; activeDirs = { up:false, down:false, left:false, right:false }; });
}

function updateJoystick(cx, cy){
  const dx = cx - joystickOrigin.x, dy = cy - joystickOrigin.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  const r = Math.min(dist, joystickMax) * SETTINGS.joystickSensitivity;
  joystickPos.x = nx * r; joystickPos.y = ny * r;
  joystickEl.style.transform = `translate(${joystickPos.x}px, ${joystickPos.y}px)`;
  activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
  activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
  stepPlayer();
}

/* =======================
   Clone spawn
   ======================= */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random();
  let type = 'basic';
  if(p < 0.08) type = 'wraith';
  else if(p < 0.22) type = 'fast';
  const c = new Clone(snap, type);
  clones.push(c);
  if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
  spawnParticles((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, '#ff4466', 20);
}

/* =======================
   Render helpers
   ======================= */
function drawBackground(now){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.save();
  if(IMG.bg){
    const t = Date.now()/12000;
    const xoff = Math.sin(t) * 36;
    ctx.drawImage(IMG.bg, -40 + xoff, -20, w + 80, h + 40);
  } else {
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#071018'); g.addColorStop(1,'#03040a');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }
  for(let i=0;i<IMG.layers.length;i++){
    const layer = IMG.layers[i];
    if(!layer) continue;
    const depth = (i+1) / (IMG.layers.length+1);
    const xoff = Math.sin(Date.now()/(7000*(1+depth))) * 12 * depth;
    ctx.globalAlpha = 0.75 - depth * 0.15;
    ctx.drawImage(layer, -20 + xoff, -10, w+40, h+20);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0,0,canvas.width/pixelRatio, canvas.height/pixelRatio);
}

function drawMaze(){
  if(!maze) return;
  if(mazeCache){ ctx.drawImage(mazeCache, 0, 0); return; }
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const v = maze[y] && typeof maze[y][x] !== 'undefined' ? maze[y][x] : 1;
      if(v === 1){
        ctx.fillStyle = '#2e2e2e';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

function drawPowerups(now){
  for(const pu of powerups){
    const cx = pu.x*tileSize + tileSize/2;
    const cy = pu.y*tileSize + tileSize/2 + Math.sin((frameCount + pu.bob) * 0.12) * 3;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(frameCount/18 + pu.bob)*0.08);
    if(pu.type === 'speed'){ ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,tileSize*0.24,0,Math.PI*2); ctx.fill(); }
    else if(pu.type === 'cloak'){ ctx.fillStyle = '#9be7b0'; ctx.fillRect(-tileSize*0.2, -tileSize*0.2, tileSize*0.4, tileSize*0.4); }
    else { ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(0,-tileSize*0.22); ctx.lineTo(tileSize*0.14,0); ctx.lineTo(-tileSize*0.14,0); ctx.fill(); }
    ctx.restore();
  }
}

function drawPortal(now){
  if(!PORTAL) return;
  const px = PORTAL.x*tileSize + tileSize/2, py = PORTAL.y*tileSize + tileSize/2;
  const scale = 0.9 + 0.08 * Math.sin(now/280);
  const rot = (now / 1400) % (Math.PI*2);
  if(IMG.portal){
    ctx.save(); ctx.translate(px,py); ctx.rotate(rot);
    ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320);
    ctx.drawImage(IMG.portal, -tileSize*scale/2, -tileSize*scale/2, tileSize*scale, tileSize*scale);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(px,py); ctx.rotate(rot/1.8); ctx.fillStyle = '#66ffcc'; ctx.beginPath(); ctx.ellipse(0,0,tileSize*0.42,tileSize*0.46,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

function drawMinimap(){
  if(!miniCtx || !maze) return;
  const mmW = minimap.width, mmH = minimap.height;
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
      miniCtx.fillRect(x*cw, y*ch, cw, ch);
    }
  }
  for(const c of clones){
    miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
    miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  }
  miniCtx.fillStyle = '#66ff99';
  miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){
    miniCtx.fillStyle = pu.type==='speed' ? '#4fd1ff' : pu.type==='cloak' ? '#9be7b0' : '#bfe8ff';
    miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
  }
}

function drawPlayer(){
  if(!player) return;
  if(IMG.ninja && SPR.ninja.w){
    const animCol = Math.floor((frameCount/6) % SPR.ninja.cols);
    const sx = animCol * SPR.ninja.w;
    ctx.drawImage(IMG.ninja, sx, 0, SPR.ninja.w, SPR.ninja.h, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
    ctx.save(); ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* =======================
   HUD helpers
   ======================= */
function showToast(text, duration=1600){
  const n = document.createElement('div'); n.className = 'notif'; n.textContent = text; notifArea.appendChild(n);
  setTimeout(()=>{ n.style.transition='opacity .45s, transform .45s'; n.style.opacity='0'; n.style.transform='translateY(-18px)'; setTimeout(()=>n.remove(),480); }, duration);
}
function setStatusText(s){ if(statusText) statusText.textContent = s; }
function updateHUD(){
  const tEl = timerText;
  if(tEl) tEl.textContent = `Time: ${nowSec()}s`;
  if(powerupBox){
    if(activePower && Date.now() < activePower.until){
      const rem = Math.ceil((activePower.until - Date.now())/1000);
      powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
    } else {
      powerupBox.innerHTML = '';
      if(activePower && Date.now() >= activePower.until) activePower = null;
    }
  }
}

/* =======================
   Main game loop
   ======================= */
let lastFrame = performance.now();
function animate(now){
  if(!running || paused) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  // spawn powerups occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + difficultyValue()*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneInterval > 30) cloneInterval -= 1 + (difficultyValue()-1);
    if(Math.random() < 0.02 + (difficultyValue()-1)*0.03) spawnClone();
  }

  // update clones & collision
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i];
    c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type==='cloak' && Date.now() < activePower.until)){
        // death
        running = false;
        if(SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVolume);
        showToast(`☠️ You survived ${nowSec()}s`);
        spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66', 40);
        setTimeout(()=>{ gameOver(); }, 800);
        return;
      }
    }
  }

  updateParticles();

  // render pipeline
  ctx.clearRect(0,0, canvas.width/pixelRatio, canvas.height/pixelRatio);
  drawBackground(now);
  drawMaze();
  drawPowerups(now);
  drawPortal(now);
  for(const c of clones) c.draw();

  // smooth player pos
  const speed = 12 + (difficultyValue()-1)*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i];
    const alpha = (i - Math.max(0, movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha * 0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  drawPlayer();
  drawParticles();
  drawMinimap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* =======================
   Difficulty mapping
   ======================= */
function difficultyValue(){
  switch(SETTINGS.difficulty){
    case 'easy': return 0.8;
    case 'normal': return 1;
    case 'hard': return 1.5;
    case 'nightmare': return 2.2;
    default: return 1;
  }
}

/* =======================
   Level / lifecycle functions
   ======================= */
function startLevel(index=0, useAscii=false){
  currentLevel = clamp(index, 0, LEVELS.length-1);
  resizeCanvas();
  const L = LEVELS[currentLevel];
  if(useAscii && ASCII_LEVELS[currentLevel]){
    maze = parseAsciiLevel(ASCII_LEVELS[currentLevel]);
  } else {
    cols = Math.max(11, Math.floor(19 * L.scale));
    rows = Math.max(11, Math.floor(19 * L.scale));
    if(cols%2===0) cols--;
    if(rows%2===0) rows--;
    maze = generateMaze(cols, rows);
    placePortalProcedural();
  }
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = [];
  clones = [];
  powerups = [];
  particles = [];
  frameCount = 0;
  cloneInterval = Math.max(40, 300 - Math.floor(difficultyValue() * 80));
  running = true; paused = false; startTime = Date.now(); activePower = null;
  if(preloader) preloader.style.display = 'none';
  if(bestRecordText) bestRecordText.textContent = localStorage.getItem(STORAGE.BEST) ? `Best: ${localStorage.getItem(STORAGE.BEST)}s` : 'Best: —';
  setStatusText(`Level: ${LEVELS[currentLevel].name}`);
  lastFrame = performance.now();
  requestAnimationFrame(animate);
  tickLoop();
}

function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
  let t = 0, dur = 36;
  function anim(){
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI * (t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, -(s-1)*cx, -(s-1)*cy);
    drawBackground(performance.now());
    drawMaze();
    drawPortal(performance.now());
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t <= dur) requestAnimationFrame(anim);
    else {
      startLevel(Math.min(LEVELS.length-1, currentLevel + 1));
      showToast(`Level Up: ${LEVELS[currentLevel].name}`);
    }
  }
  anim();
}

function gameOver(){
  running = false;
  const elapsed = nowSec();
  const prevBest = Number(localStorage.getItem(STORAGE.BEST)) || 0;
  if(elapsed > prevBest){
    localStorage.setItem(STORAGE.BEST, elapsed);
    showToast('NEW RECORD!');
    addToLeaderboard(elapsed);
  }
  restartBtn && (restartBtn.style.display = 'inline-block');
  menuBtn && (menuBtn.style.display = 'inline-block');
}

/* =======================
   Tick Loop for holding movement
   ======================= */
let lastTick = 0;
function tickLoop(){
  if(!running || paused) return;
  const now = performance.now();
  if(now - lastTick > 120){
    if(activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer();
    lastTick = now;
  }
  requestAnimationFrame(tickLoop);
}

/* =======================
   Audio safe-play
   ======================= */
function safePlay(a, vol=1){
  if(!a) return;
  try{ a.volume = vol; a.currentTime = 0; a.play().catch(()=>{}); }catch(e){}
}

/* =======================
   Leaderboard & localstore
   ======================= */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(STORAGE.LEADER) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):','Player') || 'Player';
  name = name.slice(0,12);
  list.push({name, time});
  list.sort((a,b)=> b.time - a.time);
  localStorage.setItem(STORAGE.LEADER, JSON.stringify(list.slice(0,50)));
  updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem(STORAGE.LEADER) || '[]');
  if(!leaderboardList) return;
  leaderboardList.innerHTML = '';
  list.slice(0,10).forEach(it=>{
    const li = document.createElement('li');
    li.textContent = `${it.name} — ${it.time}s`;
    leaderboardList.appendChild(li);
  });
}

/* =======================
   UI binding & wiring
   ======================= */
function wireUI(){
  async function startRun(){
    try{ await preloadAll(true); }catch(e){ console.warn('prefetch error', e); }
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
    menuRoot && (menuRoot.style.display = 'none');
    tutorialRoot && (tutorialRoot.style.display = 'none');
    settingsRoot && (settingsRoot.style.display = 'none');
    if(uiRoot) uiRoot.style.display = 'block';
    initInput(); initJoystick(); updateLeaderboardUI();
    startLevel(0);
  }

  startBtn && startBtn.addEventListener('click', startRun);

  tutorialBtn && tutorialBtn.addEventListener('click', ()=>{ tutorialRoot && (tutorialRoot.style.display = tutorialRoot.style.display === 'none' ? 'block' : 'none'); });
  settingsBtn && settingsBtn.addEventListener('click', ()=>{ settingsRoot && (settingsRoot.style.display = settingsRoot.style.display === 'none' ? 'block' : 'none'); });
  creditsBtn && creditsBtn.addEventListener('click', ()=>{ alert('Credits: You + AI-assisted AAA build'); });

  restartBtn && restartBtn.addEventListener('click', ()=>{ startLevel(0); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume); restartBtn.style.display='none'; menuBtn && (menuBtn.style.display='none'); });
  menuBtn && menuBtn.addEventListener('click', ()=>{ running=false; menuRoot && (menuRoot.style.display='block'); AUDIO.bg && AUDIO.bg.pause(); });

  musicToggleEl && (musicToggleEl.checked = SETTINGS.music);
  sfxToggleEl && (sfxToggleEl.checked = SETTINGS.sfx);
  difficultyEl && (difficultyEl.value = SETTINGS.difficulty);

  musicToggleEl && musicToggleEl.addEventListener('change', ()=>{ SETTINGS.music = musicToggleEl.checked; saveSettings(); if(!SETTINGS.music && AUDIO.bg) AUDIO.bg.pause(); });
  sfxToggleEl && sfxToggleEl.addEventListener('change', ()=>{ SETTINGS.sfx = sfxToggleEl.checked; saveSettings(); });
  difficultyEl && difficultyEl.addEventListener('change', ()=>{ SETTINGS.difficulty = difficultyEl.value; saveSettings(); });

  clearLeaderboardBtn && clearLeaderboardBtn.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(STORAGE.LEADER); updateLeaderboardUI(); } });

  window.__SCE__ = { IMG, AUDIO, spawnPowerup, spawnClone, SETTINGS, startLevel, cacheMaze, maze, player };
}

/* =======================
   Pause toggle
   ======================= */
function togglePause(){
  paused = !paused;
  if(paused){
    running = false;
    menuRoot && (menuRoot.style.display='block');
    AUDIO.bg && AUDIO.bg.pause();
  } else {
    menuRoot && (menuRoot.style.display='none');
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(animate);
    tickLoop();
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
  }
}

/* =======================
   Difficulty numeric mapping
   ======================= */
function difficultyNumeric(){
  switch(SETTINGS.difficulty){
    case 'easy': return 0.8;
    case 'normal': return 1;
    case 'hard': return 1.5;
    case 'nightmare': return 2.2;
    default: return 1;
  }
}

/* =======================
   Helpers & save
   ======================= */
function saveSettings(){ try{ localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(SETTINGS)); }catch(e){} }

/* =======================
   Boot/Init
   ======================= */
async function boot(){
  resizeCanvas();
  wireUI();
  try{ await preloadAll(false); console.log('Assets prefetch complete'); }catch(e){ console.warn('prefetch error', e); }
  initJoystick();
  console.log('Boot complete. Ready.');
}
boot();
