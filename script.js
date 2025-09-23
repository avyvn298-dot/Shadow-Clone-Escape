/* script.js — Shadow Clone Escape (AAA polish)
   Drop this file in your repo root. It will try to load assets from:
     1) repo root (e.g. "ninja_spritesheet.png")
     2) fallback "assets/..." path (if you prefer structured folders)
   If your filenames differ, edit ASSET_CANDIDATES at the top.

   Controls:
     - Arrow keys / WASD to move
     - On-screen D-pad for mobile (if present)
     - Start Run button in HTML to begin (audio will start after user gesture)
*/

/* ============================ CONFIG & ASSET LIST ============================ */

const ASSET_CANDIDATES = {
  // Provide arrays of possible paths (most-likely first).
  ninja: ["ninja_spritesheet.png", "assets/characters/ninja_spritesheet.png", "assets/characters/ninja.png"],
  clones: ["clones_spritesheet.png", "assets/characters/clones_spritesheet.png"],
  portal: ["portal_spritesheet.png", "assets/characters/portal_spritesheet.png"],
  power_speed: ["powerup_speed.png", "assets/powerups/powerup_speed.png"],
  power_cloak: ["powerup_cloak.png", "assets/powerups/powerup_cloak.png"],
  power_clone: ["powerup_clone.png", "assets/powerups/powerup_clone.png"],
  obstacles: ["obstacles_spritesheet.png", "assets/obstacles/obstacles_spritesheet.png"],
  background_layers: [
    ["bg_layer1.png","assets/background/bg_layer1.png"],
    ["bg_layer2.png","assets/background/bg_layer2.png"],
    ["bg_layer3.png","assets/background/bg_layer3.png"],
    ["bg_layer4.png","assets/background/bg_layer4.png"]
  ],
  audio: {
    bg: ["bg_music_loop.mp3","assets/audio/bg_music_loop.mp3"],
    jump: ["sfx_jump.wav","assets/audio/sfx_jump.wav"],
    clone: ["sfx_clone.wav","assets/audio/sfx_clone.wav"],
    powerup: ["sfx_powerup.wav","assets/audio/sfx_powerup.wav"],
    portal: ["sfx_portal.wav","assets/audio/sfx_portal.wav"]
  }
};

/* tweakable gameplay parameters */
const BASE_TILE_SIZE = 34;   // logical tile size (will scale with display)
const BASE_COLS = 19;
const BASE_ROWS = 19;

/* ============================ DOM & CANVAS ============================ */

const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const miniMap = document.getElementById('miniMap');
const miniCtx = miniMap.getContext('2d');

const startBtn = document.getElementById('startBtn');
const startBtnOverlay = document.getElementById('startBtnOverlay');
const tutorialBtn = document.getElementById('tutorialBtn');
const settingsBtn = document.getElementById('settingsBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtnHeader = document.getElementById('menuBtnHeader');
const menuBtn = document.querySelector('#menuBtn') || menuBtnHeader;
const tutorialBox = document.getElementById('tutorial');
const settingsBox = document.getElementById('settings');
const difficultyEl = document.getElementById('difficulty');
const bestRecordText = document.getElementById('bestRecordText');
const statusText = document.getElementById('status');
const timerText = document.getElementById('timer');
const powerupBox = document.getElementById('powerupBox');
const mobileControls = document.getElementById('mobileControls');
const dpad = document.getElementById('dpad');
const btnPower = document.getElementById('btnPower');
const titleOverlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const notifArea = document.getElementById('notifArea');

/* ============================ UTILITY: load image/audio with fallback ============================ */

function loadImageCandidates(candidates) {
  // candidates: array of possible urls (try sequentially)
  return new Promise((resolve) => {
    if (!Array.isArray(candidates)) candidates = [candidates];
    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) { resolve(null); return; }
      const url = candidates[idx++];
      const img = new Image();
      img.src = url;
      img.onload = () => resolve({ img, url });
      img.onerror = () => tryNext();
    }
    tryNext();
  });
}
function loadAudioCandidates(candidates) {
  return new Promise((resolve) => {
    if (!Array.isArray(candidates)) candidates = [candidates];
    let idx = 0;
    function tryNext() {
      if (idx >= candidates.length) { resolve(null); return; }
      const url = candidates[idx++];
      const a = new Audio();
      a.src = url;
      // don't attempt to autoplay here — just ensure resource exists
      a.addEventListener('canplaythrough', function onok(){ a.removeEventListener('canplaythrough', onok); resolve({ audio:a, url }); }, { once: true });
      a.addEventListener('error', ()=> tryNext(), { once: true });
    }
    tryNext();
  });
}

/* ============================ GLOBAL STATE ============================ */

let cols = BASE_COLS, rows = BASE_ROWS, tileSize = BASE_TILE_SIZE;
let maze = [];
let mazeCache = null; // offscreen canvas of static walls
let movesHistory = [];
let clones = [];
let powerups = [];
let particles = [];
let frameCount = 0;
let running = false;
let startTime = 0;
let LEVEL = 1;
let PORTAL = null;
let SETTINGS = { difficulty: 1, music: true, sfx: true };

/* assets holder */
const ASSETS = {
  images: {},
  audios: {},
  backgrounds: []
};

/* ============================ PRELOAD ALL ASSETS ============================ */

async function preloadAll() {
  // load character sheet (supports combined sheet or separate)
  const ninjaLoaded = await loadImageCandidates(ASSET_CANDIDATES.ninja);
  const clonesLoaded = await loadImageCandidates(ASSET_CANDIDATES.clones);
  const portalLoaded = await loadImageCandidates(ASSET_CANDIDATES.portal);

  // if we have a single combined sheet (ninjaLoaded) we will use it for all three roles if clones/portal missing
  ASSETS.images.ninjaSheet = (ninjaLoaded && ninjaLoaded.img) ? ninjaLoaded.img : null;
  ASSETS.images.clonesSheet = (clonesLoaded && clonesLoaded.img) ? clonesLoaded.img : ASSETS.images.ninjaSheet;
  ASSETS.images.portalSheet = (portalLoaded && portalLoaded.img) ? portalLoaded.img : ASSETS.images.ninjaSheet;

  // powerups
  ASSETS.images.power_speed = (await loadImageCandidates(ASSET_CANDIDATES.power_speed))?.img;
  ASSETS.images.power_cloak = (await loadImageCandidates(ASSET_CANDIDATES.power_cloak))?.img;
  ASSETS.images.power_clone = (await loadImageCandidates(ASSET_CANDIDATES.power_clone))?.img;

  // obstacles
  ASSETS.images.obstacles = (await loadImageCandidates(ASSET_CANDIDATES.obstacles))?.img;

  // backgrounds (each is candidate array)
  ASSETS.backgrounds = [];
  for (let bCandidates of ASSET_CANDIDATES.background_layers) {
    const loaded = await loadImageCandidates(bCandidates);
    ASSETS.backgrounds.push(loaded ? loaded.img : null);
  }

  // audio
  ASSETS.audios.bg = (await loadAudioCandidates(ASSET_CANDIDATES.audio.bg))?.audio;
  ASSETS.audios.jump = (await loadAudioCandidates(ASSET_CANDIDATES.audio.jump))?.audio;
  ASSETS.audios.clone = (await loadAudioCandidates(ASSET_CANDIDATES.audio.clone))?.audio;
  ASSETS.audios.powerup = (await loadAudioCandidates(ASSET_CANDIDATES.audio.powerup))?.audio;
  ASSETS.audios.portal = (await loadAudioCandidates(ASSET_CANDIDATES.audio.portal))?.audio;

  // audio volume presets
  if (ASSETS.audios.bg) ASSETS.audios.bg.loop = true, ASSETS.audios.bg.volume = 0.45;
  if (ASSETS.audios.jump) ASSETS.audios.jump.volume = 0.8;
  if (ASSETS.audios.clone) ASSETS.audios.clone.volume = 0.9;
  if (ASSETS.audios.powerup) ASSETS.audios.powerup.volume = 0.9;
  if (ASSETS.audios.portal) ASSETS.audios.portal.volume = 0.9;

  // basic console report for debugging
  console.log("Assets summary:", {
    ninjaSheet: !!ASSETS.images.ninjaSheet,
    clonesSheet: !!ASSETS.images.clonesSheet,
    portalSheet: !!ASSETS.images.portalSheet,
    backgroundCount: ASSETS.backgrounds.filter(Boolean).length,
    audioBg: !!ASSETS.audios.bg
  });
}

/* ============================ CANVAS SIZING & GRID ============================ */

function resizeCanvas() {
  const maxW = Math.min(window.innerWidth - 40, 980);
  const width = Math.min(maxW, 960);
  gameCanvas.style.width = width + 'px';
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * 0.66);
  gameCanvas.width = Math.floor(logicalW * ratio);
  gameCanvas.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  // recompute tileSize and grid
  const cssW = gameCanvas.clientWidth || logicalW;
  const cssH = gameCanvas.clientHeight || logicalH;
  const preferred = window.innerWidth < 720 ? 26 : BASE_TILE_SIZE;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(cssH / preferred));
  if (cols % 2 === 0) cols--;
  if (rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, cssH / rows));

  // minimap
  miniMap.width = 280 * (window.devicePixelRatio || 1);
  miniMap.height = 160 * (window.devicePixelRatio || 1);
  miniMap.style.width = '140px';
  miniMap.style.height = '80px';
  miniCtx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

/* ============================ MAZE GENERATION ============================ */

function generateMaze(c, r) {
  const grid = Array.from({ length: r }, () => Array(c).fill(1));
  function carve(x, y) {
    grid[y][x] = 0;
    const dirs = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < c - 1 && ny > 0 && ny < r - 1 && grid[ny][nx] === 1) {
        grid[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1, 1);
  grid[1][1] = 0; if (grid[1][2] !== undefined) grid[1][2] = 0; if (grid[2]) grid[2][1] = 0;
  return grid;
}

/* ============================ CACHE MAZE to OFFSCREEN CANVAS ============================ */

function cacheMaze() {
  if (!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');

  // draw backgrounds under maze (subtle)
  if (ASSETS.backgrounds && ASSETS.backgrounds[0]) {
    // fill with first layer scaled
    mctx.drawImage(ASSETS.backgrounds[0], 0, 0, mazeCache.width, mazeCache.height);
  } else {
    mctx.fillStyle = '#0b0b0b';
    mctx.fillRect(0, 0, mazeCache.width, mazeCache.height);
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (maze[y][x] === 1) {
        mctx.fillStyle = '#222';
        mctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        mctx.fillStyle = 'rgba(0,0,0,0.06)';
        mctx.fillRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
      } else {
        mctx.fillStyle = '#070707';
        mctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }
}

/* ============================ SPAWN PORTAL (farthest cell) ============================ */

function spawnPortal() {
  let best = null, bestd = -1;
  for (let y = rows - 2; y >= 1; y--) {
    for (let x = cols - 2; x >= 1; x--) {
      if (maze[y][x] === 0 && !(x === 1 && y === 1)) {
        const d = Math.abs(x - 1) + Math.abs(y - 1);
        if (d > bestd) { bestd = d; best = { x, y }; }
      }
    }
  }
  PORTAL = best;
}

/* ============================ GAME RESET ============================ */

let player = null;
let cloneIntervalFrames = 300;

function resetGame() {
  resizeCanvas();
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x: 1, y: 1, rx: 1, ry: 1, radius: Math.max(6, tileSize * 0.36), anim: { frame: 0 } };
  movesHistory = [];
  clones = [];
  powerups = [];
  particles = [];
  frameCount = 0;
  cloneIntervalFrames = Math.max(50, 300 - (SETTINGS.difficulty - 1) * 80);
  running = true;
  startTime = Date.now();
  spawnPortal();
  updateHUD();
}

/* ============================ POWERUPS ============================ */

const POWER_TYPES = ['speed', 'cloak', 'shock'];
let activePower = null;

function spawnPowerup() {
  let attempts = 0;
  while (attempts++ < 200) {
    const x = randInt(1, cols - 2), y = randInt(1, rows - 2);
    if (maze[y][x] === 0 && !(x === player.x && y === player.y) && !powerups.some(p => p.x === x && p.y === y)) {
      powerups.push({ x, y, type: POWER_TYPES[randInt(0, POWER_TYPES.length - 1)], spawned: Date.now(), bob: Math.random() * Math.PI * 2 });
      return;
    }
  }
}

function applyPowerup(type) {
  if (type === 'speed') activePower = { type: 'speed', until: Date.now() + 4500 };
  else if (type === 'cloak') activePower = { type: 'cloak', until: Date.now() + 5000 };
  else if (type === 'shock') {
    clones.forEach(c => c.index = Math.max(0, (c.index || 0) - 28));
  }
  if (SETTINGS.sfx && ASSETS.audios.powerup) { try { ASSETS.audios.powerup.currentTime = 0; ASSETS.audios.powerup.play(); } catch (e) { } }
}

/* ============================ CLONE CLASS ============================ */

class Clone {
  constructor(path, type = 'basic') {
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.spawnFrame = frameCount;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
  }
  update() {
    if (this.index < this.path.length - 1) this.index++;
    if (this.index < this.path.length) {
      this.x = this.path[this.index].x;
      this.y = this.path[this.index].y;
    }
  }
  draw(alpha = 0.85) {
    // draw clone sprite from clonesSheet if available, else simple rectangle fallback
    const img = ASSETS.images.clonesSheet;
    if (img) {
      // attempt to pick a row based on type (we assume rows store variants)
      const colsFrames = Math.max(1, Math.floor(img.naturalWidth / tileSize));
      const rowsFrames = Math.max(1, Math.floor(img.naturalHeight / tileSize));
      const row = this.type === 'wraith' ? Math.min(rowsFrames - 1, 2) : (this.type === 'fast' ? Math.min(rowsFrames - 1, 1) : 0);
      const col = Math.floor((frameCount / 6) % colsFrames);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize, this.x * tileSize, this.y * tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = (this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33');
      ctx.fillRect(this.x * tileSize + 2, this.y * tileSize + 2, tileSize - 4, tileSize - 4);
      ctx.globalAlpha = 1;
    }
  }
}

/* ============================ PARTICLES ============================ */

function spawnParticles(px, py, color) {
  for (let i = 0; i < 18; i++) {
    particles.push({
      x: px + (Math.random() - 0.5) * tileSize,
      y: py + (Math.random() - 0.5) * tileSize,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 20 + Math.random() * 30,
      color
    });
  }
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 50);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/* ============================ INPUT & MOVEMENT ============================ */

let activeDirs = { up: false, down: false, left: false, right: false };
let lastStepTime = 0, stepMsBase = 140;

document.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.key === 'ArrowUp' || e.key === 'w') { activeDirs.up = true; attemptStep(); tryPlay('jump'); }
  if (e.key === 'ArrowDown' || e.key === 's') { activeDirs.down = true; attemptStep(); }
  if (e.key === 'ArrowLeft' || e.key === 'a') { activeDirs.left = true; attemptStep(); }
  if (e.key === 'ArrowRight' || e.key === 'd') { activeDirs.right = true; attemptStep(); }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') activeDirs.up = false;
  if (e.key === 'ArrowDown' || e.key === 's') activeDirs.down = false;
  if (e.key === 'ArrowLeft' || e.key === 'a') activeDirs.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') activeDirs.right = false;
});

function attemptStep() {
  const now = performance.now();
  const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(50, Math.floor(stepMsBase * speedFactor - (SETTINGS.difficulty - 1) * 6));
  if (now - lastStepTime < ms) return;
  lastStepTime = now;
  if (!running) return;

  let nx = player.x, ny = player.y;
  if (activeDirs.up) ny--;
  else if (activeDirs.down) ny++;
  else if (activeDirs.left) nx--;
  else if (activeDirs.right) nx++;

  if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && maze[ny][nx] === 0) {
    player.x = nx; player.y = ny;
    movesHistory.push({ x: nx, y: ny });
    // pickup powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      if (powerups[i].x === nx && powerups[i].y === ny) {
        applyPowerup(powerups[i].type);
        powerups.splice(i, 1);
        break;
      }
    }
  }
}

/* mobile D-pad hooking if present */
dpad?.addEventListener('pointerdown', (ev) => {
  const btn = ev.target.closest('button[data-dir]');
  if (btn) { const dir = btn.dataset.dir; pressDir(dir); btn.setPointerCapture(ev.pointerId); tryPlay('jump'); }
});
dpad?.addEventListener('pointerup', (ev) => {
  const btn = ev.target.closest('button[data-dir]');
  if (btn) releaseDir(btn.dataset.dir);
});
function pressDir(dir) { activeDirs[dir] = true; attemptStep(); }
function releaseDir(dir) { activeDirs[dir] = false; }

/* trigger shock power */
btnPower?.addEventListener('click', () => { applyPowerup('shock'); });

/* ============================ SPAWN CLONE ============================ */

function spawnClone() {
  if (movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random();
  let type = 'basic';
  if (p < 0.08) type = 'wraith';
  else if (p < 0.22) type = 'fast';
  const c = new Clone(snap, type);
  clones.push(c);
  if (SETTINGS.sfx) try { ASSETS.audios.clone.currentTime = 0; ASSETS.audios.clone.play(); } catch (e) { }
  spawnParticles((c.x || player.x) * tileSize + tileSize / 2, (c.y || player.y) * tileSize + tileSize / 2, '#ff4466');
}

/* ============================ DRAW HELPERS ============================ */

function drawMaze() {
  if (mazeCache) ctx.drawImage(mazeCache, 0, 0);
  else {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      ctx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
}
function drawPowerups() {
  for (const p of powerups) {
    const bob = Math.sin((frameCount + p.bob * 60) / 18) * 3;
    const px = p.x * tileSize + tileSize * 0.5, py = p.y * tileSize + tileSize * 0.5 + bob;
    const img = (p.type === 'speed') ? ASSETS.images.power_speed : (p.type === 'cloak') ? ASSETS.images.power_cloak : ASSETS.images.power_clone;
    if (img) ctx.drawImage(img, px - tileSize * 0.32, py - tileSize * 0.32, tileSize * 0.64, tileSize * 0.64);
    else {
      ctx.fillStyle = p.type === 'speed' ? '#ffd86b' : p.type === 'cloak' ? '#7af' : '#9be7b0';
      ctx.fillRect(p.x * tileSize + tileSize * 0.2, p.y * tileSize + tileSize * 0.2, tileSize * 0.6, tileSize * 0.6);
    }
  }
}
function drawPortal() {
  if (!PORTAL) return;
  const img = ASSETS.images.portalSheet;
  if (img) {
    const colsFrames = Math.max(1, Math.floor(img.naturalWidth / tileSize));
    const frame = Math.floor(frameCount / 6) % colsFrames;
    ctx.drawImage(img, frame * tileSize, 0, tileSize, tileSize, PORTAL.x * tileSize, PORTAL.y * tileSize, tileSize, tileSize);
  } else {
    ctx.fillStyle = '#66ffcc'; ctx.fillRect(PORTAL.x * tileSize + 2, PORTAL.y * tileSize + 2, tileSize - 4, tileSize - 4);
  }
}
function drawMiniMap() {
  const mmW = miniMap.width / (window.devicePixelRatio || 1), mmH = miniMap.height / (window.devicePixelRatio || 1);
  miniCtx.clearRect(0, 0, mmW, mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
    miniCtx.fillRect(x * cw, y * ch, cw, ch);
  }
  for (const c of clones) { miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666'; miniCtx.fillRect(c.x * cw, c.y * ch, Math.max(1, cw * 0.9), Math.max(1, ch * 0.9)); }
  miniCtx.fillStyle = '#66ff99'; miniCtx.fillRect(player.x * cw, player.y * ch, Math.max(1, cw * 0.9), Math.max(1, ch * 0.9));
  for (const pu of powerups) { miniCtx.fillStyle = pu.type === 'speed' ? '#ffd86b' : pu.type === 'cloak' ? '#7af' : '#9be7b0'; miniCtx.fillRect(pu.x * cw + cw * 0.2, pu.y * ch + ch * 0.2, cw * 0.6, ch * 0.6); }
}

/* ============================ HUD & HELPERS ============================ */

function nowSec() { return Math.floor((Date.now() - startTime) / 1000); }
function updateHUD() {
  timerText.textContent = `Time: ${nowSec()}s`;
  if (activePower && Date.now() < activePower.until) {
    const rem = Math.ceil((activePower.until - Date.now()) / 1000);
    powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
  } else { powerupBox.innerHTML = ''; activePower = null; }
}
function showNotif(text, color = '#fff') {
  if (!notifArea) return;
  const el = document.createElement('div');
  el.className = 'notif';
  el.style.color = color;
  el.textContent = text;
  notifArea.appendChild(el);
  setTimeout(() => { el.style.transition = 'transform .45s, opacity .45s'; el.style.opacity = '0'; el.style.transform = 'translateY(-14px)'; setTimeout(() => el.remove(), 480); }, 1200);
}

/* ============================ MAIN LOOP & TRANSITIONS ============================ */

let lastFrameTime = performance.now();

function animate(now) {
  if (!running) return;
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  frameCount++;

  // spawn powerups rarely
  if (frameCount % 900 === 0 && Math.random() < 0.85) spawnPowerup();

  // clone spawn pacing based on level
  const interval = Math.max(8, Math.floor(cloneIntervalFrames / (1 + (LEVEL - 1) * 0.08)));
  if (frameCount % interval === 0 && movesHistory.length > 8) {
    spawnClone();
    if (Math.random() < 0.02 + (LEVEL - 1) * 0.02) spawnClone();
  }

  // update clones and collision
  for (let i = clones.length - 1; i >= 0; i--) {
    const c = clones[i];
    c.update();
    if (Math.round(c.x) === player.x && Math.round(c.y) === player.y) {
      if (!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)) {
        // die
        running = false;
        showNotif('YOU DIED', '#ff6666');
        if (SETTINGS.sfx && ASSETS.audios.clone) try { ASSETS.audios.clone.currentTime = 0; ASSETS.audios.clone.play(); } catch (e) { }
        setTimeout(() => { LEVEL = 1; resetGame(); running = true; lastFrameTime = performance.now(); requestAnimationFrame(animate); }, 900);
        return;
      }
    }
  }

  // player reached portal?
  if (PORTAL && player.x === PORTAL.x && player.y === PORTAL.y) {
    if (SETTINGS.sfx && ASSETS.audios.portal) { try { ASSETS.audios.portal.currentTime = 0; ASSETS.audios.portal.play(); } catch (e) { } }
    transitionToNextLevel();
    return;
  }

  // update particles
  updateParticles();

  // render
  ctx.clearRect(0, 0, cols * tileSize, rows * tileSize);
  drawMaze();
  drawPowerups();
  drawPortal();

  // clones
  for (const c of clones) c.draw();

  // trail
  for (let i = Math.max(0, movesHistory.length - 30); i < movesHistory.length; i++) {
    const m = movesHistory[i]; const alpha = (i - Math.max(0, movesHistory.length - 30)) / 30;
    ctx.globalAlpha = 0.05 + alpha * 0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x * tileSize + tileSize * 0.28, m.y * tileSize + tileSize * 0.28, tileSize * 0.44, tileSize * 0.44);
  }
  ctx.globalAlpha = 1;

  // draw player - use sprite if available
  const img = ASSETS.images.ninjaSheet;
  if (img) {
    const colsFrames = Math.max(1, Math.floor(img.naturalWidth / tileSize));
    const animCol = Math.floor((frameCount / 6) % colsFrames);
    const animRow = 0;
    ctx.drawImage(img, animCol * tileSize, animRow * tileSize, tileSize, tileSize, player.x * tileSize, player.y * tileSize, tileSize, tileSize);
  } else {
    // fallback: glowing circle ninja
    const px = player.rx * tileSize + tileSize / 2, py = player.ry * tileSize + tileSize / 2;
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(50,255,150,0.12)';
    ctx.fillStyle = '#66ff99';
    ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawParticles(ctx);
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}

function transitionToNextLevel() {
  running = false;
  let t = 0, dur = 22;
  function animStep() {
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI * (t / dur));
    const cx = (cols * tileSize) / 2, cy = (rows * tileSize) / 2;
    ctx.setTransform(s, 0, 0, s, - (s - 1) * cx, - (s - 1) * cy);
    drawMaze(); drawPortal(); for (const c of clones) c.draw();
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${t / dur * 0.92})`; ctx.fillRect(0, 0, cols * tileSize, rows * tileSize);
    t++;
    if (t <= dur) requestAnimationFrame(animStep);
    else { LEVEL++; resetGame(); running = true; lastFrameTime = performance.now(); requestAnimationFrame(animate); }
  }
  animStep();
}

/* ============================ AUDIO HELPER ============================ */

function tryPlay(name) {
  if (!SETTINGS.sfx) return;
  const a = ASSETS.audios[name];
  if (!a) return;
  try { a.currentTime = 0; a.play(); } catch (e) { /* ignore */ }
}

/* ============================ TINY HELPERS ============================ */

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ============================ UI BINDINGS ============================ */

startBtn?.addEventListener('click', startRun);
startBtnOverlay?.addEventListener('click', startRun);

restartBtn?.addEventListener('click', () => { LEVEL = 1; resetGame(); if (!running) { running = true; lastFrameTime = performance.now(); requestAnimationFrame(animate); } });

menuBtnHeader?.addEventListener('click', () => { document.getElementById('menu').style.display = 'block'; });

tutorialBtn?.addEventListener('click', () => { if (tutorialBox) tutorialBox.style.display = tutorialBox.style.display === 'none' ? 'block' : 'none'; });

settingsBtn?.addEventListener('click', () => { if (settingsBox) settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none'; });

/* ============================ BOOTSTRAP: preload everything and show title ============================ */

async function boot() {
  // set canvas sizing
  resizeCanvas();

  // load assets
  await preloadAll();

  // small auto-detect: if ninjaSheet available and tileSize differs, we try to match sprite frame size to tileSize
  if (ASSETS.images.ninjaSheet) {
    // nothing needed — code uses tileSize as frame size (spritesheet should be built with that tile size)
    // If your spritesheet uses a different frame dimension, update tileSize or re-export sprite sizes.
  }

  // set initial maze and show title overlay
  resetGame();
  if (titleOverlay) titleOverlay.style.display = 'flex';
  // if background music exists, don't autoplay — play must be triggered by Start Run (user gesture)
}

function startRun() {
  if (titleOverlay) titleOverlay.style.display = 'none';
  if (hud) hud.classList.remove('panel-hidden');
  try {
    if (ASSETS.audios.bg && SETTINGS.music) { ASSETS.audios.bg.currentTime = 0; ASSETS.audios.bg.play().catch(()=>{}); }
  } catch (e) { /* ignore */ }
  running = true;
  lastFrameTime = performance.now();
  requestAnimationFrame(animate);
}

/* ============================ INITIALIZE ============================ */

boot();

/* expose small debug helpers */
window.__SCG = {
  resetGame, spawnPowerup, spawnClone, ASSETS, setDifficulty: (d) => { SETTINGS.difficulty = d; resetGame(); }
};
