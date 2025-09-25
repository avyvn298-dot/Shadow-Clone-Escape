/* ==========================================================================
   Shadow Clone Escape — Full AAA Script (polished)
   - Paste whole file into script.js
   - Works with the provided index.html and style.css
   - Edit ASSETS near top to match your filenames/paths if needed
   - Defensive: will not crash if some assets are missing
   - Features:
     * loader + preloader
     * sprite slicing (ninja 1536x534, clones 1060x433, portal 361x316)
     * stylish maze rendering (textured + glow)
     * minimap
     * joystick + WASD + arrow keys
     * clones that replay your steps with types (basic/fast/wraith)
     * powerups: speed, cloak, shock
     * level progression + geometry-dash style transition
     * audio playback with fallback synth when files missing
     * UI wiring for Start/Settings/Tutorial/Leaderboard & back buttons
   ========================================================================== */

/* =========================
   EDITABLE ASSETS (change if your file names differ)
   ========================= */
const ASSETS = {
  ninja: 'assets/ninja_spritesheet.png',   // expected 1536x534 (4 frames horizontal)
  clones: 'assets/clones_spritesheet.png', // expected 1060x433 (3 frames horizontal)
  portal: 'assets/portal.png',             // expected 361x316
  background: 'assets/background.png',     // optional big background
  bgLayers: ['assets/bg_layer1.png','assets/bg_layer2.png','assets/bg_layer3.png'], // optional parallax
  audio: {
    bg: 'assets/bg_music_loop.wav',
    spawn: 'assets/spawn.wav',
    pickup: 'assets/powerup.wav',
    portal: 'assets/portal.wav',
    death: 'assets/death.wav'
  }
};

/* =========================
   DOM short helpers
   ========================= */
const $ = id => document.getElementById(id);
const qAll = sel => Array.from(document.querySelectorAll(sel));

/* Try to find elements from given index.html structure */
const startBtn = $('start-btn') || $('btnStart') || null;
const settingsBtn = $('settings-btn') || $('btnSettings') || null;
const leaderboardBtn = $('leaderboard-btn') || $('btnLeaderboard') || null;
const tutorialBtn = $('tutorial-btn') || $('btnTutorial') || null;
const backButtons = qAll('.back-btn');
const canvas = $('gameCanvas');
const mainMenu = $('menu-container') || $('mainMenu');
const settingsMenu = $('settings-container') || $('settings');
const tutorialMenu = $('tutorial-container') || $('tutorial');
const leaderboardMenu = $('leaderboard-container') || $('leaderboard');
const preloader = $('preloader') || null;
const preloadText = $('preloadText') || null;

/* Hide page if canvas missing — fail early */
if(!canvas){ console.error('Missing canvas element with id "gameCanvas". Add it to index.html.'); }

/* =========================
   Global runtime & settings
   ========================= */
let ctx = canvas ? canvas.getContext('2d') : null;
let miniCanvas = null, miniCtx = null;

const STORAGE_KEYS = { SETTINGS: 'sce_settings_v1', BEST: 'sce_best_v1', LEADER: 'sce_leader_v1' };
let SETTINGS = {
  music: true,
  sfx: true,
  musicVolume: 0.45,
  sfxVolume: 1.0,
  difficulty: 'normal',
  joystickSensitivity: 0.92
};

/* load saved settings if any */
try {
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
  if(s) SETTINGS = { ...SETTINGS, ...s };
} catch(e){ console.warn('settings load error', e); }

/* =========================
   Asset containers
   ========================= */
const IMG = { ninja:null, clones:null, portal:null, background:null, bgLayers:[] };
const AUDIO = { bg:null, spawn:null, pickup:null, portal:null, death:null };

/* sprite metadata computed after load */
const SPR = {
  ninja: { cols: 4, w: 0, h: 0 },   // 1536x534 recommended
  clones: { cols: 3, w: 0, h: 0 },  // 1060x433 recommended
  portal: { cols: 1, w: 0, h: 0 }   // 361x316 recommended
};

/* canvas / grid state */
let pixelRatio = window.devicePixelRatio || 1;
let cols = 19, rows = 19, tileSize = 30;
let maze = null;
let mazeCache = null;

/* game state variables */
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
let currentLevelIndex = 0;

/* levels */
const LEVELS = [
  { name: 'Novice Shadow', scale: 1.0 },
  { name: 'Wandering Echo', scale: 1.12 },
  { name: 'Night Stalker', scale: 1.25 },
  { name: 'Spectral Onslaught', scale: 1.45 },
  { name: "Ninja's Dread", scale: 1.75 },
  { name: 'Endless', scale: 2.2 }
];

/* helpers */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const shuffle = (a) => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]];} return a; };
const nowSec = () => Math.floor((Date.now() - startTime)/1000);

/* =========================
   Audio fallback synth (small beep when missing)
   ========================= */
let AUDIO_CTX = null;
function ensureAudioCtx(){
  if(!AUDIO_CTX) AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)();
}
function synthOnce(type='pick', volume=0.8){
  try{
    ensureAudioCtx();
    const ctx = AUDIO_CTX;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    if(type === 'spawn'){ o.type = 'sawtooth'; o.frequency.value = 640; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx ? SETTINGS.sfxVolume * volume : 0.0001, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15); }
    else if(type === 'pickup'){ o.type = 'triangle'; o.frequency.value = 980; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx ? SETTINGS.sfxVolume * volume : 0.0001, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); }
    else if(type === 'portal'){ o.type='sine'; o.frequency.value = 420; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx ? SETTINGS.sfxVolume * (volume*0.9) : 0.0001, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24); }
    else if(type === 'death'){ o.type='sine'; o.frequency.value = 150; g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx ? SETTINGS.sfxVolume * (volume*1.0) : 0.0001, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); }
    o.start(t); o.stop(t + 0.26);
  }catch(e){ /* ignore */ }
}

/* safe play helper for Audio elements */
function safePlayAudio(audioEl, vol=1){
  if(!audioEl) return false;
  try{
    audioEl.volume = vol;
    audioEl.currentTime = 0;
    audioEl.play().catch(()=>{});
    return true;
  }catch(e){ return false; }
}

/* =========================
   Async loaders
   ========================= */
function loadImage(src){
  return new Promise((res) => {
    if(!src){ res(null); return; }
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => { console.warn('Image failed to load:', src); res(null); };
    i.src = src;
  });
}
function loadAudio(src){
  return new Promise((res) => {
    if(!src){ res(null); return; }
    try{
      const a = new Audio();
      a.addEventListener('canplaythrough', ()=>res(a), { once: true });
      a.addEventListener('error', ()=>{ console.warn('Audio failed to load:', src); res(null); }, { once: true });
      a.src = src;
    }catch(e){ console.warn('Audio load exception', e); res(null); }
  });
}

async function preloadAll(showPreloader = true){
  if(showPreloader && preloader) preloader.classList.remove('hidden');
  const tasks = [
    {type:'img', key:'ninja', path: ASSETS.ninja},
    {type:'img', key:'clones', path: ASSETS.clones},
    {type:'img', key:'portal', path: ASSETS.portal},
    {type:'img', key:'background', path: ASSETS.background},
    {type:'img', key:'bg1', path: ASSETS.bgLayers?.[0]},
    {type:'img', key:'bg2', path: ASSETS.bgLayers?.[1]},
    {type:'img', key:'bg3', path: ASSETS.bgLayers?.[2]},
    {type:'audio', key:'bg', path: ASSETS.audio.bg},
    {type:'audio', key:'spawn', path: ASSETS.audio.spawn},
    {type:'audio', key:'pickup', path: ASSETS.audio.pickup},
    {type:'audio', key:'portal', path: ASSETS.audio.portal},
    {type:'audio', key:'death', path: ASSETS.audio.death}
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
      } else {
        console.warn('Missing image', t.path);
      }
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
    if(preloadText) preloadText.textContent = `Loading assets... ${Math.floor((done/total)*100)}%`;
    await new Promise(r=>setTimeout(r, 14)); // tiny pacing
  }

  // compute sprite frame sizes
  if(IMG.ninja){ SPR.ninja.w = Math.floor(IMG.ninja.naturalWidth / SPR.ninja.cols); SPR.ninja.h = Math.floor(IMG.ninja.naturalHeight / 1); }
  if(IMG.clones){ SPR.clones.w = Math.floor(IMG.clones.naturalWidth / SPR.clones.cols); SPR.clones.h = Math.floor(IMG.clones.naturalHeight / 1); }
  if(IMG.portal){ SPR.portal.w = Math.floor(IMG.portal.naturalWidth / SPR.portal.cols); SPR.portal.h = Math.floor(IMG.portal.naturalHeight / 1); }

  // set audio loop & volumes
  if(AUDIO.bg){ AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.musicVolume; }
  if(AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfxVolume;
  if(AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfxVolume;
  if(AUDIO.portal) AUDIO.portal.volume = SETTINGS.sfxVolume;
  if(AUDIO.death) AUDIO.death.volume = SETTINGS.sfxVolume;

  if(showPreloader && preloader) preloader.classList.add('hidden');
}

/* =========================
   Canvas Size / Grid recompute
   ========================= */
function setupCanvas(){
  pixelRatio = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth - 40, 1400);
  const cssW = Math.min(maxW, window.innerWidth - 40);
  canvas.style.width = cssW + 'px';
  const logicalW = Math.floor(cssW);
  const logicalH = Math.floor(logicalW * 0.62); // wide-ish layout
  canvas.width = Math.floor(logicalW * pixelRatio);
  canvas.height = Math.floor(logicalH * pixelRatio);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);

  // create / size minimap located as separate offscreen canvas if needed
  if(!miniCanvas){
    miniCanvas = document.createElement('canvas');
    miniCanvas.id = 'miniMap';
    miniCanvas.style.position = 'absolute';
    miniCanvas.style.right = '18px';
    miniCanvas.style.top = '18px';
    miniCanvas.style.width = '140px';
    miniCanvas.style.height = '90px';
    miniCanvas.style.zIndex = 24;
    miniCanvas.style.borderRadius = '8px';
    miniCanvas.style.border = '1px solid rgba(255,255,255,0.06)';
    document.body.appendChild(miniCanvas);
    miniCtx = miniCanvas.getContext('2d');
  }
  const mmW = Math.min(220, Math.floor(cssW * 0.26));
  const mmH = Math.floor(mmW * 0.58);
  miniCanvas.width = mmW;
  miniCanvas.height = mmH;
  miniCanvas.style.width = mmW + 'px';
  miniCanvas.style.height = mmH + 'px';
  miniCtx.setTransform(1,0,0,1,0,0);

  const preferred = window.innerWidth < 720 ? 24 : 36;
  cols = Math.max(11, Math.floor(logicalW / preferred));
  rows = Math.max(11, Math.floor(logicalH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(logicalW / cols, logicalH / rows));
}
window.addEventListener('resize', ()=>{ setupCanvas(); cacheMaze(); });

/* =========================
   Maze generator (recursive backtracker)
   and caching to offscreen canvas for speed
   ========================= */
function generateMaze(c, r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x + dx, ny = y + dy;
      if(nx > 0 && nx < c - 1 && ny > 0 && ny < r - 1 && grid[ny][nx] === 1){
        grid[y + dy/2][x + dx/2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1,1);
  // safe area near start
  grid[1][1] = 0; if(grid[1][2] !== undefined) grid[1][2] = 0; if(grid[2]) grid[2][1] = 0;
  return grid;
}

function cacheMaze(){
  if(!maze || !maze[0]){ mazeCache = null; return; }
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');

  // textured walls: try to draw a stylish pattern using gradient + bevel
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const val = (maze[y] && typeof maze[y][x] !== 'undefined') ? maze[y][x] : 1;
      if(val === 1){
        // darker stone base
        const gx = mctx.createLinearGradient(x*tileSize, y*tileSize, x*tileSize + tileSize, y*tileSize + tileSize);
        gx.addColorStop(0, '#1c1c21');
        gx.addColorStop(0.5, '#25252b');
        gx.addColorStop(1, '#17171b');
        mctx.fillStyle = gx;
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);

        // inner bevel highlight
        mctx.fillStyle = 'rgba(255,255,255,0.02)';
        mctx.fillRect(x*tileSize + 1, y*tileSize + 1, tileSize - 2, tileSize - 2);

        // subtle crack/texture lines
        mctx.strokeStyle = 'rgba(0,0,0,0.15)';
        mctx.lineWidth = 0.8;
        mctx.beginPath();
        mctx.moveTo(x*tileSize + 4, y*tileSize + tileSize*0.25 + (x%3));
        mctx.lineTo(x*tileSize + tileSize - 4, y*tileSize + tileSize*0.75 - (y%3));
        mctx.stroke();
      } else {
        // floor tile gradient (gloss)
        const fg = mctx.createLinearGradient(x*tileSize, y*tileSize, x*tileSize, y*tileSize + tileSize);
        fg.addColorStop(0, '#07070a');
        fg.addColorStop(1, '#0b0b0d');
        mctx.fillStyle = fg;
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* =========================
   Place portal at farthest walkable tile
   ========================= */
function placePortal(){
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

/* =========================
   Powerups & particles
   ========================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let tries = 0;
  while(tries++ < 300){
    const x = randInt(1, cols - 2);
    const y = randInt(1, rows - 2);
    if(maze[y] === 0 && !(x === player.x && y === player.y) && !powerups.some(p=>p.x===x && p.y===y)){
      powerups.push({ x, y, type: POWER_TYPES[randInt(0, POWER_TYPES.length-1)], bob: Math.random()*Math.PI*2, spawned: Date.now() });
      break;
    }
  }
}

function applyPowerup(type){
  if(type === 'speed'){
    activePower = { type:'speed', until: Date.now() + 4500 };
  } else if(type === 'cloak'){
    activePower = { type:'cloak', until: Date.now() + 5000 };
  } else if(type === 'shock'){
    clones.forEach(c => { c.index = Math.max(0, (c.index || 0) - 28); });
    spawnParticles((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, '#bfe8ff', 20);
    if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); else synthOnce('spawn', 0.9);
  }
  if(SETTINGS.sfx && AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfxVolume); else synthOnce('pickup', 0.9);
  showToast(type.toUpperCase());
}

function spawnParticles(px,py,color,count=18){
  for(let i=0;i<count;i++){
    particles.push({
      x: px + (Math.random() - 0.5) * tileSize,
      y: py + (Math.random() - 0.5) * tileSize,
      vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
      life: 30 + Math.random()*40,
      color
    });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}

/* =========================
   Clone class — replays player's path
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
    if(this.type === 'fast'){
      this.index += 1 + (Math.random() < 0.45 ? 1 : 0);
    } else if(this.type === 'wraith'){
      if(Math.random() < 0.01 + Math.min(0.05, frameCount / 60000)){
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
    if(IMG.clones && SPR.clones.w){
      const tIndex = (this.type === 'wraith') ? 2 : (this.type === 'fast' ? 1 : 0);
      const sx = tIndex * SPR.clones.w;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clones, sx, 0, SPR.clones.w, SPR.clones.h, this.x * tileSize, this.y * tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize + 2, this.y*tileSize + 2, tileSize - 4, tileSize - 4);
    }
  }
}

/* =========================
   Input handling: keyboard + step logic
   ========================= */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

function initKeyboard(){
  document.addEventListener('keydown', (e)=>{
    if(!running && (e.key === 'Enter' || e.key === ' ')) return; // guard
    if(e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W'){ activeDirs.up = true; stepPlayer(); playStep(); }
    if(e.key === 'ArrowDown' || e.key === 's' || e.key === 'S'){ activeDirs.down = true; stepPlayer(); playStep(); }
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'){ activeDirs.left = true; stepPlayer(); playStep(); }
    if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'){ activeDirs.right = true; stepPlayer(); playStep(); }
    if(e.key === 'Escape'){ togglePause(); }
    if(e.key === ' ') { applyPowerup('shock'); }
  });
  document.addEventListener('keyup', (e)=>{
    if(e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') activeDirs.up = false;
    if(e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') activeDirs.down = false;
    if(e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') activeDirs.left = false;
    if(e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') activeDirs.right = false;
  });
}

function playStep(){
  if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
  else synthOnce('spawn', 0.7);
}

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (difficultyNumeric() - 1) * 8));
  if(now - lastStepTime < ms) return;
  lastStepTime = now;
  if(!running || paused) return;

  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--;
  else if(activeDirs.down) ny++;
  else if(activeDirs.left) nx--;
  else if(activeDirs.right) nx++;

  if(nx >= 0 && nx < cols && ny >= 0 && ny < rows && maze[ny] && maze[ny][nx] === 0){
    player.x = nx; player.y = ny;
    movesHistory.push({ x: nx, y: ny });
    // pickup powerups
    for(let i = powerups.length - 1; i >= 0; i--){
      const p = powerups[i];
      if(p.x === nx && p.y === ny){
        applyPowerup(p.type);
        powerups.splice(i, 1);
        break;
      }
    }
    // portal
    if(PORTAL && nx === PORTAL.x && ny === PORTAL.y){
      if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
      else synthOnce('portal', 0.9);
      transitionToNextLevel();
    }
  }
}

/* =========================
   Mobile joystick
   ========================= */
let joystickActive = false, joystickPointerId = null;
let joystickOrigin = { x:0, y:0 }, joystickPos = { x:0, y:0 };
const JOY_MAX = 44;

function initJoystick(){
  // create joystick UI if mobile
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if(!isTouch){
    // hide if exists
    const joyst = document.querySelector('#joystickContainer');
    if(joyst) joyst.classList.add('hidden');
    return;
  }
  const joyst = document.querySelector('#joystickContainer');
  const stick = document.querySelector('#joystick');
  if(!joyst || !stick) return;
  joyst.classList.remove('hidden');

  joyst.addEventListener('pointerdown', (ev)=>{
    joyst.setPointerCapture(ev.pointerId);
    joystickActive = true;
    joystickPointerId = ev.pointerId;
    const rect = joyst.getBoundingClientRect();
    joystickOrigin.x = rect.left + rect.width/2;
    joystickOrigin.y = rect.top + rect.height/2;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joyst.addEventListener('pointermove', (ev)=>{
    if(!joystickActive || ev.pointerId !== joystickPointerId) return;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joyst.addEventListener('pointerup', (ev)=>{
    if(ev.pointerId !== joystickPointerId) return;
    joystickActive = false; joystickPointerId = null;
    joystickPos = { x:0, y:0 }; stick.style.transform = `translate(0px,0px)`;
    activeDirs = { up:false, down:false, left:false, right:false };
  });
  joyst.addEventListener('pointercancel', ()=>{ joystickActive = false; joystickPointerId = null; joystickPos={x:0,y:0}; stick.style.transform = `translate(0px,0px)`; activeDirs={ up:false,down:false,left:false,right:false }; });
}

function updateJoystick(cx, cy){
  const stick = document.querySelector('#joystick');
  const dx = cx - joystickOrigin.x, dy = cy - joystickOrigin.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  const r = Math.min(dist, JOY_MAX) * SETTINGS.joystickSensitivity;
  joystickPos.x = nx * r; joystickPos.y = ny * r;
  if(stick) stick.style.transform = `translate(${joystickPos.x}px, ${joystickPos.y}px)`;
  activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
  activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
  stepPlayer();
}

/* =========================
   Clone spawn pacing
   ========================= */
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
  else synthOnce('spawn', 0.9);
  spawnParticles((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, '#ff4466', 20);
}

/* =========================
   Drawing — background, maze, items, sprites
   ========================= */
function drawBackground(now){
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.save();
  if(IMG.background){
    const t = Date.now()/12000;
    const xoff = Math.sin(t) * 36;
    ctx.drawImage(IMG.background, -40 + xoff, -20, w + 80, h + 40);
  } else {
    // gradient fallback
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, '#071018'); g.addColorStop(1, '#03040a');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }
  // layered parallax
  for(let i=0;i<IMG.bgLayers.length;i++){
    const layer = IMG.bgLayers[i];
    if(!layer) continue;
    const depth = (i+1) / (IMG.bgLayers.length + 1);
    const xoff = Math.sin(Date.now()/(7000*(1+depth))) * 12 * depth;
    ctx.globalAlpha = 0.75 - depth * 0.15;
    ctx.drawImage(layer, -20 + xoff, -10, w + 40, h + 20);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // vignette overlay for mood
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0,0,w,h);
}

function drawMaze(){
  if(!maze) return;
  if(mazeCache){ ctx.drawImage(mazeCache, 0, 0); return; }
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const v = maze[y] && typeof maze[y][x] !== 'undefined' ? maze[y][x] : 1;
      if(v === 1){
        ctx.fillStyle = '#2a2a36';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        ctx.fillStyle = '#07070a';
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
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320);
    // keep portal size slightly larger than tile
    ctx.drawImage(IMG.portal, -tileSize*scale/1.2, -tileSize*scale/1.2, tileSize*scale*1.4, tileSize*scale*1.4);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot/1.8);
    ctx.fillStyle = '#66ffcc'; ctx.beginPath(); ctx.ellipse(0,0,tileSize*0.42,tileSize*0.46,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawMinimap(){
  if(!miniCtx || !maze) return;
  const mmW = miniCanvas.width, mmH = miniCanvas.height;
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

function drawPlayer(now){
  if(!player) return;
  if(IMG.ninja && SPR.ninja.w){
    const animCol = Math.floor((frameCount / 6) % SPR.ninja.cols);
    const sx = animCol * SPR.ninja.w;
    const sy = 0;
    // scale sprite to tile size (keep aspect)
    ctx.drawImage(IMG.ninja, sx, sy, SPR.ninja.w, SPR.ninja.h, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
    ctx.save(); ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* =========================
   HUD & toast helpers
   ========================= */
function showToast(text, ttl=1400){
  const container = document.querySelector('#notifArea') || (() => {
    const d = document.createElement('div'); d.id = 'notifArea'; d.style.position='fixed'; d.style.right='18px'; d.style.bottom='18px'; d.style.zIndex = 100; document.body.appendChild(d); return d;
  })();
  const el = document.createElement('div'); el.className = 'notif'; el.style.background = 'rgba(0,0,0,0.6)'; el.style.padding = '10px'; el.style.borderRadius='8px'; el.style.marginTop='6px'; el.style.boxShadow='0 8px 30px rgba(0,0,0,0.5)'; el.textContent = text; container.appendChild(el);
  setTimeout(()=>{ el.style.transition = 'opacity .45s, transform .45s'; el.style.opacity = '0'; el.style.transform = 'translateY(-18px)'; setTimeout(()=>el.remove(),480); }, ttl);
}
function updateHUD(){
  const timerEl = document.querySelector('#timer');
  if(timerEl) timerEl.textContent = `Time: ${nowSec()}s`;
  const powerBox = document.querySelector('#powerupBox');
  if(powerBox){
    if(activePower && Date.now() < activePower.until){
      const rem = Math.ceil((activePower.until - Date.now())/1000);
      powerBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
    } else {
      powerBox.innerHTML = '';
      if(activePower && Date.now() >= activePower.until) activePower = null;
    }
  }
}

/* =========================
   Main animation loop
   ========================= */
let lastFrame = performance.now();
function animate(now){
  if(!running || paused) return;
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  frameCount++;

  // occasional powerups spawning
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneIntervalFrames / (1 + difficultyNumeric()*0.3)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneIntervalFrames > 30) cloneIntervalFrames = Math.max(30, cloneIntervalFrames - 1 - (difficultyNumeric() - 1));
    if(Math.random() < 0.02 + (difficultyNumeric() - 1) * 0.03) spawnClone();
  }

  // update clones and collision
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i];
    c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)){
        // death sequence
        running = false;
        if(SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVolume);
        else synthOnce('death', 1.0);
        showToast('☠️ You Died');
        spawnParticles((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, '#ffcc66', 40);
        setTimeout(()=>{ onGameOver(); }, 800);
        return;
      }
    }
  }

  updateParticles();

  // clear frame
  ctx.clearRect(0,0,canvas.width/pixelRatio, canvas.height/pixelRatio);

  // render pipeline
  drawBackground(now);
  drawMaze();
  drawPowerups(now);
  drawPortal(now);
  for(const c of clones) c.draw();

  // smooth player interpolation
  const speed = 12 + (difficultyNumeric()-1) * 6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail effect
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i];
    const alpha = (i - Math.max(0, movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha * 0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  drawPlayer(now);
  // particles
  for(const p of particles){ ctx.globalAlpha = Math.max(0, p.life/70); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1;

  drawMinimap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* =========================
   Difficulty mapping
   ========================= */
function difficultyNumeric(){
  switch(SETTINGS.difficulty){
    case 'easy': return 0.8;
    case 'normal': return 1.0;
    case 'hard': return 1.5;
    case 'nightmare': return 2.2;
    default: return 1.0;
  }
}

/* =========================
   Level start / reset / next / gameover
   ========================= */
function startLevel(index = 0){
  currentLevelIndex = clamp(index, 0, LEVELS.length - 1);
  const L = LEVELS[currentLevelIndex];
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
  cloneIntervalFrames = Math.max(40, 300 - Math.floor(difficultyNumeric()*80));
  running = true; paused = false; startTime = Date.now(); activePower = null;
  placePortal();
  if(preloader) preloader.classList.add('hidden');
  showToast(`Level: ${L.name}`, 1200);
  lastFrame = performance.now();
  requestAnimationFrame(animate);
  tickLoop();
}

/* geometry dash-like transition */
function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
  else synthOnce('portal', 0.9);
  let t = 0; const dur = 36;
  function anim(){
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI*(t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, -(s-1)*cx, -(s-1)*cy);
    drawBackground(performance.now()); drawMaze(); drawPortal(performance.now());
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t <= dur) requestAnimationFrame(anim);
    else {
      startLevel(Math.min(LEVELS.length - 1, currentLevelIndex + 1));
      showToast(`Level Up: ${LEVELS[currentLevelIndex].name}`);
    }
  }
  anim();
}

/* called when the player dies */
function onGameOver(){
  running = false;
  const elapsed = nowSec();
  const prevBest = Number(localStorage.getItem(STORAGE_KEYS.BEST)) || 0;
  if(elapsed > prevBest){
    localStorage.setItem(STORAGE_KEYS.BEST, elapsed);
    showToast('NEW RECORD!');
    addToLeaderboard(elapsed);
  }
  // show game over UI if you had one (index.html minimal didn't include), fallback: alert
  setTimeout(()=>{ alert(`Game Over — You survived ${elapsed}s`); }, 200);
}

/* =========================
   Tick loop for held keys
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
   Safe audio playing wrapper
   ========================= */
function safePlay(a, vol=1){
  if(!a) return;
  try{ a.volume = vol; a.currentTime = 0; a.play().catch(()=>{}); }catch(e){}
}

/* =========================
   Leaderboard (local)
   ========================= */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADER) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):', 'Player') || 'Player';
  name = name.slice(0,12);
  list.push({ name, time });
  list.sort((a,b)=> b.time - a.time);
  localStorage.setItem(STORAGE_KEYS.LEADER, JSON.stringify(list.slice(0,50)));
  updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADER) || '[]');
  const ol = document.querySelector('#leaderboard-list') || document.querySelector('#leaderboardList');
  if(!ol) return;
  ol.innerHTML = '';
  list.slice(0,10).forEach(it=>{
    const li = document.createElement('li');
    li.textContent = `${it.name} — ${it.time}s`;
    ol.appendChild(li);
  });
}

/* =========================
   UI Wiring (menus & buttons)
   ========================= */
function wireUI(){
  // Start button
  if(startBtn){
    startBtn.addEventListener('click', async ()=>{
      // load assets (show preloader)
      await preloadAll(true);
      // apply music preference
      if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
      // hide main menu, show canvas
      if(mainMenu) mainMenu.classList.add('hidden');
      if(canvas) canvas.classList.remove('hidden');
      initKeyboard();
      initJoystick();
      updateLeaderboardUI();
      startLevel(0);
    });
  }

  // Settings button
  if(settingsBtn){
    settingsBtn.addEventListener('click', ()=>{
      if(settingsMenu) { settingsMenu.classList.remove('hidden'); if(mainMenu) mainMenu.classList.add('hidden'); }
    });
  }
  // Tutorial
  if(tutorialBtn){
    tutorialBtn.addEventListener('click', ()=>{
      if(tutorialMenu) { tutorialMenu.classList.remove('hidden'); if(mainMenu) mainMenu.classList.add('hidden'); }
    });
  }
  // Leaderboard
  if(leaderboardBtn){
    leaderboardBtn.addEventListener('click', ()=>{
      if(leaderboardMenu){ leaderboardMenu.classList.remove('hidden'); if(mainMenu) mainMenu.classList.add('hidden'); updateLeaderboardUI(); }
    });
  }
  // Back buttons
  backButtons.forEach(b=>{
    b.addEventListener('click', ()=>{
      // close all menus, open main menu
      if(settingsMenu) settingsMenu.classList.add('hidden');
      if(tutorialMenu) tutorialMenu.classList.add('hidden');
      if(leaderboardMenu) leaderboardMenu.classList.add('hidden');
      if(mainMenu) mainMenu.classList.remove('hidden');
    });
  });

  // Also support pressing Escape to return to menu
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      // if in a submenu -> go back
      if(settingsMenu && !settingsMenu.classList.contains('hidden')){ settingsMenu.classList.add('hidden'); mainMenu && mainMenu.classList.remove('hidden'); }
      else if(tutorialMenu && !tutorialMenu.classList.contains('hidden')){ tutorialMenu.classList.add('hidden'); mainMenu && mainMenu.classList.remove('hidden'); }
      else if(leaderboardMenu && !leaderboardMenu.classList.contains('hidden')){ leaderboardMenu.classList.add('hidden'); mainMenu && mainMenu.classList.remove('hidden'); }
    }
  });

  // Settings apply UI (if present)
  const musicToggle = document.querySelector('#musicToggle');
  const sfxToggle = document.querySelector('#sfxToggle');
  const musicVolume = document.querySelector('#musicVolume') || document.querySelector('#volume-control');
  const sfxVolume = document.querySelector('#sfxVolume');
  const difficultySelect = document.querySelector('#difficulty') || document.querySelector('#graphics-quality');

  if(musicVolume){
    musicVolume.addEventListener('input', (e)=>{ SETTINGS.musicVolume = Number(e.target.value); if(AUDIO.bg) AUDIO.bg.volume = SETTINGS.musicVolume; saveSettings(); });
  }
  if(sfxVolume){
    sfxVolume.addEventListener('input', (e)=>{ SETTINGS.sfxVolume = Number(e.target.value); saveSettings(); });
  }
  if(musicToggle){
    musicToggle.addEventListener('change', (e)=>{ SETTINGS.music = !!e.target.checked; saveSettings(); if(!SETTINGS.music && AUDIO.bg) AUDIO.bg.pause(); });
  }
  if(sfxToggle){
    sfxToggle.addEventListener('change', (e)=>{ SETTINGS.sfx = !!e.target.checked; saveSettings(); });
  }
  if(difficultySelect){
    difficultySelect.addEventListener('change', (e)=>{ SETTINGS.difficulty = e.target.value; saveSettings(); });
  }
}

/* =========================
   Save settings
   ========================= */
function saveSettings(){
  try{ localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SETTINGS)); }catch(e){ console.warn('settings save failed', e); }
}

/* =========================
   Small helpers & boot
   ========================= */
function difficultyNumeric(){ switch(SETTINGS.difficulty){ case 'easy': return 0.8; case 'normal': return 1; case 'hard': return 1.5; case 'nightmare': return 2.2; default: return 1; } }

function togglePause(){
  paused = !paused;
  if(paused){ running = false; if(AUDIO.bg) AUDIO.bg.pause(); showToast('Paused'); }
  else { running = true; lastFrame = performance.now(); requestAnimationFrame(animate); tickLoop(); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume); showToast('Resumed'); }
}

/* expose safe functions for debugging */
window.SCE = {
  startLevel, spawnPowerup, spawnClone,
  setSettings: (s)=>{ SETTINGS = {...SETTINGS, ...s}; saveSettings(); },
  IMG, AUDIO, SPR
};

/* =========================
   Boot sequence
   ========================= */
async function boot(){
  setupCanvas();
  wireUI();
  // populate settings UI defaults if present
  const mv = document.querySelector('#musicVolume') || document.querySelector('#volume-control');
  if(mv) mv.value = SETTINGS.musicVolume;
  const sv = document.querySelector('#sfxVolume');
  if(sv) sv.value = SETTINGS.sfxVolume;
  const d = document.querySelector('#difficulty') || document.querySelector('#graphics-quality');
  if(d) d.value = SETTINGS.difficulty;
  try{
    await preloadAll(false);
    console.log('Prefetch complete — assets:', {IMG, AUDIO, SPR});
  }catch(e){
    console.warn('Prefetch failed', e);
  }
  // friendly start screen message if canvas visible
  if(ctx){
    ctx.clearRect(0,0,canvas.width/pixelRatio, canvas.height/pixelRatio);
    ctx.fillStyle = '#fff';
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText('Shadow Clone Escape — Click START', 22, 40);
  }
  // init joystick container if present
  initJoystick();
  // cache initial maze only when level starts
  console.log('Boot complete — ready.');
}
boot();

/* =========================
   End of file
   ========================= */
