/* script.js — Shadow Clone Escape (Full AAA)
   Paste into script.js
   - Works with the provided index.html and style.css
   - Configure ASSETS paths below if you used different filenames or directories
*/

/* =========================
   ASSET CONFIG — edit here
   ========================= */
const ASSETS = {
  ninja: "assets/ninja_spritesheet.png",       // your ninja spritesheet (e.g. 1536x534)
  clones: "assets/clones_spritesheet.png",     // clones spritesheet (e.g. 1060x433)
  portal: "assets/portal.png",                 // portal sprite (e.g. 361x316)
  background: "background.png",                // large background image (optional)
  bgLayers: ["assets/bg_layer1.png","assets/bg_layer2.png","assets/bg_layer3.png"],

  // audio (optional) - browsers require user gesture to start playback
  bgMusic: "assets/bg_music_loop.wav",
  spawnSfx: "assets/spawn.wav",
  pickupSfx: "assets/powerup.wav",
  portalSfx: "assets/portal.wav",
  deathSfx: "assets/death.wav"
};

/* =========================
   DOM References (match index.html)
   ========================= */
const preloaderEl        = document.getElementById('preloader');
const startMenuEl        = document.getElementById('startMenu');
const tutorialMenuEl     = document.getElementById('tutorialMenu');
const settingsMenuEl     = document.getElementById('settingsMenu');
const creditsMenuEl      = document.getElementById('creditsMenu');
const pauseMenuEl        = document.getElementById('pauseMenu');
const gameOverMenuEl     = document.getElementById('gameOverMenu');
const victoryMenuEl      = document.getElementById('victoryMenu');

const startBtn           = document.getElementById('startBtn');
const tutorialBtn        = document.getElementById('tutorialBtn');
const settingsBtn        = document.getElementById('settingsBtn');
const creditsBtn         = document.getElementById('creditsBtn');

const tutorialCloseBtns  = Array.from(document.querySelectorAll('#tutorialMenu .closeBtn'));
const settingsCloseBtns  = Array.from(document.querySelectorAll('#settingsMenu .closeBtn'));
const creditsCloseBtns   = Array.from(document.querySelectorAll('#creditsMenu .closeBtn'));

const resumeBtn          = document.getElementById('resumeBtn');
const restartBtn         = document.getElementById('restartBtn');
const quitBtn            = document.getElementById('quitBtn');

const retryBtn           = document.getElementById('retryBtn');
const quitToMenuBtn      = document.getElementById('quitToMenuBtn');
const nextLevelBtn       = document.getElementById('nextLevelBtn');
const quitToMenuBtn2     = document.getElementById('quitToMenuBtn2');

const musicVolumeInput   = document.getElementById('musicVolume');
const sfxVolumeInput     = document.getElementById('sfxVolume');
const difficultySelect   = document.getElementById('difficulty');

const gameContainerEl    = document.getElementById('gameContainer');
const canvasEl           = document.getElementById('gameCanvas');
const minimapEl          = document.getElementById('minimap');

const joystickContainer  = document.getElementById('joystickContainer');
const joystickEl         = document.getElementById('joystick');

/* notification area — create if not present */
let notifArea = document.getElementById('notifArea');
if(!notifArea){
  notifArea = document.createElement('div'); notifArea.id = 'notifArea'; document.body.appendChild(notifArea);
}

/* fallback elements used by earlier code (safe guards) */
const hudStatus = document.getElementById('status') || null;
const bestRecordText = document.getElementById('bestRecordText') || null;

/* =========================
   Storage keys & settings
   ========================= */
const KEY_SETTINGS = 'sce_settings_v1';
const KEY_BEST = 'sce_best_v1';
const KEY_LEADER = 'sce_leader_v1';

let SETTINGS = {
  music: true,
  musicVolume: 0.45,
  sfxVolume: 1.0,
  difficulty: 'normal', // 'easy', 'normal', 'hard', 'nightmare'
  joystickSensitivity: 0.8
};
try {
  const s = JSON.parse(localStorage.getItem(KEY_SETTINGS));
  if(s) SETTINGS = { ...SETTINGS, ...s };
} catch(e){ console.warn('settings parse error', e); }

/* =========================
   Runtime state
   ========================= */
let ctx, miniCtx;
let pixelRatio = window.devicePixelRatio || 1;
let cols = 19, rows = 19, tileSize = 28;
let maze = [];
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
let cloneIntervalFrames = 300;
let activePower = null;
let PORTAL = null;
let currentLevel = 0;

/* Levels (progression) */
const LEVELS = [
  { name:'Novice Shadow', scale:1.0, cloneRate:0.02, cloneBaseSpeed:1.0 },
  { name:'Wandering Echo', scale:1.12, cloneRate:0.025, cloneBaseSpeed:1.08 },
  { name:'Night Stalker', scale:1.25, cloneRate:0.028, cloneBaseSpeed:1.18 },
  { name:'Spectral Onslaught', scale:1.45, cloneRate:0.032, cloneBaseSpeed:1.35 },
  { name:'Ninja\'s Dread', scale:1.75, cloneRate:0.038, cloneBaseSpeed:1.6 },
  { name:'Endless', scale:2.2, cloneRate:0.045, cloneBaseSpeed:2.0 }
];

/* =========================
   Assets containers
   ========================= */
const IMG = { ninja:null, clones:null, portal:null, background:null, bgLayers:[] };
const AUDIO = { bg:null, spawn:null, pickup:null, portal:null, death:null };

/* Sprite metadata — will adjust automatically after load */
const SPRITES = {
  ninja: { cols:4, rows:1, frameW:0, frameH:0 },   // user sprite: 1536x534 -> cols 4
  clones: { cols:3, rows:1, frameW:0, frameH:0 },  // user: 1060x433 -> cols 3
  portal: { cols:1, rows:1, frameW:0, frameH:0 }
};

/* =========================
   Utility helpers
   ========================= */
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const randInt = (a,b)=> Math.floor(Math.random()*(b-a+1))+a;
const shuffle = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } return arr; };
const nowSec = ()=> Math.floor((Date.now()-startTime)/1000);

function saveSettings(){
  try{ localStorage.setItem(KEY_SETTINGS, JSON.stringify(SETTINGS)); }catch(e){ console.warn('save settings failed', e); }
}

/* =========================
   Loader (images & audio)
   ========================= */
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

async function preloadAll(showPreloader = true){
  if(showPreloader && preloaderEl) preloaderEl.style.display = 'flex';
  const tasks = [
    {type:'img', key:'ninja', path:ASSETS.ninja},
    {type:'img', key:'clones', path:ASSETS.clones},
    {type:'img', key:'portal', path:ASSETS.portal},
    {type:'img', key:'background', path:ASSETS.background},
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
        else if(t.key === 'background') IMG.background = img;
        else if(t.key === 'bg1') IMG.bgLayers[0] = img;
        else if(t.key === 'bg2') IMG.bgLayers[1] = img;
        else if(t.key === 'bg3') IMG.bgLayers[2] = img;
        console.log('Loaded image', t.path);
      } else console.warn('Missing image', t.path);
    } else {
      const a = await loadAudio(t.path);
      if(a){
        if(t.key === 'bg') AUDIO.bg = a;
        else if(t.key === 'spawn') AUDIO.spawn = a;
        else if(t.key === 'pickup') AUDIO.pickup = a;
        else if(t.key === 'portal') AUDIO.portal = a;
        else if(t.key === 'death') AUDIO.death = a;
        console.log('Loaded audio', t.path);
      } else console.warn('Missing audio', t.path);
    }
    done++;
    const pct = Math.floor((done/total)*100);
    if(preloaderEl) preloaderEl.querySelector('p') && (preloaderEl.querySelector('p').textContent = `Loading assets... ${pct}%`);
    await new Promise(r=>setTimeout(r, 30)); // small pacing
  }

  // set volumes & loop
  if(AUDIO.bg){ AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.musicVolume; }
  if(AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfxVolume;
  if(AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfxVolume;
  if(AUDIO.portal) AUDIO.portal.volume = SETTINGS.sfxVolume;
  if(AUDIO.death) AUDIO.death.volume = SETTINGS.sfxVolume;

  // compute sprite frame sizes
  if(IMG.ninja){ SPRITES.ninja.frameW = Math.floor(IMG.ninja.naturalWidth / SPRITES.ninja.cols); SPRITES.ninja.frameH = Math.floor(IMG.ninja.naturalHeight / SPRITES.ninja.rows); }
  if(IMG.clones){ SPRITES.clones.frameW = Math.floor(IMG.clones.naturalWidth / SPRITES.clones.cols); SPRITES.clones.frameH = Math.floor(IMG.clones.naturalHeight / SPRITES.clones.rows); }
  if(IMG.portal){ SPRITES.portal.frameW = Math.floor(IMG.portal.naturalWidth / SPRITES.portal.cols); SPRITES.portal.frameH = Math.floor(IMG.portal.naturalHeight / SPRITES.portal.rows); }

  if(showPreloader && preloaderEl) preloaderEl.style.display = 'none';
}

/* =========================
   Canvas sizing & resize
   ========================= */
function setupCanvas(){
  pixelRatio = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth - 40, 1200);
  const cssW = Math.min(maxW, window.innerWidth - 40);
  canvasEl.style.width = cssW + 'px';
  const logicalW = Math.floor(cssW);
  const logicalH = Math.floor(logicalW * 0.62);
  canvasEl.width = Math.floor(logicalW * pixelRatio);
  canvasEl.height = Math.floor(logicalH * pixelRatio);
  ctx = canvasEl.getContext('2d');
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);

  // minimap
  const mmW = Math.min(220, Math.floor(cssW * 0.28));
  const mmH = Math.floor(mmW * 0.55);
  minimapEl.width = mmW;
  minimapEl.height = mmH;
  minimapEl.style.width = mmW + 'px';
  minimapEl.style.height = mmH + 'px';
  miniCtx = minimapEl.getContext('2d');

  // recompute grid (cols/rows/tileSize)
  const preferred = window.innerWidth < 720 ? 24 : 36;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor((logicalH) / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, logicalH / rows));
}

/* =========================
   Maze generation (recursive backtracker)
   ========================= */
function generateMaze(c, r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x + dx, ny = y + dy;
      if(nx > 0 && nx < c-1 && ny > 0 && ny < r-1 && grid[ny][nx] === 1){
        grid[y + dy/2][x + dx/2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1,1);
  grid[1][1] = 0; if(grid[1][2] !== undefined) grid[1][2] = 0; if(grid[2]) grid[2][1] = 0;
  return grid;
}

/* cache maze to offscreen canvas for performance */
function cacheMaze(){
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
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

/* find a remote location for the portal (farthest from start) */
function placePortal(){
  let best = null, bestd = -1;
  for(let y=rows-2;y>=1;y--){
    for(let x=cols-2;x>=1;x--){
      if(maze[y][x] === 0 && !(x===1 && y===1)){
        const d = Math.abs(x-1) + Math.abs(y-1);
        if(d > bestd){ bestd = d; best = {x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* =========================
   Powerups
   ========================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let tries = 0;
  while(tries++ < 300){
    const x = randInt(1, cols-2);
    const y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x && p.y===y)){
      powerups.push({ x, y, type: POWER_TYPES[randInt(0, POWER_TYPES.length-1)], bob: Math.random()*Math.PI*2, spawned: Date.now() });
      break;
    }
  }
}
function applyPowerup(type){
  if(type === 'speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type === 'cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type === 'shock'){
    clones.forEach(c => { c.index = Math.max(0, (c.index||0) - 28); });
    spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#bfe8ff', 18);
    if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
  }
  if(SETTINGS.sfx && AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfxVolume);
  showToast(`${type.toUpperCase()}!`);
}

/* =========================
   Particles utils
   ========================= */
function spawnParticles(px, py, color, count = 18){
  for(let i=0;i<count;i++){
    particles.push({
      x: px + (Math.random()-0.5) * tileSize,
      y: py + (Math.random()-0.5) * tileSize,
      vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
      life: 30 + Math.random()*40,
      color
    });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life/70);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/* =========================
   Clone class & behavior
   ========================= */
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
        this.index = Math.min(this.path.length - 1, this.index + jump);
      } else this.index++;
    } else {
      this.index++;
    }
    if(this.index < this.path.length){
      this.x = this.path[this.index].x;
      this.y = this.path[this.index].y;
    }
  }
  draw(){
    if(IMG.clones){
      const tIndex = (this.type === 'wraith') ? 2 : (this.type === 'fast' ? 1 : 0);
      const sx = tIndex * SPRITES.clones.frameW;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clones, sx, 0, SPRITES.clones.frameW, SPRITES.clones.frameH, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
    }
  }
}

/* =========================
   Player & input handling
   ========================= */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', (e)=>{
  const key = e.key;
  if(['w','W','ArrowUp'].includes(key)) { activeDirs.up = true; stepPlayer(); playStep(); }
  if(['s','S','ArrowDown'].includes(key)) { activeDirs.down = true; stepPlayer(); playStep(); }
  if(['a','A','ArrowLeft'].includes(key)) { activeDirs.left = true; stepPlayer(); playStep(); }
  if(['d','D','ArrowRight'].includes(key)) { activeDirs.right = true; stepPlayer(); playStep(); }
  if(key === ' ') applyPowerup('shock');
  if(key === 'Escape') togglePause();
});
document.addEventListener('keyup', (e)=>{
  const key = e.key;
  if(['w','W','ArrowUp'].includes(key)) activeDirs.up = false;
  if(['s','S','ArrowDown'].includes(key)) activeDirs.down = false;
  if(['a','A','ArrowLeft'].includes(key)) activeDirs.left = false;
  if(['d','D','ArrowRight'].includes(key)) activeDirs.right = false;
});

function playStep(){ if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (difficultyValue()-1) * 8));
  if(now - lastStepTime < ms) return;
  lastStepTime = now;
  if(!running || paused) return;

  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--;
  else if(activeDirs.down) ny++;
  else if(activeDirs.left) nx--;
  else if(activeDirs.right) nx++;

  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny][nx] === 0){
    player.x = nx; player.y = ny;
    movesHistory.push({x:nx, y:ny});
    // pickup powerups
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i];
      if(p.x === nx && p.y === ny){
        applyPowerup(p.type);
        powerups.splice(i,1);
        break;
      }
    }
    // portal reached
    if(PORTAL && nx === PORTAL.x && ny === PORTAL.y){
      if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
      transitionToNextLevel();
    }
  }
}

/* =========================
   Mobile joystick (pointer-based)
   ========================= */
let joystickActive = false;
let joystickPointerId = null;
let joystickOrigin = {x:0, y:0};
let joystickPos = {x:0, y:0};
const joystickMax = 40;

function initJoystick(){
  if(!joystickContainer || !joystickEl) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if(!isTouch){ joystickContainer.classList.add('hidden'); return; }
  joystickContainer.classList.remove('hidden');

  joystickContainer.addEventListener('pointerdown', (ev)=>{
    joystickContainer.setPointerCapture(ev.pointerId);
    joystickActive = true;
    joystickPointerId = ev.pointerId;
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
    joystickActive = false;
    joystickPointerId = null;
    joystickPos = {x:0, y:0};
    joystickEl.style.transform = `translate(0px,0px)`;
    activeDirs = { up:false, down:false, left:false, right:false };
  });
  joystickContainer.addEventListener('pointercancel', ()=>{ joystickActive = false; joystickPointerId = null; joystickPos={x:0,y:0}; joystickEl.style.transform = `translate(0px,0px)`; activeDirs={ up:false, down:false, left:false, right:false }; });
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

/* =========================
   Clone spawning
   ========================= */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random();
  let type = 'basic';
  if(p < 0.08) type = 'wraith';
  else if(p < 0.22) type = 'fast';
  clones.push(new Clone(snap, type));
  if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
  spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ff4466');
}

/* =========================
   Draw helpers (background, maze, portal, minimap, player)
   ========================= */
function drawBackground(now){
  const w = canvasEl.clientWidth;
  const h = canvasEl.clientHeight;
  ctx.save();
  // parallax main background
  if(IMG.background){
    const t = Date.now()/12000;
    const xoff = Math.sin(t) * 36;
    ctx.drawImage(IMG.background, -40 + xoff, -20, w + 80, h + 40);
  } else {
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#071018'); g.addColorStop(1,'#03040a');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }
  // layered parallax
  for(let i=0;i<IMG.bgLayers.length;i++){
    const layer = IMG.bgLayers[i];
    if(!layer) continue;
    const depth = (i+1) / (IMG.bgLayers.length+1);
    const xoff = Math.sin(Date.now()/(7000*(1+depth))) * 12 * depth;
    ctx.globalAlpha = 0.75 - depth * 0.15;
    ctx.drawImage(layer, -20 + xoff, -10, w+40, h+20);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // vignette
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0,0,w,h);
}

function drawMaze(){
  if(!maze) return;
  if(mazeCache){ ctx.drawImage(mazeCache, 0, 0); return; }
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
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
  if(!miniCtx) return;
  const mmW = minimapEl.width, mmH = minimapEl.height;
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
      miniCtx.fillRect(x*cw, y*ch, cw, ch);
    }
  }
  // clones
  for(const c of clones){
    miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
    miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  }
  // player
  miniCtx.fillStyle = '#66ff99';
  miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  // powerups
  for(const pu of powerups){
    miniCtx.fillStyle = pu.type==='speed' ? '#4fd1ff' : pu.type==='cloak' ? '#9be7b0' : '#bfe8ff';
    miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
  }
}

function drawPlayer(){
  if(!player) return;
  if(IMG.ninja){
    const animCol = Math.floor((frameCount/6) % SPRITES.ninja.cols);
    const sx = animCol * SPRITES.ninja.frameW;
    const sy = 0;
    ctx.drawImage(IMG.ninja, sx, sy, SPRITES.ninja.frameW, SPRITES.ninja.frameH, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
    ctx.save(); ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* =========================
   HUD update & toast
   ========================= */
function setStatusText(s){
  if(hudStatus) hudStatus.textContent = s;
}
function showToast(text){
  const el = document.createElement('div'); el.className = 'notif'; el.textContent = text; notifArea.appendChild(el);
  setTimeout(()=>{ el.style.transition = 'opacity .45s, transform .45s'; el.style.opacity = '0'; el.style.transform = 'translateY(-18px)'; setTimeout(()=>el.remove(),480); }, 1600);
}

/* =========================
   Main game loop
   ========================= */
let lastFrameTime = performance.now();
function animate(now){
  if(!running || paused) return;
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  frameCount++;

  // spawn powerups occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing based on cloneIntervalFrames
  const intervalFrames = Math.max(8, Math.floor(cloneIntervalFrames / (1 + difficultyValue()*0.3)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneIntervalFrames > 30) cloneIntervalFrames = Math.max(30, cloneIntervalFrames - 1 - (difficultyValue()-1));
    if(Math.random() < 0.02 + (difficultyValue()-1) * 0.03) spawnClone();
  }

  // update clones & collision
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i];
    c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)){
        // death
        running = false;
        if(SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVolume);
        showToast('☠️ You Died');
        spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66', 40);
        setTimeout(()=>{ gameOver(); }, 800);
        return;
      }
    }
  }

  updateParticles();

  // render pipeline
  ctx.clearRect(0,0,canvasEl.width/pixelRatio, canvasEl.height/pixelRatio);
  drawBackground(now);
  drawMaze();
  drawPowerups(now);
  drawPortal(now);
  for(const c of clones) c.draw();

  // smooth player position lerp
  const speed = 12 + (difficultyValue()-1) * 6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail effect (last few moves)
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

/* =========================
   Difficulty numeric mapping
   ========================= */
function difficultyValue(){
  switch(SETTINGS.difficulty){
    case 'easy': return 0.8;
    case 'normal': return 1;
    case 'hard': return 1.5;
    case 'nightmare': return 2.2;
    default: return 1;
  }
}

/* =========================
   Level start / reset / gameover
   ========================= */
function startLevel(index = 0){
  currentLevel = clamp(index, 0, LEVELS.length-1);
  const L = LEVELS[currentLevel];
  setupCanvas();
  cols = Math.max(11, Math.floor(19 * L.scale));
  rows = Math.max(11, Math.floor(19 * L.scale));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = [];
  clones = [];
  powerups = [];
  particles = [];
  frameCount = 0;
  cloneIntervalFrames = Math.max(40, 300 - Math.floor(difficultyValue()*80));
  running = true; paused = false; startTime = Date.now(); activePower = null;
  placePortal();
  if(preloaderEl) preloaderEl.style.display = 'none';
  setStatusText(`Level: ${L.name}`);
  lastFrameTime = performance.now();
  requestAnimationFrame(animate);
  tickLoop();
}

/* game over */
function gameOver(){
  running = false;
  // show game over menu
  gameOverMenuEl && (gameOverMenuEl.classList.remove('hidden'));
  // update scoreboard + leaderboard
  const elapsed = nowSec();
  const prevBest = Number(localStorage.getItem(KEY_BEST)) || 0;
  if(elapsed > prevBest){
    localStorage.setItem(KEY_BEST, elapsed);
    showToast('NEW RECORD!');
    addToLeaderboard(elapsed);
  }
}

/* transition to next level — geometry-dash style */
function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
  let t = 0; const dur = 36;
  function anim(){
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI*(t/dur));
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

/* =========================
   Tick loop to keep stepping when holding keys
   ========================= */
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

/* =========================
   Audio helper (safe play)
   ========================= */
function safePlay(a, vol=1){
  if(!a) return;
  try{ a.volume = vol; a.currentTime = 0; a.play().catch(()=>{}); }catch(e){}
}

/* =========================
   Leaderboard & local store
   ========================= */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(KEY_LEADER) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):', 'Player') || 'Player';
  name = name.slice(0,12);
  list.push({ name, time });
  list.sort((a,b)=> b.time - a.time);
  localStorage.setItem(KEY_LEADER, JSON.stringify(list.slice(0,50)));
}
function getLeaderboard(){
  return JSON.parse(localStorage.getItem(KEY_LEADER) || '[]');
}

/* =========================
   UI wiring
   ========================= */
function wireUI(){
  // start
  startBtn && startBtn.addEventListener('click', async ()=>{
    // preload assets (show preloader)
    await preloadAll(true);
    // start music if allowed
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
    // hide main menu and open game
    startMenuEl && startMenuEl.classList.add('hidden');
    tutorialMenuEl && tutorialMenuEl.classList.add('hidden');
    settingsMenuEl && settingsMenuEl.classList.add('hidden');
    creditsMenuEl && creditsMenuEl.classList.add('hidden');
    gameContainerEl && (gameContainerEl.style.display = 'block');
    // setup joystick for mobile
    initJoystick();
    // start first level
    startLevel(0);
  });

  // menus
  tutorialBtn && tutorialBtn.addEventListener('click', ()=>{ startMenuEl && startMenuEl.classList.add('hidden'); tutorialMenuEl && tutorialMenuEl.classList.remove('hidden');});
  tutorialCloseBtns.forEach(b=> b.addEventListener('click', ()=>{ tutorialMenuEl && tutorialMenuEl.classList.add('hidden'); startMenuEl && startMenuEl.classList.remove('hidden'); }));

  settingsBtn && settingsBtn.addEventListener('click', ()=>{ startMenuEl && startMenuEl.classList.add('hidden'); settingsMenuEl && settingsMenuEl.classList.remove('hidden'); });
  settingsCloseBtns.forEach(b=> b.addEventListener('click', ()=>{ settingsMenuEl && settingsMenuEl.classList.add('hidden'); startMenuEl && startMenuEl.classList.remove('hidden'); saveSettings(); }));

  creditsBtn && creditsBtn.addEventListener('click', ()=>{ startMenuEl && startMenuEl.classList.add('hidden'); creditsMenuEl && creditsMenuEl.classList.remove('hidden'); });
  creditsCloseBtns.forEach(b=> b.addEventListener('click', ()=>{ creditsMenuEl && creditsMenuEl.classList.add('hidden'); startMenuEl && startMenuEl.classList.remove('hidden'); }));

  // pause / resume / restart
  resumeBtn && resumeBtn.addEventListener('click', ()=>{ togglePause(); });
  restartBtn && restartBtn.addEventListener('click', ()=>{ startLevel(0); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume); });
  quitBtn && quitBtn.addEventListener('click', ()=>{ running=false; gameContainerEl && (gameContainerEl.style.display='none'); startMenuEl && startMenuEl.classList.remove('hidden'); if(AUDIO.bg) AUDIO.bg.pause(); });

  retryBtn && retryBtn.addEventListener('click', ()=>{ gameOverMenuEl && gameOverMenuEl.classList.add('hidden'); startLevel(0); });
  quitToMenuBtn && quitToMenuBtn.addEventListener('click', ()=>{ gameOverMenuEl && gameOverMenuEl.classList.add('hidden'); startMenuEl && startMenuEl.classList.remove('hidden'); if(AUDIO.bg) AUDIO.bg.pause(); });
  nextLevelBtn && nextLevelBtn.addEventListener('click', ()=>{ victoryMenuEl && victoryMenuEl.classList.add('hidden'); startLevel(currentLevel+1); });
  quitToMenuBtn2 && quitToMenuBtn2.addEventListener('click', ()=>{ victoryMenuEl && victoryMenuEl.classList.add('hidden'); startMenuEl && startMenuEl.classList.remove('hidden'); });

  // settings sliders
  musicVolumeInput && musicVolumeInput.addEventListener('input', (e)=>{ SETTINGS.musicVolume = Number(e.target.value); if(AUDIO.bg) AUDIO.bg.volume = SETTINGS.musicVolume; saveSettings(); });
  sfxVolumeInput && sfxVolumeInput.addEventListener('input', (e)=>{ SETTINGS.sfxVolume = Number(e.target.value); AUDIO.spawn && (AUDIO.spawn.volume = SETTINGS.sfxVolume); saveSettings(); });
  difficultySelect && difficultySelect.addEventListener('change', (e)=>{ SETTINGS.difficulty = e.target.value; saveSettings(); });

  // window resize
  window.addEventListener('resize', ()=>{ setupCanvas(); cacheMaze(); });

  // debug exposure
  window.__SHADOW = { IMG, AUDIO, startLevel, spawnPowerup, spawnClone, SETTINGS, getLeaderboard };
}

/* =========================
   Pause toggle
   ========================= */
function togglePause(){
  paused = !paused;
  if(paused){
    running = false;
    pauseMenuEl && pauseMenuEl.classList.remove('hidden');
    if(AUDIO.bg) AUDIO.bg.pause();
  } else {
    pauseMenuEl && pauseMenuEl.classList.add('hidden');
    running = true;
    lastFrameTime = performance.now();
    requestAnimationFrame(animate);
    tickLoop();
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
  }
}

/* =========================
   HUD update
   ========================= */
function updateHUD(){
  // timer text maybe in index; if not present, skip
  const timerEl = document.getElementById('timer');
  if(timerEl) timerEl.textContent = `Time: ${nowSec()}s`;
  // powerup box
  const powerBox = document.getElementById('powerupBox');
  if(powerBox){
    if(activePower && Date.now() < activePower.until){
      const rem = Math.ceil((activePower.until - Date.now()) / 1000);
      powerBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
    } else {
      powerBox.innerHTML = '';
      if(activePower && Date.now() >= activePower.until) activePower = null;
    }
  }
}

/* =========================
   Game Over helper
   ========================= */
function gameOverCleanup(){
  running = false;
  // show Game Over menu (already called)
}

/* =========================
   Safe console wrapper for missing element warnings or debug
   ========================= */
function log(...args){ console.log('[SCE]', ...args); }

/* =========================
   Helper: get difficulty numeric value for pacing
   ========================= */
function difficultyNumeric(){
  switch(SETTINGS.difficulty){
    case 'easy': return 0.8;
    case 'normal': return 1.0;
    case 'hard': return 1.4;
    case 'nightmare': return 1.9;
    default: return 1.0;
  }
}

/* =========================
   Init boot sequence
   ========================= */
async function boot(){
  if(!canvasEl || !minimapEl){ alert('Missing canvas or minimap elements in HTML. Make sure index.html uses IDs: gameCanvas and minimap.'); return; }
  setupCanvas();
  wireUI();
  // prefetch quietly (no preloader)
  try{ await preloadAll(false); }catch(e){ console.warn('prefetch error', e); }
  // setup joystick
  initJoystick();
  // small preview animation loop for start screen if you want (not necessary)
  console.log('Boot complete. Ready.');
}
boot();
