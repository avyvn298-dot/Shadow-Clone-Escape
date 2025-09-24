/* script.js — Shadow Clone Escape (Full AAA-Polish)
   - Comprehensive single-file game logic
   - Responsive canvas, parallax background, joystick for mobile
   - Spritesheet-correct drawing, clones, powerups, portal transitions
   - Audio manager with SFX & music (graceful fallback if missing)
   - Local leaderboard, settings persistence, UI wiring
   - Paste this into script.js in your repo root
*/

/* ===========================
   ASSET CONFIG - EDIT PATHS HERE
   =========================== */
const ASSET = {
  ninja: "assets/ninja_spritesheet.png",          // e.g. 1536x534 -> 4 cols x 1 row
  clones: "assets/clones_spritesheet.png",        // e.g. 1060x433 -> 3 cols x 1 row
  portal: "assets/portal.png",                    // portal asset
  background: "background.png",                   // large background
  bgLayers: [                                      // optional parallax layers (higher index = closer)
    "assets/bg_layer1.png",
    "assets/bg_layer2.png",
    "assets/bg_layer3.png"
  ],
  bgMusic: "assets/bg_music_loop.wav",
  spawnSfx: "assets/spawn.wav",
  pickupSfx: "assets/powerup.wav",
  portalSfx: "assets/portal.wav",
  deathSfx: "assets/death.wav"
};

/* ===========================
   DOM / Canvas / UI references
   =========================== */
const CANVAS = document.getElementById('gameCanvas');
const ctx = CANVAS.getContext('2d');

const MINIMAP = document.getElementById('minimap');
const miniCtx = MINIMAP.getContext('2d');

const START_SCREEN = document.getElementById('start-screen');
const START_BTN = document.getElementById('start-btn');
const LEVEL_BTN = document.getElementById('level-btn');
const SETTINGS_BTN = document.getElementById('settings-btn');
const TUTORIAL_BTN = document.getElementById('tutorial-btn');

const LEVEL_SCREEN = document.getElementById('level-screen');
const LEVEL_BUTTONS = document.getElementById('level-buttons');
const BACK_TO_START = document.getElementById('back-to-start');

const SETTINGS_SCREEN = document.getElementById('settings-screen');
const TOGGLE_MUSIC = document.getElementById('toggle-music');
const TOGGLE_SFX = document.getElementById('toggle-sfx');
const DIFFICULTY_SELECT = document.getElementById('difficulty');
const BACK_TO_START_SETTINGS = document.getElementById('back-to-start-settings');

const TUTORIAL_SCREEN = document.getElementById('tutorial-screen');
const CLOSE_TUTORIAL = document.getElementById('close-tutorial');

const GAME_CONTAINER = document.getElementById('game-container');
const JOYSTICK_CONTAINER = document.getElementById('joystick-container');
const JOYSTICK = document.getElementById('joystick');

const PAUSE_OVERLAY = document.getElementById('pause-overlay');
const RESUME_BTN = document.getElementById('resume-btn');
const RESTART_BTN = document.getElementById('restart-btn');
const QUIT_BTN = document.getElementById('quit-btn');

const PROGRESS_FILL = document.getElementById('progressFill');
const PROGRESS_TEXT = document.getElementById('progressText');

const POWERUP_BOX = document.getElementById('powerupBox');
const TIMER_TEXT = document.getElementById('timer');
const STATUS_TEXT = document.getElementById('status');
const BEST_RECORD_TEXT = document.getElementById('bestRecordText');

const RESTART_BTN_HUD = document.getElementById('restartBtn');
const PAUSE_BTN_HUD = document.getElementById('pauseBtn');
const BTN_POWER = document.getElementById('btnPower');

const LEADERBOARD_LIST = document.getElementById('leaderboardList');
const CLEAR_LEADERBOARD = document.getElementById('clearLeaderboard');
const NOTIF_AREA = document.getElementById('notifArea');

const PREVIEW_CANVAS = document.getElementById('previewCanvas');
const PREVIEW_CTX = PREVIEW_CANVAS?.getContext('2d');

/* ===========================
   STORAGE KEYS & SETTINGS
   =========================== */
const STORAGE_KEYS = {
  SETTINGS: 'shadow_clone_settings',
  BEST: 'shadow_clone_best',
  LEADER: 'shadow_clone_leader'
};

let SETTINGS = {
  music: true,
  sfx: true,
  musicVol: 0.45,
  sfxVol: 1.0,
  difficulty: 1,   // 1-normal, 2-hard, 3-extreme maybe
  joystickSensitivity: 0.7,
  controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', shock: ' ' }
};
try {
  const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS));
  if (s) SETTINGS = { ...SETTINGS, ...s };
} catch (e) { console.warn('Settings parse failed', e); }

/* ===========================
   RUNTIME STATE
   =========================== */
let cols = 19, rows = 19, tileSize = 30;
let maze = [];
let mazeCache = null;
let player = null;
let movesHistory = [];
let clones = [];
let powerups = [];
let particles = [];
let frame = 0;
let running = false;
let paused = false;
let startTime = 0;
let cloneInterval = 300;
let activePower = null;
let PORTAL = null;
let currentLevelIndex = 0;

/* ===========================
   LEVELS (progression)
   =========================== */
const LEVELS = [
  { name: "Novice Shadow", scale: 1.0, cloneSpeed: 1.0, powerupRate: 0.025 },
  { name: "Wandering Echo", scale: 1.12, cloneSpeed: 1.1, powerupRate: 0.02 },
  { name: "Night Stalker", scale: 1.25, cloneSpeed: 1.2, powerupRate: 0.017 },
  { name: "Spectral Onslaught", scale: 1.4, cloneSpeed: 1.35, powerupRate: 0.013 },
  { name: "Ninja's Dread", scale: 1.6, cloneSpeed: 1.6, powerupRate: 0.01 },
  { name: "Endless", scale: 1.85, cloneSpeed: 2.0, powerupRate: 0.007 }
];

/* ===========================
   ASSET HOLDERS
   =========================== */
const IMG = { ninja: null, clones: null, portal: null, background: null, bgLayers: [] };
const AUDIO = { bg: null, spawn: null, pickup: null, portal: null, death: null };

/* Sprite meta (update after load) */
const SPRITE = {
  ninja: { cols: 4, rows: 1, frameW: 384, frameH: 534 },
  clones: { cols: 3, rows: 1, frameW: 353, frameH: 433 },
  portal: { cols: 1, rows: 1, frameW: 361, frameH: 316 }
};

/* ===========================
   UTILITY FUNCTIONS
   =========================== */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now()-startTime)/1000); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function safePlay(audio, vol=1){ if(!audio) return; try{ audio.volume = vol; audio.currentTime = 0; audio.play().catch(()=>{}); }catch(e){} }

/* ===========================
   LOADER (images + audio)
   =========================== */
function loadImage(src){ return new Promise(res=>{ if(!src) return res(null); const i=new Image(); i.onload=()=>res(i); i.onerror=()=>{console.warn('Image failed',src);res(null);} ; i.src=src; }); }
function loadAudio(src){ return new Promise(res=>{ if(!src) return res(null); try{ const a=new Audio(); a.addEventListener('canplaythrough', ()=>res(a), {once:true}); a.addEventListener('error', ()=>{console.warn('Audio failed',src); res(null);}, {once:true}); a.src = src; }catch(e){ console.warn('Audio load exception', e); res(null); } }); }

async function preloadAssets(showProgress=true){
  // tasks array depending on provided asset paths
  const tasks = [
    {type:'img', key:'ninja', path:ASSET.ninja},
    {type:'img', key:'clones', path:ASSET.clones},
    {type:'img', key:'portal', path:ASSET.portal},
    {type:'img', key:'background', path:ASSET.background},
    {type:'img', key:'bg1', path:ASSET.bgLayers?.[0]},
    {type:'img', key:'bg2', path:ASSET.bgLayers?.[1]},
    {type:'img', key:'bg3', path:ASSET.bgLayers?.[2]},
    {type:'audio', key:'bg', path:ASSET.bgMusic},
    {type:'audio', key:'spawn', path:ASSET.spawnSfx},
    {type:'audio', key:'pickup', path:ASSET.pickupSfx},
    {type:'audio', key:'portal', path:ASSET.portalSfx},
    {type:'audio', key:'death', path:ASSET.deathSfx}
  ];
  let done = 0;
  const total = tasks.filter(t=>t.path).length || tasks.length;

  function setProgress(pct, text){
    if(!showProgress) return;
    if(PROGRESS_FILL) PROGRESS_FILL.style.width = pct + '%';
    if(PROGRESS_TEXT) PROGRESS_TEXT.textContent = text || `Loading ${pct}%`;
  }

  for(const t of tasks){
    if(!t.path){ done++; setProgress(Math.round((done/total)*100)); continue; }
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
    setProgress(Math.round((done/total)*100), `Loading ${Math.round((done/total)*100)}%`);
    await new Promise(r=>setTimeout(r,40)); // small UX pacing
  }

  // set volumes
  if(AUDIO.bg){ AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.musicVol; }
  if(AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfxVol;
  if(AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfxVol;
  if(AUDIO.death) AUDIO.death.volume = SETTINGS.sfxVol;

  // compute sprite frame sizes safely
  computeSpriteFrames();
}

/* compute sprite frame size integers to avoid bleeding between frames */
function computeSpriteFrames(){
  if(IMG.ninja){ SPRITE.ninja.frameW = Math.floor(IMG.ninja.naturalWidth / SPRITE.ninja.cols); SPRITE.ninja.frameH = Math.floor(IMG.ninja.naturalHeight / SPRITE.ninja.rows); }
  if(IMG.clones){ SPRITE.clones.frameW = Math.floor(IMG.clones.naturalWidth / SPRITE.clones.cols); SPRITE.clones.frameH = Math.floor(IMG.clones.naturalHeight / SPRITE.clones.rows); }
  if(IMG.portal){ SPRITE.portal.frameW = Math.floor(IMG.portal.naturalWidth / SPRITE.portal.cols); SPRITE.portal.frameH = Math.floor(IMG.portal.naturalHeight / SPRITE.portal.rows); }
}

/* ===========================
   CANVAS / GRID RESIZE
   =========================== */
function resize(){
  // Canvas CSS max - keep within screen with margins
  const maxW = Math.min(window.innerWidth - 32, 1200);
  const width = Math.min(maxW, window.innerWidth - 40);
  CANVAS.style.width = width + 'px';
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * 0.62); // 16:10-ish
  CANVAS.width = Math.floor(logicalW * ratio);
  CANVAS.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);

  // minimap small canvas size
  const mmW = Math.min(220, Math.floor(width * 0.28));
  const mmH = Math.floor(mmW * 0.55);
  MINIMAP.width = mmW;
  MINIMAP.height = mmH;
  MINIMAP.style.width = mmW + 'px';
  MINIMAP.style.height = mmH + 'px';

  // grid
  const cssW = CANVAS.clientWidth || logicalW;
  const cssH = CANVAS.clientHeight || logicalH;
  const preferred = window.innerWidth < 720 ? 24 : 36;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(cssH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, cssH / rows));
}
window.addEventListener('resize', resize);

/* ===========================
   MAZE GENERATOR (recursive backtracker)
   =========================== */
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
  // safe zone
  grid[1][1] = 0; if(grid[1][2] !== undefined) grid[1][2] = 0; if(grid[2]) grid[2][1] = 0;
  return grid;
}

/* cache maze visuals for performance */
function cacheMaze(){
  if(!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  mctx.fillStyle = '#0b0b0b';
  mctx.fillRect(0,0,mazeCache.width, mazeCache.height);
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
        mctx.fillStyle = '#222';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        mctx.fillStyle = 'rgba(0,0,0,0.06)';
        mctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        mctx.fillStyle = '#070707';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* ===========================
   PORTAL (place farthest cell)
   =========================== */
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

/* ===========================
   START / RESET LEVEL
   =========================== */
function startLevel(index = 0){
  currentLevelIndex = clamp(index, 0, LEVELS.length-1);
  const L = LEVELS[currentLevelIndex];
  resize();
  cols = Math.max(11, Math.floor(19 * L.scale));
  rows = Math.max(11, Math.floor(19 * L.scale));
  if(cols % 2 === 0) cols--; if(rows % 2 === 0) rows--;
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = [];
  clones = [];
  powerups = [];
  particles = [];
  frame = 0;
  cloneInterval = Math.max(40, 300 - (SETTINGS.difficulty-1)*80);
  running = true; paused = false; startTime = Date.now(); activePower = null;
  placePortal();
  STATUS_TEXT && (STATUS_TEXT.textContent = `Level: ${L.name}`);
  if(BEST_RECORD_TEXT) BEST_RECORD_TEXT.textContent = (Number(localStorage.getItem(STORAGE_KEYS.BEST))||0) ? `Best: ${Number(localStorage.getItem(STORAGE_KEYS.BEST))}s` : 'Best: —';
}

/* ===========================
   POWERUPS
   =========================== */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let attempts = 0;
  while(attempts++ < 350){
    const x = randInt(1, cols-2);
    const y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x && p.y===y)){
      powerups.push({x,y,type:POWER_TYPES[randInt(0, POWER_TYPES.length-1)], spawned:Date.now(), bob:Math.random()*Math.PI*2});
      return;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type==='cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type==='shock') clones.forEach(c=> c.index = Math.max(0, (c.index||0) - 28));
  if(SETTINGS.sfx && AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfxVol);
  showNotif(`${type.toUpperCase()}!`);
}

/* ===========================
   PARTICLES
   =========================== */
function spawnParticles(px,py,color,count=18){
  for(let i=0;i<count;i++){
    particles.push({
      x: px + (Math.random()-0.5)*tileSize,
      y: py + (Math.random()-0.5)*tileSize,
      vx: (Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life: 28 + Math.random()*36, color
    });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.06;
    p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life/70);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3,3);
  }
  ctx.globalAlpha = 1;
}

/* ===========================
   Clone Class
   =========================== */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.spawnFrame = frame;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
  }
  update(){
    if(this.type === 'fast') this.index += 1 + (Math.random()<0.45 ? 1:0);
    else if(this.type === 'wraith'){
      if(Math.random() < 0.01 + Math.min(0.05, frame/60000)){
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
    if(IMG.clones){
      const typeIndex = (this.type === 'wraith') ? 2 : (this.type === 'fast' ? 1 : 0);
      const sx = typeIndex * SPRITE.clones.frameW;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clones, sx, 0, SPRITE.clones.frameW, SPRITE.clones.frameH, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
    }
  }
}

/* ===========================
   INPUT & PLAYER MOVEMENT
   =========================== */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', (e)=>{
  if(e.key === SETTINGS.controls.up) { activeDirs.up=true; stepPlayer(); playFootstep(); }
  if(e.key === SETTINGS.controls.down) { activeDirs.down=true; stepPlayer(); }
  if(e.key === SETTINGS.controls.left) { activeDirs.left=true; stepPlayer(); }
  if(e.key === SETTINGS.controls.right) { activeDirs.right=true; stepPlayer(); }
  if(e.key === SETTINGS.controls.shock) applyPowerup('shock');
  if(e.key === 'Escape') togglePause();
});
document.addEventListener('keyup', (e)=>{
  if(e.key === SETTINGS.controls.up) activeDirs.up=false;
  if(e.key === SETTINGS.controls.down) activeDirs.down=false;
  if(e.key === SETTINGS.controls.left) activeDirs.left=false;
  if(e.key === SETTINGS.controls.right) activeDirs.right=false;
});

function playFootstep(){ if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVol); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (SETTINGS.difficulty-1) * 10));
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
    if(PORTAL && nx===PORTAL.x && ny===PORTAL.y){
      if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVol);
      transitionToNextLevel();
    }
  }
}

/* mobile joystick (pointer based) - auto-appears on touch devices */
let joystickActive = false;
let joystickPointerId = null;
let joystickOrigin = {x:0,y:0};
let joystickPos = {x:0,y:0};
let joystickRadius = 40;

// show joystick on touch devices
function initJoystick(){
  if(!JOYSTICK_CONTAINER || !JOYSTICK) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if(!isTouch){ JOYSTICK_CONTAINER.classList.add('hidden'); return; }
  JOYSTICK_CONTAINER.classList.remove('hidden');

  // pointerdown on container to capture start
  JOYSTICK_CONTAINER.addEventListener('pointerdown', (ev)=>{
    JOYSTICK_CONTAINER.setPointerCapture(ev.pointerId);
    joystickActive = true;
    joystickPointerId = ev.pointerId;
    const rect = JOYSTICK_CONTAINER.getBoundingClientRect();
    joystickOrigin.x = rect.left + rect.width/2;
    joystickOrigin.y = rect.top + rect.height/2;
    updateJoystickFromPointer(ev.clientX, ev.clientY);
  });

  JOYSTICK_CONTAINER.addEventListener('pointermove', (ev)=>{
    if(!joystickActive || ev.pointerId !== joystickPointerId) return;
    updateJoystickFromPointer(ev.clientX, ev.clientY);
  });

  JOYSTICK_CONTAINER.addEventListener('pointerup', (ev)=>{
    if(ev.pointerId !== joystickPointerId) return;
    joystickActive = false;
    joystickPointerId = null;
    joystickPos.x = 0; joystickPos.y = 0;
    JOYSTICK.style.transform = `translate(0px,0px)`;
    activeDirs = {up:false,down:false,left:false,right:false};
  });

  JOYSTICK_CONTAINER.addEventListener('pointercancel', (ev)=>{ joystickActive = false; joystickPointerId=null; joystickPos={x:0,y:0}; JOYSTICK.style.transform = `translate(0px,0px)`; activeDirs = {up:false,down:false,left:false,right:false}; });
}

function updateJoystickFromPointer(cx, cy){
  const dx = cx - joystickOrigin.x;
  const dy = cy - joystickOrigin.y;
  const dist = Math.sqrt(dx*dx+dy*dy);
  const max = joystickRadius;
  const nx = dx / (dist || 1);
  const ny = dy / (dist || 1);
  const r = Math.min(dist, max) * SETTINGS.joystickSensitivity;
  joystickPos.x = nx * r;
  joystickPos.y = ny * r;
  JOYSTICK.style.transform = `translate(${joystickPos.x}px, ${joystickPos.y}px)`;
  // map to directional flags
  activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
  activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
  stepPlayer();
}

/* ===========================
   Spawn clones (based on movesHistory snapshot)
   =========================== */
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
  if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVol);
  spawnParticles((c.x||player.x)*tileSize + tileSize/2, (c.y||player.y)*tileSize + tileSize/2, '#ff4466');
}

/* ===========================
   DRAW HELPERS
   =========================== */
function drawBackground(now){
  ctx.save();
  const w = CANVAS.width / (window.devicePixelRatio || 1);
  const h = CANVAS.height / (window.devicePixelRatio || 1);

  if(IMG.background){
    // parallax subtle movement
    const t = Date.now()/12000;
    const xoff = Math.sin(t)*36;
    ctx.drawImage(IMG.background, 0, 0, IMG.background.naturalWidth, IMG.background.naturalHeight, -40 + xoff, -20, w+80, h+40);
  } else {
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, '#06202A'); g.addColorStop(1,'#05050a');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }

  // optional layers
  if(IMG.bgLayers && IMG.bgLayers.length){
    for(let i=0;i<IMG.bgLayers.length;i++){
      const layer = IMG.bgLayers[i];
      if(!layer) continue;
      const depth = (i+1) / (IMG.bgLayers.length+1);
      const xoff = Math.sin(Date.now()/(7000*(1+depth))) * 12 * depth;
      ctx.globalAlpha = 0.75 - depth*0.15;
      ctx.drawImage(layer, -20 + xoff, -10, w+40, h+20);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();

  // overlay cinematic vignette
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0,0, CANVAS.width/(window.devicePixelRatio||1), CANVAS.height/(window.devicePixelRatio||1));
}

function drawMaze(){
  if(!maze) return;
  if(mazeCache){
    ctx.drawImage(mazeCache, 0, 0);
    return;
  }
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

function drawPowerups(){
  for(const pu of powerups){
    const cx = pu.x*tileSize + tileSize/2, cy = pu.y*tileSize + tileSize/2 + Math.sin((frame+pu.bob)*0.12)*3;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(Math.sin(frame/18 + pu.bob)*0.08);
    if(pu.type === 'speed'){
      ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,tileSize*0.22,0,Math.PI*2); ctx.fill();
    } else if(pu.type === 'cloak'){
      ctx.fillStyle = '#9be7b0'; ctx.fillRect(-tileSize*0.2,-tileSize*0.2,tileSize*0.4,tileSize*0.4);
    } else {
      ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(0,-tileSize*0.22); ctx.lineTo(tileSize*0.14,0); ctx.lineTo(-tileSize*0.14,0); ctx.fill();
    }
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
    ctx.translate(px,py);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320);
    ctx.drawImage(IMG.portal, -tileSize*scale/2, -tileSize*scale/2, tileSize*scale, tileSize*scale);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(px,py); ctx.rotate(rot/1.8); ctx.fillStyle = '#66ffcc'; ctx.beginPath(); ctx.ellipse(0,0,tileSize*0.42,tileSize*0.46,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* minimap - shows live player position and clones/powerups */
function drawMiniMap(){
  const mmW = MINIMAP.width, mmH = MINIMAP.height;
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

/* draw player sprite precisely (frame-based) */
function drawPlayer(){
  if(!player) return;
  if(IMG.ninja){
    const animCol = Math.floor((frame/6) % SPRITE.ninja.cols);
    const sx = animCol * SPRITE.ninja.frameW;
    const sy = 0;
    ctx.drawImage(IMG.ninja, sx, sy, SPRITE.ninja.frameW, SPRITE.ninja.frameH, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    const pulse = 0.9 + Math.sin(Date.now()/420)*0.08;
    ctx.save(); ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* ===========================
   HUD / Notifs
   =========================== */
function updateHUD(){
  if(TIMER_TEXT) TIMER_TEXT.textContent = `Time: ${nowSec()}s`;
  if(activePower && Date.now() < activePower.until){
    const rem = Math.ceil((activePower.until - Date.now())/1000);
    if(POWERUP_BOX) POWERUP_BOX.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
  } else {
    if(POWERUP_BOX) POWERUP_BOX.innerHTML = '';
    if(activePower && Date.now() >= activePower.until) activePower = null;
  }
}
function showNotif(text){
  if(!NOTIF_AREA) return;
  const el = document.createElement('div');
  el.className = 'notif';
  el.textContent = text;
  NOTIF_AREA.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); }, 1600);
}

/* ===========================
   MAIN LOOP
   =========================== */
let lastFrameTime = performance.now();
function loop(now){
  if(!running || paused) return;
  const dt = (now - lastFrameTime)/1000; lastFrameTime = now; frame++;

  // occasional powerups spawn
  if(frame % Math.max(300, Math.floor(800 / (1 + (SETTINGS.difficulty-1)*0.3))) === 0){
    if(Math.random() < (LEVELS[currentLevelIndex].powerupRate || 0.02)) spawnPowerup();
  }

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + (SETTINGS.difficulty-1)*0.5)));
  if(frame % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(Math.random() < 0.02 + (SETTINGS.difficulty-1)*0.03) spawnClone();
    if(cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - (SETTINGS.difficulty-1));
  }

  // update clone positions & collisions
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i]; c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)){
        // death sequence
        running = false;
        if(SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVol);
        showNotif('☠️ You Died');
        if(RESTART_BTN_HUD) RESTART_BTN_HUD.style.display = 'inline-block';
        const elapsed = nowSec();
        const prevBest = Number(localStorage.getItem(STORAGE_KEYS.BEST)) || 0;
        if(elapsed > prevBest){
          localStorage.setItem(STORAGE_KEYS.BEST, elapsed);
          showNotif('NEW RECORD!');
          addToLeaderboard(elapsed);
        }
        spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66', 36);
        setTimeout(()=>{ startLevel(Math.max(0,currentLevelIndex)); }, 1100);
        return;
      }
    }
  }

  updateParticles();

  // render pipeline
  ctx.clearRect(0,0,CANVAS.width,CANVAS.height);
  drawBackground(now);
  drawMaze();
  drawPowerups();
  drawPortal(now);
  for(const c of clones) c.draw();

  // smooth player rendering
  const speed = 12 + (SETTINGS.difficulty-1) * 6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0,movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i];
    const a = (i - Math.max(0,movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + a*0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // draw player
  drawPlayer();

  drawParticles();
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(loop);
}

/* ===========================
   TRANSITION TO NEXT LEVEL (Geometry-Dash style)
   =========================== */
function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVol);
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
      startLevel(Math.min(LEVELS.length-1, currentLevelIndex + 1));
      running = true; lastFrameTime = performance.now(); requestAnimationFrame(loop);
      showNotif(`Level Up: ${LEVELS[currentLevelIndex].name}`);
    }
  }
  anim();
}

/* ===========================
   TICK LOOP (for held directions)
   =========================== */
let lastTick = 0;
function tick(){
  if(!running || paused) return;
  const now = performance.now();
  if(now - lastTick > 120){
    if(activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer();
    lastTick = now;
  }
  requestAnimationFrame(tick);
}

/* ===========================
   Leaderboard / local storage
   =========================== */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADER) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):','Player') || 'Player';
  name = name.slice(0,12);
  list.push({name, time});
  list.sort((a,b)=> b.time - a.time);
  localStorage.setItem(STORAGE_KEYS.LEADER, JSON.stringify(list.slice(0,50)));
  updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADER) || '[]');
  if(!LEADERBOARD_LIST) return;
  LEADERBOARD_LIST.innerHTML = '';
  list.slice(0,10).forEach(it=>{
    const li = document.createElement('li'); li.textContent = `${it.name} — ${it.time}s`; LEADERBOARD_LIST.appendChild(li);
  });
}

/* ===========================
   UI Wiring
   =========================== */
function wireUI(){
  // Menus
  START_BTN?.addEventListener('click', async ()=>{
    // preload with progress
    await preloadAssets(true);
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVol);
    // show/hide
    START_SCREEN.classList.add('hidden');
    LEVEL_SCREEN.classList.add('hidden');
    SETTINGS_SCREEN.classList.add('hidden');
    TUTORIAL_SCREEN.classList.add('hidden');
    GAME_CONTAINER.classList.remove('hidden');
    // setup joystick and canvas
    resize(); initJoystick();
    startLevel(0);
    lastFrameTime = performance.now();
    running = true; requestAnimationFrame(loop); tick();
  });

  LEVEL_BTN?.addEventListener('click', ()=>{
    START_SCREEN.classList.add('hidden');
    LEVEL_SCREEN.classList.remove('hidden');
    populateLevels();
  });
  BACK_TO_START?.addEventListener('click', ()=>{ LEVEL_SCREEN.classList.add('hidden'); START_SCREEN.classList.remove('hidden'); });

  SETTINGS_BTN?.addEventListener('click', ()=>{ START_SCREEN.classList.add('hidden'); SETTINGS_SCREEN.classList.remove('hidden'); });
  BACK_TO_START_SETTINGS?.addEventListener('click', ()=>{ SETTINGS_SCREEN.classList.add('hidden'); START_SCREEN.classList.remove('hidden'); saveSettings(); });

  TUTORIAL_BTN?.addEventListener('click', ()=>{ START_SCREEN.classList.add('hidden'); TUTORIAL_SCREEN.classList.remove('hidden'); });
  CLOSE_TUTORIAL?.addEventListener('click', ()=>{ TUTORIAL_SCREEN.classList.add('hidden'); START_SCREEN.classList.remove('hidden'); });

  // HUD
  RESUME_BTN?.addEventListener('click', ()=>{ togglePause(); });
  RESTART_BTN?.addEventListener('click', ()=>{ startLevel(0); });
  QUIT_BTN?.addEventListener('click', ()=>{ running=false; GAME_CONTAINER.classList.add('hidden'); START_SCREEN.classList.remove('hidden'); if(AUDIO.bg) AUDIO.bg.pause(); });

  RESTART_BTN_HUD?.addEventListener('click', ()=>{ startLevel(0); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVol); lastFrameTime = performance.now(); running = true; requestAnimationFrame(loop); tick(); });
  PAUSE_BTN_HUD?.addEventListener('click', ()=>{ togglePause(); });
  BTN_POWER?.addEventListener('click', ()=> applyPowerup('shock'));

  // quick settings toggles exist in index.html side panel optionally
  document.getElementById('musicToggleQuick')?.addEventListener('change', (e)=>{ SETTINGS.music = e.target.checked; if(!SETTINGS.music && AUDIO.bg) AUDIO.bg.pause(); else if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVol); saveSettings(); });
  document.getElementById('sfxToggleQuick')?.addEventListener('change', (e)=>{ SETTINGS.sfx = e.target.checked; saveSettings(); });
  document.getElementById('difficultyQuick')?.addEventListener('input', (e)=>{ SETTINGS.difficulty = Number(e.target.value); saveSettings(); });

  // settings screen wiring
  TOGGLE_MUSIC && (TOGGLE_MUSIC.checked = SETTINGS.music);
  TOGGLE_SFX && (TOGGLE_SFX.checked = SETTINGS.sfx);
  DIFFICULTY_SELECT && (DIFFICULTY_SELECT.value = SETTINGS.difficulty === 1 ? 'normal' : (SETTINGS.difficulty === 2 ? 'hard' : 'extreme'));
  TOGGLE_MUSIC?.addEventListener('change', (e)=>{ SETTINGS.music = e.target.checked; saveSettings(); if(!SETTINGS.music && AUDIO.bg) AUDIO.bg.pause(); else if(AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVol); });
  TOGGLE_SFX?.addEventListener('change', (e)=>{ SETTINGS.sfx = e.target.checked; saveSettings(); });

  CLEAR_LEADERBOARD?.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(STORAGE_KEYS.LEADER); updateLeaderboardUI(); } });
}

/* populate level buttons */
function populateLevels(){
  if(!LEVEL_BUTTONS) return;
  LEVEL_BUTTONS.innerHTML = '';
  LEVELS.forEach((L, idx)=>{
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.textContent = `${idx+1}. ${L.name}`;
    btn.addEventListener('click', ()=>{ LEVEL_SCREEN.classList.add('hidden'); GAME_CONTAINER.classList.remove('hidden'); startLevel(idx); lastFrameTime = performance.now(); running = true; requestAnimationFrame(loop); tick(); });
    LEVEL_BUTTONS.appendChild(btn);
  });
}

/* ===========================
   Helpers: settings persist, preview animation
   =========================== */
function saveSettings(){ localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SETTINGS)); }
function previewLoop(){
  if(!PREVIEW_CANVAS || !PREVIEW_CTX) return;
  PREVIEW_CTX.clearRect(0,0, PREVIEW_CANVAS.width, PREVIEW_CANVAS.height);
  PREVIEW_CTX.fillStyle = '#02030a'; PREVIEW_CTX.fillRect(0,0, PREVIEW_CANVAS.width, PREVIEW_CANVAS.height);
  for(let i=0;i<8;i++){
    const x = 20 + i*44 + Math.sin(Date.now()/600 + i)*6;
    PREVIEW_CTX.fillStyle = `rgba(102,255,153,${0.15 + (i%2)*0.2})`;
    PREVIEW_CTX.beginPath(); PREVIEW_CTX.arc(x, PREVIEW_CANVAS.height/2, 8, 0, Math.PI*2); PREVIEW_CTX.fill();
  }
  requestAnimationFrame(previewLoop);
}

/* ===========================
   Pause toggle
   =========================== */
function togglePause(){
  paused = !paused;
  if(paused){
    running = false;
    PAUSE_OVERLAY && PAUSE_OVERLAY.classList.remove('hidden');
    PAUSE_BTN_HUD && (PAUSE_BTN_HUD.textContent = '▶ Resume');
    if(AUDIO.bg) AUDIO.bg.pause();
  } else {
    running = true;
    PAUSE_OVERLAY && PAUSE_OVERLAY.classList.add('hidden');
    PAUSE_BTN_HUD && (PAUSE_BTN_HUD.textContent = '⏸ Pause');
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVol);
    lastFrameTime = performance.now();
    requestAnimationFrame(loop);
    tick();
  }
}

/* ===========================
   Leaderboard UI update on load
   =========================== */
function initLeaderboard(){
  updateLeaderboardUI();
}

/* ===========================
   Notifications (small helper)
   =========================== */
function showNotif(text){
  if(!NOTIF_AREA) return;
  const el = document.createElement('div'); el.className = 'notif'; el.textContent = text; NOTIF_AREA.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); }, 1600);
}

/* ===========================
   Bootstrap
   =========================== */
async function boot(){
  resize();
  wireUI();
  previewLoop();
  initJoystick();
  initLeaderboard();
  // Preload non-critical assets quietly so preview looks nicer
  try{ await preloadAssets(false); }catch(e){ console.warn('prefetch error', e); }
  computeSpriteFrames();
}
boot();

/* Expose debug helpers for easy debugging */
window.__SHADOW = { IMG, AUDIO, startLevel, spawnPowerup, spawnClone, SETTINGS };

