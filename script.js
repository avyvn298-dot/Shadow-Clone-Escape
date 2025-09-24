/* script.js — Shadow Clone Escape (AAA Polished, Levels)
   Put this file in repo root. Place assets in assets/ as listed or edit ASSET paths below.
   Features:
     - Robust asset loader + progress UI
     - Sprite frame math (no bleed)
     - Levels with progressive difficulty & sizes
     - Portal transition (Geometry Dash-like)
     - Clones: basic, fast, wraith (distinct sprites)
     - Powerups: speed, cloak, shock
     - Particles, parallax background
     - Mobile controls, remappable hooks
     - Settings persistence and local leaderboard
*/

/* ========================= ASSET PATHS ========================= */
const ASSET = {
  ninja: "assets/ninja_spritesheet.png",
  clone: "assets/clones_spritesheet.png",
  portal: "assets/portal.png",
  bgLayers: [ "assets/bg_layer1.png", "assets/bg_layer2.png", "assets/bg_layer3.png" ], // optional
  backgroundSingle: "background.png",
  bgMusic: "assets/bg_music_loop.wav",
  spawn: "assets/spawn.wav",
  powerup: "assets/powerup.wav",
  portalSfx: "assets/portal.wav",
  death: "assets/death.wav"
};

/* ========================= DOM & CANVAS ========================= */
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas?.getContext('2d');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const continueBtn = document.getElementById('continueBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
const settingsBtn = document.getElementById('settingsBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const btnPower = document.getElementById('btnPower');

const titleOverlay = document.getElementById('titleOverlay');
const tutorialModal = document.getElementById('tutorial');
const settingsModal = document.getElementById('settings');

const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const powerupBox = document.getElementById('powerupBox');
const timerText = document.getElementById('timer');
const statusText = document.getElementById('status');
const bestRecordText = document.getElementById('bestRecordText');

const musicToggleEl = document.getElementById('musicToggle');
const sfxToggleEl = document.getElementById('sfxToggle');
const musicVolumeEl = document.getElementById('musicVolume');
const sfxVolumeEl = document.getElementById('sfxVolume');
const difficultyEl = document.getElementById('difficulty');

const miniMapCanvas = document.createElement('canvas');
miniMapCanvas.width = 280;
miniMapCanvas.height = 160;
const miniCtx = miniMapCanvas.getContext('2d');

/* Quick UI elements (side-panel quick toggles) */
const musicToggleQuick = document.getElementById('musicToggleQuick');
const sfxToggleQuick = document.getElementById('sfxToggleQuick');
const difficultyQuick = document.getElementById('difficultyQuick');
const leaderboardList = document.getElementById('leaderboardList');
const clearLeaderboardBtn = document.getElementById('clearLeaderboard');

/* Mobile */
const mobileControls = document.getElementById('mobileControls');
const dpad = document.getElementById('dpad');

/* ========================= STORAGE KEYS ========================= */
const STORAGE = { settings: 'shadow_clone_settings_v1', best: 'shadow_clone_best_v1', leader: 'shadow_clone_leader_v1' };

/* ========================= DEFAULT SETTINGS ========================= */
let SETTINGS = {
  music: true,
  sfx: true,
  musicVolume: 0.45,
  sfxVolume: 1.0,
  difficulty: 1,
  controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shock: ' ' }
};
try {
  const s = JSON.parse(localStorage.getItem(STORAGE.settings));
  if (s) SETTINGS = {...SETTINGS, ...s};
} catch(e){}

/* ========================= STATE & GRID ========================= */
let cols = 19, rows = 19, tileSize = 30;
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
let cloneInterval = 300;
let activePower = null;
let PORTAL = null;
let currentLevelIndex = 0;

/* ========================= LEVELS CONFIG ========================= */
const LEVELS = [
  // Each level: size multiplier and spawn tempo
  { name: "Novice Shadow", sizeMultiplier: 1.0, cloneSpeedFactor: 1.0, powerupRate: 0.02 },
  { name: "Wandering Echo", sizeMultiplier: 1.15, cloneSpeedFactor: 1.12, powerupRate: 0.018 },
  { name: "Night Stalker", sizeMultiplier: 1.3, cloneSpeedFactor: 1.25, powerupRate: 0.015 },
  { name: "Spectral Onslaught", sizeMultiplier: 1.45, cloneSpeedFactor: 1.45, powerupRate: 0.012 },
  { name: "Ninja's Dread", sizeMultiplier: 1.6, cloneSpeedFactor: 1.7, powerupRate: 0.01 },
  { name: "Endless", sizeMultiplier: 1.9, cloneSpeedFactor: 2.0, powerupRate: 0.008 }
];

/* ========================= ASSET HOLDERS ========================= */
const IMG = { ninja: null, clone: null, portal: null, bgLayers: [], backgroundSingle: null };
const SFX = { bg: null, spawn: null, powerup: null, portal: null, death: null };

/* sprite frame info (will compute after loading) */
const SPRITE = {
  ninja: { cols: 4, rows: 1, frameW: 384, frameH: 534 },
  clone: { cols: 3, rows: 1, frameW: 353, frameH: 433 },
  portal: { cols: 1, rows: 1, frameW: 361, frameH: 316 }
};

/* ========================= UTILS ========================= */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now() - startTime)/1000); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function safePlay(audio, vol=1){ if(!audio) return; try{ audio.volume = vol; audio.currentTime = 0; audio.play().catch(()=>{}); }catch(e){} }

/* ========================= LOADER ========================= */
async function loadImage(url){ return new Promise(res => { const i=new Image(); i.onload = ()=>res(i); i.onerror = ()=>res(null); i.src = url; }); }
async function loadAudio(url){ return new Promise(res => { try{ const a=new Audio(); a.addEventListener('canplaythrough', ()=>res(a), {once:true}); a.addEventListener('error', ()=>res(null), {once:true}); a.src = url; }catch(e){ res(null); } }); }

async function preloadAll(withProgress=true){
  // list tasks
  const tasks = [
    {type:'img', key:'ninja', path: ASSET.ninja},
    {type:'img', key:'clone', path: ASSET.clone},
    {type:'img', key:'portal', path: ASSET.portal},
    {type:'img', key:'backgroundSingle', path: ASSET.backgroundSingle},
    // optional layers
    {type:'img', key:'bg1', path: ASSET.bgLayers[0]},
    {type:'img', key:'bg2', path: ASSET.bgLayers[1]},
    {type:'img', key:'bg3', path: ASSET.bgLayers[2]},
    {type:'audio', key:'bg', path: ASSET.bgMusic},
    {type:'audio', key:'spawn', path: ASSET.spawn},
    {type:'audio', key:'powerup', path: ASSET.powerup},
    {type:'audio', key:'portal', path: ASSET.portalSfx},
    {type:'audio', key:'death', path: ASSET.death}
  ];

  let completed = 0;
  const total = tasks.filter(t=>t.path).length;

  function setProgress(pct, text){
    if(!withProgress) return;
    if(progressFill) progressFill.style.width = pct + '%';
    if(progressText) progressText.textContent = text || `Loading ${pct}%`;
  }

  for(const t of tasks){
    if(!t.path) { continue; }
    if(t.type === 'img'){
      const img = await loadImage(t.path);
      if(img){
        if(t.key === 'ninja') IMG.ninja = img;
        else if(t.key === 'clone') IMG.clone = img;
        else if(t.key === 'portal') IMG.portal = img;
        else if(t.key === 'backgroundSingle') IMG.backgroundSingle = img;
        else if(t.key === 'bg1') IMG.bgLayers[0] = img;
        else if(t.key === 'bg2') IMG.bgLayers[1] = img;
        else if(t.key === 'bg3') IMG.bgLayers[2] = img;
        console.log("Loaded image:", t.path);
      } else {
        console.warn("Missing image:", t.path);
      }
    } else {
      const audio = await loadAudio(t.path);
      if(audio){
        if(t.key === 'bg') SFX.bg = audio;
        else if(t.key === 'spawn') SFX.spawn = audio;
        else if(t.key === 'powerup') SFX.powerup = audio;
        else if(t.key === 'portal') SFX.portal = audio;
        else if(t.key === 'death') SFX.death = audio;
        console.log("Loaded audio:", t.path);
      } else {
        console.warn("Missing audio:", t.path);
      }
    }
    completed++;
    const pct = Math.round((completed/total)*100);
    setProgress(pct, `Loading assets… ${pct}%`);
    await new Promise(r=>setTimeout(r, 60)); // small UX pacing
  }

  // configure volumes
  if(SFX.bg){ SFX.bg.loop = true; SFX.bg.volume = SETTINGS.musicVolume; }
  if(SFX.spawn) SFX.spawn.volume = SETTINGS.sfxVolume;
  if(SFX.powerup) SFX.powerup.volume = SETTINGS.sfxVolume;
  if(SFX.death) SFX.death.volume = SETTINGS.sfxVolume;

  // compute integer sprite frames
  initSpriteFrames();
}

/* Compute integer frame widths to prevent sampling between frames */
function initSpriteFrames(){
  if(IMG.ninja){ SPRITE.ninja.frameW = Math.floor(IMG.ninja.naturalWidth / SPRITE.ninja.cols); SPRITE.ninja.frameH = Math.floor(IMG.ninja.naturalHeight / SPRITE.ninja.rows); }
  if(IMG.clone){ SPRITE.clone.frameW = Math.floor(IMG.clone.naturalWidth / SPRITE.clone.cols); SPRITE.clone.frameH = Math.floor(IMG.clone.naturalHeight / SPRITE.clone.rows); }
  if(IMG.portal){ SPRITE.portal.frameW = Math.floor(IMG.portal.naturalWidth / SPRITE.portal.cols); SPRITE.portal.frameH = Math.floor(IMG.portal.naturalHeight / SPRITE.portal.rows); }
}

/* ========================= CANVAS SIZE & GRID ========================= */
function resizeCanvas(){
  const maxW = Math.min(window.innerWidth - 40, 1200);
  const width = Math.min(maxW, 1100);
  canvas.style.width = width + "px";
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * 0.62);
  canvas.width = Math.floor(logicalW * ratio);
  canvas.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);

  const cssW = canvas.clientWidth || logicalW;
  const cssH = canvas.clientHeight || logicalH;
  const preferred = window.innerWidth < 720 ? 26 : 36;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(cssH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, cssH / rows));
}
window.addEventListener('resize', resizeCanvas);

/* ========================= MAZE GENERATOR (recursive backtracker) ========================= */
function generateMaze(c, r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x+dx, ny = y+dy;
      if(nx>0 && nx<c-1 && ny>0 && ny<r-1 && grid[ny][nx]===1){
        grid[y+dy/2][x+dx/2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1,1);
  grid[1][1] = 0; if(grid[1][2]!==undefined) grid[1][2] = 0; if(grid[2]) grid[2][1] = 0;
  return grid;
}

/* Cache maze to offscreen canvas for faster drawing */
function cacheMaze(){
  if(!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  mctx.fillStyle = '#070707'; mctx.fillRect(0,0,mazeCache.width, mazeCache.height);
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
        mctx.fillStyle = '#222'; mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        mctx.fillStyle = 'rgba(0,0,0,0.06)'; mctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        mctx.fillStyle = '#0b0b0b'; mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* ========================= PORTAL (farthest point) ========================= */
function spawnPortal(){
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

/* ========================= RESET & START LEVEL ========================= */
function startLevel(index){
  currentLevelIndex = clamp(index, 0, LEVELS.length-1);
  const level = LEVELS[currentLevelIndex];
  // scale grid by level multiplier (approx)
  resizeCanvas();
  const baseCols = 19, baseRows = 19;
  cols = Math.max(11, Math.floor(baseCols * level.sizeMultiplier));
  rows = Math.max(11, Math.floor(baseRows * level.sizeMultiplier));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color: '#66ff99' };
  movesHistory = []; clones = []; powerups = []; particles = [];
  frameCount = 0;
  cloneInterval = Math.max(40, 300 - (SETTINGS.difficulty-1)*80);
  running = true; paused = false; startTime = Date.now(); activePower = null;
  spawnPortal();
  updateHUD();
  restartBtn && (restartBtn.style.display = 'none');
  if(bestRecordText) bestRecordText.textContent = (Number(localStorage.getItem(STORAGE.best))||0) ? `Best: ${Number(localStorage.getItem(STORAGE.best))}s` : 'Best: —';
}

/* ========================= POWERUPS ========================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let attempts = 0;
  while(attempts++ < 300){
    const x = randInt(1, cols-2), y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x && p.y===y)){
      powerups.push({ x,y, type: POWER_TYPES[randInt(0,POWER_TYPES.length-1)], spawned: Date.now(), bob: Math.random()*Math.PI*2 });
      return;
    }
  }
}
function applyPowerup(type){
  if(type === 'speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type === 'cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type === 'shock') clones.forEach(c=> c.index = Math.max(0, (c.index||0) - 28));
  if(SETTINGS.sfx && SFX.powerup) safePlay(SFX.powerup, SETTINGS.sfxVolume);
  showNotif(`${type.toUpperCase()}!`);
}

/* ========================= PARTICLES ========================= */
function spawnParticles(px,py,color,count=18){
  for(let i=0;i<count;i++){
    particles.push({
      x: px + (Math.random()-0.5)*tileSize,
      y: py + (Math.random()-0.5)*tileSize,
      vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 24 + Math.random()*36, color
    });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--;
    p.vx *= 0.995; p.vy *= 0.995;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life / 60);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/* ========================= CLONE CLASS ========================= */
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
    } else this.index++;
    if(this.index < this.path.length){
      this.x = this.path[this.index].x;
      this.y = this.path[this.index].y;
    }
  }
  draw(){
    if(IMG.clone){
      const typeIndex = this.type === 'wraith' ? 2 : (this.type === 'fast' ? 1 : 0);
      const sx = typeIndex * SPRITE.clone.frameW;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clone, sx, 0, SPRITE.clone.frameW, SPRITE.clone.frameH, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
    }
  }
}

/* ========================= INPUT & MOVEMENT ========================= */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', (e)=>{
  if(e.key === SETTINGS.controls.up) activeDirs.up = true, stepPlayer(), playFootstep();
  if(e.key === SETTINGS.controls.down) activeDirs.down = true, stepPlayer();
  if(e.key === SETTINGS.controls.left) activeDirs.left = true, stepPlayer();
  if(e.key === SETTINGS.controls.right) activeDirs.right = true, stepPlayer();
  if(e.key === SETTINGS.controls.shock) applyPowerup('shock');
  if(e.key === 'Escape') togglePause();
});
document.addEventListener('keyup', (e)=>{
  if(e.key === SETTINGS.controls.up) activeDirs.up = false;
  if(e.key === SETTINGS.controls.down) activeDirs.down = false;
  if(e.key === SETTINGS.controls.left) activeDirs.left = false;
  if(e.key === SETTINGS.controls.right) activeDirs.right = false;
});

function playFootstep(){ if(SETTINGS.sfx && SFX.spawn) safePlay(SFX.spawn, SETTINGS.sfxVolume); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (SETTINGS.difficulty-1)*12));
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
    movesHistory.push({x:nx,y:ny});
    // pickup
    for(let i=powerups.length-1;i>=0;i--){
      if(powerups[i].x===nx && powerups[i].y===ny){
        applyPowerup(powerups[i].type);
        powerups.splice(i,1);
        break;
      }
    }
    // reached portal?
    if(PORTAL && nx === PORTAL.x && ny === PORTAL.y){
      // trigger transition
      if(SETTINGS.sfx && SFX.portal) safePlay(SFX.portal, SETTINGS.sfxVolume);
      transitionToNextLevel();
    }
  }
}

/* Mobile dpad */
dpad?.addEventListener('pointerdown', (ev)=>{
  const btn = ev.target.closest('button[data-dir]');
  if(btn){ const dir = btn.dataset.dir; pressDir(dir); btn.setPointerCapture(ev.pointerId); playFootstep(); }
});
dpad?.addEventListener('pointerup', (ev)=>{
  const btn = ev.target.closest('button[data-dir]');
  if(btn) releaseDir(btn.dataset.dir);
});
function pressDir(dir){ if(dir==='up') activeDirs.up=true; if(dir==='down') activeDirs.down=true; if(dir==='left') activeDirs.left=true; if(dir==='right') activeDirs.right=true; stepPlayer(); }
function releaseDir(dir){ if(dir==='up') activeDirs.up=false; if(dir==='down') activeDirs.down=false; if(dir==='left') activeDirs.left=false; if(dir==='right') activeDirs.right=false; }
btnPower?.addEventListener('click', ()=> applyPowerup('shock'));

/* ========================= SPAWN CLONES (from movesHistory snapshot) ========================= */
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
  if(SETTINGS.sfx && SFX.spawn) safePlay(SFX.spawn, SETTINGS.sfxVolume);
  spawnParticles((c.x||player.x)*tileSize + tileSize/2, (c.y||player.y)*tileSize + tileSize/2, '#ff4466');
}

/* ========================= DRAW HELPERS ========================= */
function drawBackground(now){
  ctx.save();
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  if(IMG.backgroundSingle){
    // parallax scale
    ctx.globalAlpha = 1;
    ctx.drawImage(IMG.backgroundSingle, 0, 0, IMG.backgroundSingle.naturalWidth, IMG.backgroundSingle.naturalHeight, -40, -20, w+80, h+40);
  } else {
    // nice gradient fallback
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#061017'); g.addColorStop(1, '#020406');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }
  ctx.restore();
}

function drawMaze(){
  if(mazeCache) ctx.drawImage(mazeCache, 0, 0);
  else {
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        ctx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

function drawPowerups(){
  for(const pu of powerups){
    const bob = Math.sin((frameCount + pu.bob*60)/18) * 3;
    const px = pu.x*tileSize + tileSize/2, py = pu.y*tileSize + tileSize/2 + bob;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(frameCount/18 + pu.bob)*0.08);
    if(pu.type==='speed'){ ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,tileSize*0.22,0,Math.PI*2); ctx.fill(); }
    else if(pu.type==='cloak'){ ctx.fillStyle = '#9be7b0'; ctx.fillRect(-tileSize*0.2,-tileSize*0.2,tileSize*0.4,tileSize*0.4); }
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
    ctx.save();
    ctx.translate(px, py); ctx.rotate(rot);
    ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320);
    ctx.drawImage(IMG.portal, -tileSize*scale/2, -tileSize*scale/2, tileSize*scale, tileSize*scale);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot/1.6);
    ctx.fillStyle = '#66ffcc'; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.ellipse(0,0, tileSize*0.42, tileSize*0.5, 0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawMiniMap(){
  if(!miniCtx) return;
  const mmW = miniMapCanvas.width, mmH = miniMapCanvas.height;
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
    miniCtx.fillStyle = pu.type==='speed' ? '#ffd86b' : pu.type==='cloak' ? '#7af' : '#9be7b0';
    miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
  }
}

/* ========================= HUD & NOTIFS ========================= */
function updateHUD(){
  if(timerText) timerText.textContent = `Time: ${nowSec()}s`;
  if(activePower && Date.now() < activePower.until){
    const rem = Math.ceil((activePower.until - Date.now())/1000);
    if(powerupBox) powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
  } else {
    if(powerupBox) powerupBox.innerHTML = '';
    if(activePower && Date.now() >= activePower.until) activePower = null;
  }
}

function showNotif(text){
  const notifArea = document.getElementById('notifArea');
  if(!notifArea) return;
  const el = document.createElement('div'); el.className = 'notif'; el.textContent = text; notifArea.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); },1600);
}

/* ========================= ANIMATE LOOP ========================= */
let lastFrameTime = performance.now();
function animate(now){
  if(!running || paused) return;
  const dt = (now - lastFrameTime) / 1000; lastFrameTime = now; frameCount++;

  // spawn powerups occasionally based on level
  if(frameCount % Math.max(400, Math.floor(900 / (1 + (SETTINGS.difficulty-1)*0.4))) === 0){
    if(Math.random() < (LEVELS[currentLevelIndex].powerupRate || 0.02)) spawnPowerup();
  }

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + (SETTINGS.difficulty-1)*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(Math.random() < 0.02 + (SETTINGS.difficulty-1)*0.03) spawnClone();
    if(cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - (SETTINGS.difficulty-1));
  }

  // update clones and collisions
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i]; c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)){
        // player died
        running = false;
        if(SETTINGS.sfx && SFX.death) safePlay(SFX.death, SETTINGS.sfxVolume);
        showNotif("☠️ You Died");
        if(restartBtn) restartBtn.style.display = 'inline-block';
        const elapsed = nowSec();
        const prev = Number(localStorage.getItem(STORAGE.best)) || 0;
        if(elapsed > prev){
          localStorage.setItem(STORAGE.best, elapsed);
          showNotif("NEW RECORD!");
          addToLeaderboard(elapsed);
        }
        // create explosion particles
        spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66', 30);
        setTimeout(()=>{ startLevel(Math.max(0, currentLevelIndex)); }, 1000);
        return;
      }
    }
  }

  updateParticles();

  // render pipeline
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground(now);
  drawMaze();
  drawPowerups();
  drawPortal(now);
  for(const c of clones) c.draw();

  // player smoothing
  const speed = 12 + (SETTINGS.difficulty - 1) * 6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i]; const alpha = (i - Math.max(0,movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha*0.25; ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // draw player sprite (frame-correct)
  if(IMG.ninja){
    try {
      const animCol = Math.floor((frameCount/6) % SPRITE.ninja.cols);
      const sx = animCol * SPRITE.ninja.frameW;
      const sy = 0;
      ctx.drawImage(IMG.ninja, sx, sy, SPRITE.ninja.frameW, SPRITE.ninja.frameH, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
    } catch(e){
      ctx.drawImage(IMG.ninja, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
    }
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    ctx.save(); const pulse = 0.9 + Math.sin(Date.now()/420)*0.08; ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)';
    ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }

  drawParticles();
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* ========================= TRANSITION TO NEXT LEVEL (GeometryDash-like) ========================= */
function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && SFX.portal) safePlay(SFX.portal, SETTINGS.sfxVolume);
  let t = 0, dur = 36;
  const fromIndex = currentLevelIndex;
  function step(){
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI*(t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, - (s-1)*cx, - (s-1)*cy);
    drawBackground(performance.now());
    drawMaze();
    drawPortal(performance.now());
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t<=dur) requestAnimationFrame(step);
    else {
      // next level
      startLevel(Math.min(LEVELS.length-1, currentLevelIndex + 1));
      running = true; lastFrameTime = performance.now(); requestAnimationFrame(animate);
      showNotif(`Level Up: ${LEVELS[currentLevelIndex].name}`);
    }
  }
  step();
}

/* ========================= TICK LOOP (hold keys) ========================= */
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

/* ========================= LEADERBOARD ========================= */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(STORAGE.leader) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):','Player') || 'Player';
  name = name.slice(0,12);
  list.push({name, time});
  list.sort((a,b)=> b.time - a.time);
  localStorage.setItem(STORAGE.leader, JSON.stringify(list.slice(0,50)));
  updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem(STORAGE.leader) || '[]');
  if(!leaderboardList) return;
  leaderboardList.innerHTML = '';
  list.slice(0,10).forEach(it=>{
    const li = document.createElement('li');
    li.textContent = `${it.name} — ${it.time}s`;
    leaderboardList.appendChild(li);
  });
}

/* ========================= UI BINDINGS ========================= */
function wireUI(){
  // Title overlay buttons
  startBtn?.addEventListener('click', async ()=>{
    // Preload assets with progress then start first level
    await preloadAll(true);
    if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume);
    hideOverlay();
    startLevel(0);
    lastFrameTime = performance.now();
    running = true;
    requestAnimationFrame(animate);
    tickLoop();
  });
  continueBtn?.addEventListener('click', ()=> { hideOverlay(); if(!player) startLevel(0); else { running = true; lastFrameTime = performance.now(); requestAnimationFrame(animate); tickLoop(); } });
  tutorialBtn?.addEventListener('click', ()=> { if(tutorialModal) tutorialModal.classList.remove('panel-hidden'); });
  document.getElementById('closeTutorial')?.addEventListener('click', ()=> { if(tutorialModal) tutorialModal.classList.add('panel-hidden'); });
  settingsBtn?.addEventListener('click', ()=> { if(settingsModal) settingsModal.classList.remove('panel-hidden'); });
  document.getElementById('closeSettings')?.addEventListener('click', ()=> { applySettingsFromUI(); if(settingsModal) settingsModal.classList.add('panel-hidden'); });

  // bottom UI
  restartBtn?.addEventListener('click', ()=> { restartBtn.style.display='none'; startLevel(0); if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume); lastFrameTime = performance.now(); running = true; requestAnimationFrame(animate); tickLoop(); });
  pauseBtn?.addEventListener('click', ()=> togglePause());
  document.getElementById('menuBtnHeader')?.addEventListener('click', ()=> { if(titleOverlay) titleOverlay.style.display = (titleOverlay.style.display === 'none' ? 'block' : 'none'); });

  // quick toggles
  musicToggleQuick?.addEventListener('change', (e)=>{ SETTINGS.music = e.target.checked; if(!SETTINGS.music && SFX.bg) SFX.bg.pause(); else if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume); saveSettings(); });
  sfxToggleQuick?.addEventListener('change', (e)=>{ SETTINGS.sfx = e.target.checked; saveSettings(); });
  difficultyQuick?.addEventListener('input', (e)=>{ SETTINGS.difficulty = Number(e.target.value); saveSettings(); });

  // settings full UI
  if(musicToggleEl) musicToggleEl.checked = SETTINGS.music;
  if(sfxToggleEl) sfxToggleEl.checked = SETTINGS.sfx;
  if(musicVolumeEl) musicVolumeEl.value = SETTINGS.musicVolume;
  if(sfxVolumeEl) sfxVolumeEl.value = SETTINGS.sfxVolume;
  if(difficultyEl) difficultyEl.value = SETTINGS.difficulty;

  musicToggleEl?.addEventListener('change', (e)=>{ SETTINGS.music = e.target.checked; saveSettings(); if(!SETTINGS.music && SFX.bg) SFX.bg.pause(); else if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume); });
  sfxToggleEl?.addEventListener('change', (e)=>{ SETTINGS.sfx = e.target.checked; saveSettings(); });
  musicVolumeEl?.addEventListener('input', (e)=>{ SETTINGS.musicVolume = Number(e.target.value); if(SFX.bg) SFX.bg.volume = SETTINGS.musicVolume; saveSettings(); });
  sfxVolumeEl?.addEventListener('input', (e)=>{ SETTINGS.sfxVolume = Number(e.target.value); saveSettings(); });

  clearLeaderboardBtn?.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(STORAGE.leader); updateLeaderboardUI(); } });
}

/* Apply settings UI to global SETTINGS */
function applySettingsFromUI(){
  if(musicToggleEl) SETTINGS.music = musicToggleEl.checked;
  if(sfxToggleEl) SETTINGS.sfx = sfxToggleEl.checked;
  if(musicVolumeEl) SETTINGS.musicVolume = Number(musicVolumeEl.value);
  if(sfxVolumeEl) SETTINGS.sfxVolume = Number(sfxVolumeEl.value);
  if(difficultyEl) SETTINGS.difficulty = Number(difficultyEl.value);
  saveSettings();
  if(!SETTINGS.music && SFX.bg) SFX.bg.pause(); else if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume);
}

/* Save settings */
function saveSettings(){ localStorage.setItem(STORAGE.settings, JSON.stringify(SETTINGS)); }

/* ========================= PREVIEW & BOOT ========================= */
function previewAssets(){
  if(!previewCanvas) return;
  const ctxp = previewCtx;
  ctxp.clearRect(0,0,previewCanvas.width, previewCanvas.height);
  ctxp.fillStyle = '#02030a'; ctxp.fillRect(0,0,previewCanvas.width, previewCanvas.height);
  for(let i=0;i<8;i++){
    const x = 20 + i*40 + Math.sin(Date.now()/700 + i)*6;
    ctxp.fillStyle = `rgba(102,255,153,${0.15 + (i%2)*0.2})`;
    ctxp.beginPath(); ctxp.arc(x, previewCanvas.height/2, 10, 0, Math.PI*2); ctxp.fill();
  }
  requestAnimationFrame(previewAssets);
}

/* ========================= NOTIFICATIONS ========================= */
function showNotif(text){
  const area = document.getElementById('notifArea');
  if(!area) return;
  const el = document.createElement('div'); el.className = 'notif'; el.textContent = text; area.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); },1600);
}

/* ========================= PAUSE TOGGLE ========================= */
function togglePause(){
  paused = !paused;
  if(paused){
    running = false;
    pauseBtn && (pauseBtn.textContent = '▶ Resume');
    if(SFX.bg) SFX.bg.pause();
  } else {
    running = true;
    pauseBtn && (pauseBtn.textContent = '⏸ Pause');
    if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume);
    lastFrameTime = performance.now();
    requestAnimationFrame(animate);
    tickLoop();
  }
}

/* ========================= BOOTSTRAP: pre-load in background and wire UI ========================= */
async function boot(){
  resizeCanvas();
  wireUI();
  previewAssets();
  // Preload rough assets for preview (no progress bar) so UI feels responsive
  await preloadAll(false);
  initSpriteFrames(); // safety
  updateLeaderboardUI();
}
boot();

/* Expose debug */
window.__SHADOWCLONE = { IMG, SFX, startLevel, spawnPowerup, spawnClone, SETTINGS };
