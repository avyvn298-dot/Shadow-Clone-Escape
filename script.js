/* script.js — Shadow Clone Escape (Complete single-file build)
   Paste this file into your repo as script.js.
   Edit ASSETS paths below if your asset filenames/paths differ.
   Built to be defensive: missing assets or missing DOM elements won't break execution.
*/

(function () {
  'use strict';

  /* =====================
     CONFIG — edit if needed
     ===================== */
  const ASSETS = {
    ninja: "assets/ninja_spritesheet.png",    // ninja spritesheet (4 frames recommended)
    clones: "assets/clones_spritesheet.png",  // clones spritesheet (3 frames recommended)
    portal: "assets/portal.png",              // portal image
    background: "background.png",             // large background (optional)
    // audio
    bgMusic: "assets/bg_music_loop.wav",
    spawnSfx: "assets/spawn.wav",
    pickupSfx: "assets/powerup.wav",
    portalSfx: "assets/portal.wav",
    deathSfx: "assets/death.wav",
    newRecordSfx: "assets/newrecord.wav"
  };

  /* =====================
     SAFE DOM references
     ===================== */
  const $ = id => document.getElementById(id);
  const gameCanvas = $('gameCanvas') || (function () { const c = document.createElement('canvas'); c.id = 'gameCanvas'; document.body.appendChild(c); return c; })();
  const miniMap = $('miniMap') || (function () { const m = document.createElement('canvas'); m.id = 'miniMap'; m.width = 140; m.height = 90; document.body.appendChild(m); return m; })();
  const startBtn = $('startBtn') || $('start-button');
  const startBtnOverlay = $('startBtnOverlay');
  const tutorialBtn = $('tutorialBtn');
  const settingsBtn = $('settingsBtn');
  const restartBtn = $('restartBtn') || $('restart-button');
  const menuBtn = $('menuBtn') || $('menuBtnHeader');
  const tutorialBox = $('tutorial') || null;
  const settingsBox = $('settings') || null;
  const musicToggleEl = $('musicToggle');
  const sfxToggleEl = $('sfxToggle');
  const difficultyEl = $('difficulty');
  const bestRecordText = $('bestRecordText');
  const statusText = $('status');
  const timerText = $('timer');
  const powerupBox = $('powerupBox');
  const mobileControls = $('mobileControls') || null;
  const joystickContainer = $('joystickContainer') || null;
  const joystickKnob = $('joystick') || null;
  const leaderboardList = $('leaderboardList') || null;
  const clearLeaderboardBtn = $('clearLeaderboard') || null;
  const titleOverlay = $('titleOverlay') || null;
  const titleCardStart = $('startBtnOverlay') || null;
  const uiPanel = $('ui') || null;

  /* =====================
     STORAGE KEYS
     ===================== */
  const STORAGE_KEY_BEST = 'sce_best_v1';
  const STORAGE_KEY_LEADER = 'sce_leader_v1';
  const STORAGE_KEY_SETTINGS = 'sce_settings_v1';

  /* =====================
     SETTINGS (with saved fallback)
     ===================== */
  let SETTINGS = {
    music: true,
    sfx: true,
    musicVolume: 0.45,
    sfxVolume: 1.0,
    difficulty: 'normal', // easy, normal, hard, nightmare
    joystickSensitivity: 0.9
  };
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS));
    if (s) SETTINGS = { ...SETTINGS, ...s };
  } catch (e) { /* ignore */ }

  function saveSettings() { try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(SETTINGS)); } catch (e) { } }

  /* =====================
     Utility helpers
     ===================== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const nowSec = (startTime) => Math.floor((Date.now() - startTime) / 1000);
  const devicePixelRatioSafe = () => (window.devicePixelRatio || 1);

  /* Logging helper */
  function log(...args) { console.log('[SCE]', ...args); }
  function warn(...args) { console.warn('[SCE]', ...args); }
  function error(...args) { console.error('[SCE]', ...args); }

  /* =====================
     ASSET LOADER (defensive)
     ===================== */
  const IMG = { ninja: null, clones: null, portal: null, background: null };
  const AUDIO = { bg: null, spawn: null, pickup: null, portal: null, death: null, newRecord: null };

  function loadImageSafe(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => { resolve(null); };
      image.src = src;
    });
  }

  function loadAudioSafe(src) {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      try {
        const a = new Audio();
        a.preload = 'auto';
        a.oncanplaythrough = () => resolve(a);
        a.onerror = () => resolve(null);
        a.src = src;
      } catch (e) { resolve(null); }
    });
  }

  async function preloadAssets(showProgress = false) {
    if (showProgress) {
      // show simple inline loader
      if (!titleOverlay) {
        const div = document.createElement('div'); div.id = 'titleOverlay'; div.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;z-index:9999;color:#fff;font-family:sans-serif'; div.textContent = 'Loading assets...'; document.body.appendChild(div);
      } else { titleOverlay.style.display = 'flex'; titleOverlay.textContent = 'Loading assets...'; }
    }

    const tasks = [];
    tasks.push(loadImageSafe(ASSETS.ninja).then(img => { IMG.ninja = img; if (img) log('Loaded ninja image'); else warn('Missing ninja image: fallback used'); }));
    tasks.push(loadImageSafe(ASSETS.clones).then(img => { IMG.clones = img; if (img) log('Loaded clones image'); else warn('Missing clones image'); }));
    tasks.push(loadImageSafe(ASSETS.portal).then(img => { IMG.portal = img; if (img) log('Loaded portal image'); else warn('Missing portal image'); }));
    tasks.push(loadImageSafe(ASSETS.background).then(img => { IMG.background = img; if (img) log('Loaded background'); else log('No background found, using gradient'); }));

    tasks.push(loadAudioSafe(ASSETS.bgMusic).then(a => { AUDIO.bg = a; if (a) log('Loaded bg audio'); else warn('Missing bg audio'); }));
    tasks.push(loadAudioSafe(ASSETS.spawnSfx).then(a => { AUDIO.spawn = a; }));
    tasks.push(loadAudioSafe(ASSETS.pickupSfx).then(a => { AUDIO.pickup = a; }));
    tasks.push(loadAudioSafe(ASSETS.portalSfx).then(a => { AUDIO.portal = a; }));
    tasks.push(loadAudioSafe(ASSETS.deathSfx).then(a => { AUDIO.death = a; }));
    tasks.push(loadAudioSafe(ASSETS.newRecordSfx).then(a => { AUDIO.newRecord = a; }));

    await Promise.all(tasks);

    if (AUDIO.bg) { AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.musicVolume; }
    if (AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfxVolume;
    if (AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfxVolume;
    if (AUDIO.portal) AUDIO.portal.volume = SETTINGS.sfxVolume;
    if (AUDIO.death) AUDIO.death.volume = SETTINGS.sfxVolume;
    if (AUDIO.newRecord) AUDIO.newRecord.volume = SETTINGS.sfxVolume;

    if (titleOverlay) titleOverlay.style.display = 'none';
    log('Assets preloaded (with fallbacks where missing)');
  }

  function safePlay(audio, vol = 1) {
    if (!audio || typeof audio.play !== 'function') return;
    try { audio.volume = vol; audio.currentTime = 0; audio.play().catch(() => { /* autoplay blocked */ }); } catch (e) { /* ignore */ }
  }

  /* =====================
     CANVAS SIZING + GRID
     ===================== */
  const ctx = gameCanvas.getContext('2d');
  const miniCtx = miniMap.getContext('2d');

  let pixelRatio = devicePixelRatioSafe();
  let canvasWidthCss = Math.min(window.innerWidth - 40, 980);
  let canvasHeightCss = Math.min(window.innerHeight - 160, 720);

  let cols = 19, rows = 19, tileSize = 30;
  function recomputeGrid() {
    pixelRatio = devicePixelRatioSafe();
    // pick canvas css width depending on viewport
    canvasWidthCss = Math.min(window.innerWidth - 40, 980);
    canvasHeightCss = Math.min(window.innerHeight - 160, 720);
    const width = Math.min(canvasWidthCss, canvasHeightCss * (4 / 3));
    gameCanvas.style.width = width + 'px';
    const logicalW = Math.floor(width);
    const logicalH = Math.floor(logicalW * (3 / 4));
    gameCanvas.width = Math.floor(logicalW * pixelRatio);
    gameCanvas.height = Math.floor(logicalH * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // minimap size
    miniMap.width = 280 * pixelRatio;
    miniMap.height = 180 * pixelRatio;
    miniMap.style.width = '140px';
    miniMap.style.height = '90px';
    miniCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // compute cols/rows
    const cssW = gameCanvas.clientWidth || logicalW;
    const cssH = gameCanvas.clientHeight || logicalH;
    const preferred = window.innerWidth < 720 ? 26 : 30;
    cols = Math.max(11, Math.floor(cssW / preferred));
    rows = Math.max(11, Math.floor(cssH / preferred));
    if (cols % 2 === 0) cols--;
    if (rows % 2 === 0) rows--;
    tileSize = Math.floor(Math.min(cssW / cols, cssH / rows));
  }
  window.addEventListener('resize', () => { recomputeGrid(); cacheMaze(); });

  /* =====================
     MAZE GENERATOR (recursive backtracker)
     ===================== */
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
    // safe start area
    grid[1][1] = 0; if (grid[1][2] !== undefined) grid[1][2] = 0; if (grid[2]) grid[2][1] = 0;
    return grid;
  }

  // caching the maze to offscreen canvas for performance
  let maze = [];
  let mazeCache = null;
  function cacheMaze() {
    if (!maze || !Array.isArray(maze) || maze.length === 0) return;
    // create offscreen canvas
    mazeCache = document.createElement('canvas');
    mazeCache.width = cols * tileSize;
    mazeCache.height = rows * tileSize;
    const mctx = mazeCache.getContext('2d');

    // draw stylized maze: neon walls + floor gradient
    const floor = mctx.createLinearGradient(0, 0, mazeCache.width, mazeCache.height);
    floor.addColorStop(0, '#080a0d'); floor.addColorStop(1, '#06060a');
    mctx.fillStyle = floor; mctx.fillRect(0, 0, mazeCache.width, mazeCache.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (maze[y] === undefined || typeof maze[y][x] === 'undefined') continue;
        if (maze[y][x] === 1) {
          // wall block with subtle bevel
          mctx.fillStyle = '#1f1f1f';
          mctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          mctx.fillStyle = 'rgba(255,255,255,0.02)';
          mctx.fillRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
          // neon border
          mctx.strokeStyle = 'rgba(40,200,255,0.06)';
          mctx.lineWidth = 1;
          mctx.strokeRect(x * tileSize + 0.5, y * tileSize + 0.5, tileSize - 1, tileSize - 1);
        } else {
          // floor tile
          mctx.fillStyle = '#070707';
          mctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  /* =====================
     GAME STATE & VARIABLES
     ===================== */
  let player, clones = [], movesHistory = [], powerups = [], particles = [];
  let frameCount = 0, cloneInterval = 300, running = false, startTime = 0, activePower = null;
  let bestTime = Number(localStorage.getItem(STORAGE_KEY_BEST)) || 0;
  let PORTAL = null;
  let currentLevel = 0;

  /* =====================
     POWERUPS
     ===================== */
  const POWER_TYPES = ['speed', 'cloak', 'shock'];
  function spawnPowerup() {
    let attempts = 0;
    while (attempts++ < 200) {
      const x = randInt(1, cols - 2);
      const y = randInt(1, rows - 2);
      if (maze[y] && maze[y][x] === 0 && !(x === player.x && y === player.y) && !powerups.some(p => p.x === x && p.y === y)) {
        powerups.push({ x, y, type: POWER_TYPES[randInt(0, POWER_TYPES.length - 1)], bob: Math.random() * Math.PI * 2, spawned: Date.now() });
        break;
      }
    }
  }
  function applyPowerup(type) {
    if (type === 'speed') activePower = { type: 'speed', until: Date.now() + 4500 };
    else if (type === 'cloak') activePower = { type: 'cloak', until: Date.now() + 5000 };
    else if (type === 'shock') {
      const radius = 5;
      clones.forEach(c => {
        const dx = Math.abs(c.x - player.x), dy = Math.abs(c.y - player.y);
        if (dx + dy <= radius) c.index = Math.max(0, c.index - 28);
      });
      if (SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
    }
    if (SETTINGS.sfx && AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfxVolume);
    showToast(`Power: ${type.toUpperCase()}`);
  }

  /* =====================
     PARTICLES
     ===================== */
  function spawnParticles(px, py, color, count = 22) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: px + (Math.random() - 0.5) * tileSize,
        y: py + (Math.random() - 0.5) * tileSize,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 30 + Math.random() * 40, color
      });
    }
  }
  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06;
      p.vx *= 0.995; p.vy *= 0.995; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  /* =====================
     CLONE CLASS
     ===================== */
  class Clone {
    constructor(path, type = 'basic') {
      this.path = path.slice();
      this.index = 0;
      this.type = type;
      this.spawnFrame = frameCount;
      this.x = this.path[0]?.x ?? 1;
      this.y = this.path[0]?.y ?? 1;
      this.frozen = false;
      this.color = type === 'wraith' ? 'magenta' : (type === 'fast' ? 'orange' : 'crimson');
    }
    update() {
      if (this.frozen) return;
      if (this.type === 'fast') this.index += 1 + (Math.random() < 0.45 ? 1 : 0);
      else if (this.type === 'wraith') {
        if (Math.random() < 0.01 + Math.min(0.05, frameCount / 60000)) {
          const jump = Math.min(50, Math.floor(Math.random() * Math.min(200, this.path.length)));
          this.index = Math.min(this.path.length - 1, this.index + jump);
        } else this.index++;
      } else this.index++;
      if (this.index < this.path.length) {
        this.x = this.path[this.index].x;
        this.y = this.path[this.index].y;
      }
    }
    draw(ctx) {
      const age = frameCount - this.spawnFrame;
      const alpha = Math.max(0.35, Math.min(1, 0.6 + Math.sin(age / 10) * 0.2));
      ctx.globalAlpha = alpha;
      if (IMG.clones) {
        // determine sprite column (0 basic, 1 fast, 2 wraith)
        const tIndex = (this.type === 'wraith') ? 2 : (this.type === 'fast' ? 1 : 0);
        const frameW = Math.floor(IMG.clones.naturalWidth / 3);
        const frameH = IMG.clones.naturalHeight;
        ctx.drawImage(IMG.clones, tIndex * frameW, 0, frameW, frameH, this.x * tileSize, this.y * tileSize, tileSize, tileSize);
      } else {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x * tileSize + 2, this.y * tileSize + 2, tileSize - 4, tileSize - 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* =====================
     PLAYER, INPUT & STEPPING
     ===================== */
  let activeDirs = { up: false, down: false, left: false, right: false };
  let lastStepTime = 0;
  let stepMsBase = 140;

  document.addEventListener('keydown', (e) => {
    if (!running) return;
    const key = e.key;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') { activeDirs.up = true; stepPlayer(); playFootstep(); }
    if (key === 'ArrowDown' || key === 's' || key === 'S') { activeDirs.down = true; stepPlayer(); playFootstep(); }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') { activeDirs.left = true; stepPlayer(); playFootstep(); }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { activeDirs.right = true; stepPlayer(); playFootstep(); }
    if (key === ' ') applyPowerup('shock');
    if (key === 'Escape') { running = !running; if (!running) { /* pause visual effect */ } else { requestAnimationFrame(animate); } }
  });
  document.addEventListener('keyup', (e) => {
    const key = e.key;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') activeDirs.up = false;
    if (key === 'ArrowDown' || key === 's' || key === 'S') activeDirs.down = false;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') activeDirs.left = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') activeDirs.right = false;
  });

  function playFootstep() { if (SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); }

  function stepPlayer() {
    const now = performance.now();
    const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
    const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (difficultyValue() - 1) * 10));
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
      // pickup
      for (let i = powerups.length - 1; i >= 0; i--) {
        if (powerups[i].x === nx && powerups[i].y === ny) {
          applyPowerup(powerups[i].type);
          powerups.splice(i, 1);
        }
      }
      // portal
      if (PORTAL && nx === PORTAL.x && ny === PORTAL.y) {
        transitionToNextLevel();
      }
    }
  }

  /* Mobile joystick (pointer-based) */
  let joystickPointer = null;
  let joystickOrigin = { x: 0, y: 0 };
  let joystickPos = { x: 0, y: 0 };
  const joystickMax = 48;

  function initJoystick() {
    if (!joystickContainer || !joystickKnob) return;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) { joystickContainer.style.display = 'none'; return; }
    joystickContainer.style.display = 'block';

    joystickContainer.addEventListener('pointerdown', (ev) => {
      joystickContainer.setPointerCapture(ev.pointerId);
      joystickPointer = ev.pointerId;
      const rect = joystickContainer.getBoundingClientRect();
      joystickOrigin.x = rect.left + rect.width / 2;
      joystickOrigin.y = rect.top + rect.height / 2;
      updateJoystick(ev.clientX, ev.clientY);
    });
    joystickContainer.addEventListener('pointermove', (ev) => {
      if (joystickPointer !== ev.pointerId) return;
      updateJoystick(ev.clientX, ev.clientY);
    });
    joystickContainer.addEventListener('pointerup', (ev) => {
      if (joystickPointer !== ev.pointerId) return;
      joystickPointer = null; joystickPos = { x: 0, y: 0 }; joystickKnob.style.transform = `translate(0px,0px)`;
      activeDirs = { up: false, down: false, left: false, right: false };
    });
    joystickContainer.addEventListener('pointercancel', () => {
      joystickPointer = null; joystickPos = { x: 0, y: 0 }; joystickKnob.style.transform = `translate(0px,0px)`;
      activeDirs = { up: false, down: false, left: false, right: false };
    });
  }
  function updateJoystick(cx, cy) {
    const dx = cx - joystickOrigin.x, dy = cy - joystickOrigin.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const r = Math.min(dist, joystickMax) * SETTINGS.joystickSensitivity;
    joystickPos.x = nx * r; joystickPos.y = ny * r;
    if (joystickKnob) joystickKnob.style.transform = `translate(${joystickPos.x}px, ${joystickPos.y}px)`;
    activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
    activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
    activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
    activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
    stepPlayer();
  }

  /* =====================
     CLONE SPAWNING
     ===================== */
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
    if (SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume);
    spawnParticles((c.x) * tileSize + tileSize / 2, (c.y) * tileSize + tileSize / 2, '#ff4466');
  }

  /* =====================
     GAME OVER / LEADERBOARD
     ===================== */
  function gameOver() {
    running = false;
    try { if (SETTINGS.music && AUDIO.bg) AUDIO.bg.pause(); } catch (e) { }
    if (SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVolume);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const prevBest = Number(localStorage.getItem(STORAGE_KEY_BEST)) || 0;
    if (elapsed > prevBest) {
      localStorage.setItem(STORAGE_KEY_BEST, elapsed);
      if (SETTINGS.sfx && AUDIO.newRecord) safePlay(AUDIO.newRecord, SETTINGS.sfxVolume);
      showToast(`NEW BEST: ${elapsed}s`);
      addToLeaderboard(elapsed);
    } else {
      showToast(`You survived ${elapsed}s`);
    }
    // show restart UI if available
    if (restartBtn) restartBtn.style.display = 'inline-block';
    if (menuBtn) menuBtn.style.display = 'inline-block';
  }

  function addToLeaderboard(time) {
    try {
      let list = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADER) || '[]');
      let name = prompt('New high score! Enter your name (max 12 chars):', 'Player') || 'Player';
      name = name.slice(0, 12);
      list.push({ name, time });
      list.sort((a, b) => b.time - a.time);
      localStorage.setItem(STORAGE_KEY_LEADER, JSON.stringify(list.slice(0, 50)));
      updateLeaderboardUI();
    } catch (e) { warn('addToLeaderboard error', e); }
  }
  function updateLeaderboardUI() {
    try {
      if (!leaderboardList) return;
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADER) || '[]');
      leaderboardList.innerHTML = '';
      list.slice(0, 10).forEach(it => {
        const li = document.createElement('li'); li.textContent = `${it.name} — ${it.time}s`; leaderboardList.appendChild(li);
      });
    } catch (e) { warn('updateLeader UI fail', e); }
  }
  if (clearLeaderboardBtn) clearLeaderboardBtn.addEventListener('click', () => { if (confirm('Clear local leaderboard?')) { localStorage.removeItem(STORAGE_KEY_LEADER); updateLeaderboardUI(); } });

  /* =====================
     DRAW HELPERS
     ===================== */
  function drawMaze() {
    if (!maze) return;
    if (mazeCache) { ctx.drawImage(mazeCache, 0, 0); return; }
    // fallback
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (maze[y] && maze[y][x] === 1) {
          ctx.fillStyle = '#2e2e2e';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        } else {
          ctx.fillStyle = '#0f0f0f';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }

  function drawPowerups(now) {
    for (const pu of powerups) {
      const cx = pu.x * tileSize + tileSize / 2, cy = pu.y * tileSize + tileSize / 2 + Math.sin((frameCount + pu.bob) * 0.12) * 3;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(frameCount / 18 + pu.bob) * 0.08);
      if (pu.type === 'speed') { ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(0, 0, tileSize * 0.24, 0, Math.PI * 2); ctx.fill(); }
      else if (pu.type === 'cloak') { ctx.fillStyle = '#9be7b0'; ctx.fillRect(-tileSize * 0.2, -tileSize * 0.2, tileSize * 0.4, tileSize * 0.4); }
      else { ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(0, -tileSize * 0.22); ctx.lineTo(tileSize * 0.14, 0); ctx.lineTo(-tileSize * 0.14, 0); ctx.fill(); }
      ctx.restore();
    }
  }

  function drawPortal(now) {
    if (!PORTAL) return;
    const px = PORTAL.x * tileSize + tileSize / 2, py = PORTAL.y * tileSize + tileSize / 2;
    const scale = 0.9 + 0.08 * Math.sin(now / 280);
    const rot = (now / 1400) % (Math.PI * 2);
    if (IMG.portal) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now / 320);
      const s = tileSize * scale; ctx.drawImage(IMG.portal, -s / 2, -s / 2, s, s); ctx.restore();
    } else {
      ctx.save(); ctx.translate(px, py); ctx.rotate(rot / 1.8); ctx.fillStyle = '#66ffcc'; ctx.beginPath(); ctx.ellipse(0, 0, tileSize * 0.42, tileSize * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  function drawMiniMap() {
    const mmW = miniMap.width / pixelRatio, mmH = miniMap.height / pixelRatio;
    miniCtx.clearRect(0, 0, mmW, mmH);
    const cw = mmW / cols, ch = mmH / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        miniCtx.fillStyle = maze[y] && maze[y][x] === 1 ? '#222' : '#070707';
        miniCtx.fillRect(x * cw, y * ch, cw, ch);
      }
    }
    for (const c of clones) {
      miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
      miniCtx.fillRect(c.x * cw, c.y * ch, Math.max(1, cw * 0.9), Math.max(1, ch * 0.9));
    }
    miniCtx.fillStyle = '#66ff99';
    miniCtx.fillRect(player.x * cw, player.y * ch, Math.max(1, cw * 0.9), Math.max(1, ch * 0.9));
    for (const pu of powerups) {
      miniCtx.fillStyle = pu.type === 'speed' ? '#4fd1ff' : pu.type === 'cloak' ? '#9be7b0' : '#bfe8ff';
      miniCtx.fillRect(pu.x * cw + cw * 0.2, pu.y * ch + ch * 0.2, cw * 0.6, ch * 0.6);
    }
  }

  function drawPlayer(now) {
    if (!player) return;
    if (IMG.ninja) {
      const frameCountAnim = Math.floor((frameCount / 8) % 4); // 4 frames
      const frameW = Math.floor(IMG.ninja.naturalWidth / 4);
      const frameH = IMG.ninja.naturalHeight;
      const sx = frameCountAnim * frameW, sy = 0;
      ctx.drawImage(IMG.ninja, sx, sy, frameW, frameH, player.rx * tileSize, player.ry * tileSize, tileSize, tileSize);
    } else {
      const px = player.rx * tileSize + tileSize / 2, py = player.ry * tileSize + tileSize / 2;
      const pulse = 0.9 + Math.sin(Date.now() / 420) * 0.08;
      ctx.save(); ctx.shadowBlur = 18 * pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color || '#66ff99';
      ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  /* =====================
     HUD & utility UI
     ===================== */
  function updateHUD() {
    if (timerText) timerText.textContent = `Time: ${Math.floor((Date.now() - startTime) / 1000)}s`;
    if (bestRecordText) {
      const b = Number(localStorage.getItem(STORAGE_KEY_BEST)) || 0;
      bestRecordText.textContent = b ? `Best: ${b}s` : 'Best: —';
    }
    if (powerupBox) {
      if (activePower && Date.now() < activePower.until) {
        const rem = Math.ceil((activePower.until - Date.now()) / 1000);
        powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
      } else {
        powerupBox.innerHTML = '';
        if (activePower && Date.now() >= activePower.until) activePower = null;
      }
    }
  }

  function showToast(text) {
    // create a toast at top-right of screen
    const el = document.createElement('div');
    el.className = 'sce-toast';
    el.textContent = text;
    el.style.cssText = 'position:fixed;right:16px;top:16px;background:rgba(0,0,0,0.6);color:#fff;padding:8px 12px;border-radius:8px;font-family:sans-serif;z-index:9999;opacity:1;transition:all .45s';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-12px)'; setTimeout(() => el.remove(), 480); }, 1600);
  }

  /* =====================
     MAIN ANIMATION LOOP
     ===================== */
  let lastFrame = performance.now();
  function animate(now) {
    if (!running) return;
    const dt = (now - lastFrame) / 1000; lastFrame = now; frameCount++;

    // spawn powerups occasionally
    if (frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

    // clone spawn pacing
    const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + difficultyValue() * 0.6)));
    if (frameCount % intervalFrames === 0 && movesHistory.length > 8) {
      spawnClone();
      if (cloneInterval > 30) cloneInterval -= 1 + (difficultyValue());
      if (Math.random() < 0.02 + (difficultyValue() - 1) * 0.03) spawnClone();
    }

    // update clones & collisions
    for (let i = clones.length - 1; i >= 0; i--) {
      const c = clones[i];
      c.update();
      if (Math.round(c.x) === player.x && Math.round(c.y) === player.y) {
        if (!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)) {
          // death
          running = false;
          if (SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVolume);
          showToast('☠️ You Died');
          spawnParticles(player.rx * tileSize + tileSize / 2, player.ry * tileSize + tileSize / 2, '#ffcc66', 40);
          setTimeout(() => { gameOver(); }, 800);
          return;
        }
      }
    }

    updateParticles();

    // render pipeline
    ctx.clearRect(0, 0, gameCanvas.width / pixelRatio, gameCanvas.height / pixelRatio);
    // background
    if (IMG.background) {
      const w = gameCanvas.clientWidth, h = gameCanvas.clientHeight;
      const t = Date.now() / 12000;
      const xoff = Math.sin(t) * 36;
      ctx.drawImage(IMG.background, -40 + xoff, -20, w + 80, h + 40);
    } else {
      const g = ctx.createLinearGradient(0, 0, gameCanvas.width / pixelRatio, gameCanvas.height / pixelRatio);
      g.addColorStop(0, '#071018'); g.addColorStop(1, '#03040a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, gameCanvas.width / pixelRatio, gameCanvas.height / pixelRatio);
    }

    // maze
    drawMaze();

    // powerups
    drawPowerups(now);

    // clones
    for (const c of clones) c.draw(ctx);

    // smooth player rendering
    const speed = 12 + difficultyValue() * 6;
    const t = Math.min(1, dt * speed);
    player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
    player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

    // trail
    for (let i = Math.max(0, movesHistory.length - 30); i < movesHistory.length; i++) {
      const m = movesHistory[i];
      const alpha = (i - Math.max(0, movesHistory.length - 30)) / 30;
      ctx.globalAlpha = 0.05 + alpha * 0.25;
      ctx.fillStyle = '#33ff77';
      ctx.fillRect(m.x * tileSize + tileSize * 0.28, m.y * tileSize + tileSize * 0.28, tileSize * 0.44, tileSize * 0.44);
    }
    ctx.globalAlpha = 1;

    // player
    drawPlayer(now);

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 70);
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    // portal
    drawPortal(now);

    // minimap & HUD
    drawMiniMap();
    updateHUD();

    requestAnimationFrame(animate);
  }

  /* =====================
     DIFFICULTY mapping
     ===================== */
  function difficultyValue() {
    switch (SETTINGS.difficulty) {
      case 'easy': return 0.8;
      case 'normal': return 1;
      case 'hard': return 1.6;
      case 'nightmare': return 2.2;
      default: return 1;
    }
  }

  /* =====================
     LEVEL start / reset / transitions
     ===================== */
  function placePortal() {
    let best = null, bestd = -1;
    for (let y = rows - 2; y >= 1; y--) {
      for (let x = cols - 2; x >= 1; x--) {
        if (maze[y] && maze[y][x] === 0 && !(x === 1 && y === 1)) {
          const d = Math.abs(x - 1) + Math.abs(y - 1);
          if (d > bestd) { bestd = d; best = { x, y }; }
        }
      }
    }
    PORTAL = best || { x: cols - 2, y: rows - 2 };
  }

  function resetGame() {
    saveSettings();
    recomputeGrid(); // ensures tileSize is correct
    maze = generateMaze(cols, rows);
    cacheMaze();
    player = { x: 1, y: 1, rx: 1, ry: 1, radius: Math.max(6, tileSize * 0.36), color: '#66ff99' };
    movesHistory = [];
    clones = [];
    powerups = [];
    particles = [];
    frameCount = 0;
    cloneInterval = 300 - (difficultyValue() * 80);
    if (cloneInterval < 50) cloneInterval = 50;
    running = true;
    startTime = Date.now();
    bestTime = Number(localStorage.getItem(STORAGE_KEY_BEST)) || 0;
    if (bestRecordText) bestRecordText.textContent = bestTime ? `Best: ${bestTime}s` : 'Best: —';
    if (statusText) statusText.textContent = 'Survive as long as you can';
    if (timerText) timerText.textContent = 'Time: 0s';
    if (restartBtn) restartBtn.style.display = 'none';
    if (menuBtn) menuBtn.style.display = 'none';
    placePortal();
  }

  function transitionToNextLevel() {
    running = false;
    if (SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume);
    let t = 0; const dur = 36;
    function anim() {
      ctx.save();
      const s = 1 + 0.08 * Math.sin(Math.PI * (t / dur));
      const cx = (cols * tileSize) / 2, cy = (rows * tileSize) / 2;
      ctx.setTransform(s, 0, 0, s, -(s - 1) * cx, -(s - 1) * cy);
      // draw simple zoom & fade
      if (IMG.background) {
        ctx.drawImage(IMG.background, -40, -20, gameCanvas.clientWidth + 80, gameCanvas.clientHeight + 40);
      }
      if (mazeCache) ctx.drawImage(mazeCache, 0, 0);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${(t / dur) * 0.96})`; ctx.fillRect(0, 0, cols * tileSize, rows * tileSize);
      t++;
      if (t <= dur) requestAnimationFrame(anim);
      else {
        currentLevel = Math.min(currentLevel + 1, 5);
        resetGame();
        showToast(`Level Up! ${currentLevel + 1}`);
      }
    }
    anim();
  }

  /* =====================
     tick loop for held keys
     ===================== */
  let lastTick = 0;
  function tickLoop() {
    if (!running) return;
    const now = performance.now();
    if (now - lastTick > 120) {
      if (activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer();
      lastTick = now;
    }
    requestAnimationFrame(tickLoop);
  }
  tickLoop();

  /* =====================
     SAFE UI wiring
     ===================== */
  function wireUI() {
    if (startBtn) startBtn.addEventListener('click', () => { startRun(); });
    if (startBtnOverlay) startBtnOverlay.addEventListener('click', () => { startRun(); });
    if (tutorialBtn) tutorialBtn.addEventListener('click', () => { if (tutorialBox) tutorialBox.style.display = tutorialBox.style.display === 'none' ? 'block' : 'none'; });
    if (settingsBtn) settingsBtn.addEventListener('click', () => { if (settingsBox) settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none'; });

    if (restartBtn) restartBtn.addEventListener('click', () => { resetGame(); if (SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume); requestAnimationFrame(animate); });
    if (menuBtn) menuBtn.addEventListener('click', () => { running = false; if (menuBtn) { showMainMenu(); } try { if (AUDIO.bg) AUDIO.bg.pause(); } catch (e) { } });

    if (musicToggleEl) musicToggleEl.checked = SETTINGS.music;
    if (sfxToggleEl) sfxToggleEl.checked = SETTINGS.sfx;
    if (difficultyEl) difficultyEl.value = SETTINGS.difficulty;

    musicToggleEl && musicToggleEl.addEventListener('change', () => { SETTINGS.music = musicToggleEl.checked; saveSettings(); if (!SETTINGS.music) try { AUDIO.bg && AUDIO.bg.pause(); } catch (e) { } });
    sfxToggleEl && sfxToggleEl.addEventListener('change', () => { SETTINGS.sfx = sfxToggleEl.checked; saveSettings(); });
    difficultyEl && difficultyEl.addEventListener('input', () => { SETTINGS.difficulty = difficultyEl.value; saveSettings(); });

    clearLeaderboardBtn && clearLeaderboardBtn.addEventListener('click', () => { if (confirm('Clear local leaderboard?')) { localStorage.removeItem(STORAGE_KEY_LEADER); updateLeaderboardUI(); } });

    // show/hide title overlay on click
    if (titleOverlay) titleOverlay.addEventListener('click', () => { titleOverlay.style.display = 'none'; });
  }

  function showMainMenu() {
    const menu = $('menu');
    if (menu) menu.style.display = 'block';
    // hide UI
    if (uiPanel) uiPanel.classList.add('panel-hidden');
    if (mobileControls) mobileControls.classList.add('hidden');
  }

  function startRun() {
    saveSettings();
    if ($('menu')) $('menu').style.display = 'none';
    tutorialBox && (tutorialBox.style.display = 'none');
    settingsBox && (settingsBox.style.display = 'none');
    if (uiPanel) uiPanel.classList.remove('panel-hidden');
    titleOverlay && (titleOverlay.style.display = 'none');
    recomputeGrid(); resetGame();
    if (SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
    if (window.innerWidth <= 720 && mobileControls) mobileControls.classList.remove('hidden');
    lastFrame = performance.now();
    requestAnimationFrame(animate);
  }

  /* =====================
     small synth fallback when audio missing (tone brief)
     ===================== */
  function synthOnce(kind = 'beep', volume = 0.6) {
    try {
      const ctxA = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = 'sine';
      o.frequency.value = kind === 'death' ? 80 : kind === 'portal' ? 520 : 440;
      g.gain.value = volume * 0.08;
      o.connect(g); g.connect(ctxA.destination);
      o.start(); setTimeout(() => { o.stop(); ctxA.close(); }, 160);
    } catch (e) { /* ignore */ }
  }

  /* =====================
     INIT / BOOT sequence
     ===================== */
  function init() {
    recomputeGrid();
    wireUI();
    initJoystick();
    updateLeaderboardUI();
    preloadAssets(true).then(() => {
      // compute sprite metadata if available
      if (IMG.ninja) {
        // nothing required here; drawPlayer will adapt using image naturalWidth
      }
      // initial simple render so user doesn't see blank page
      ctx.fillStyle = '#001'; ctx.fillRect(0, 0, gameCanvas.width / pixelRatio, gameCanvas.height / pixelRatio);
      ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText('Shadow Clone Escape — Ready. Click Start', 24, 48);
      // if start button not present, auto-start after preloading
      if (!startBtn && !startBtnOverlay) {
        setTimeout(() => { startRun(); }, 300);
      }
    }).catch(e => { warn('preload failed', e); startRun(); });
  }

  /* =====================
     helper: difficulty mapping for pace
     ===================== */
  function difficultyValue() {
    switch (SETTINGS.difficulty) {
      case 'easy': return 0.9;
      case 'normal': return 1;
      case 'hard': return 1.6;
      case 'nightmare': return 2.2;
      default: return 1;
    }
  }

  /* =====================
     small helpers used by external pieces
     ===================== */
  function updateLeaderboardUI() {
    try {
      if (!leaderboardList) return;
      leaderboardList.innerHTML = '';
      const list = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADER) || '[]');
      list.slice(0, 10).forEach(it => {
        const li = document.createElement('li'); li.textContent = `${it.name} — ${it.time}s`;
        leaderboardList.appendChild(li);
      });
    } catch (e) { }
  }

  // Expose a small debug API (optional)
  window.SCE = {
    resetGame, startRun, preloadAssets, IMG, AUDIO, settings: SETTINGS
  };

  /* =====================
     Kickoff
     ===================== */
  init();

})();
