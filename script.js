/*
  Shadow Clone Escape — script.js (AAA-features prototype)
  - Single-file game logic, UI wiring, defensive asset loading.
  - Replace assets in ASSETS if you have images / audio.
*/

(function () {
  'use strict';

  /* =========================
     CONFIG / ASSETS (edit paths if needed)
     ========================= */
  const ASSETS = {
    ninja: 'assets/ninja_spritesheet.png',    // 4 frames across
    clones: 'assets/clones_spritesheet.png',  // 3 types across
    portal: 'assets/portal.png',
    background: 'background.png',
    // audio (if missing, synth fallback will be used)
    bgMusic: 'assets/bg_music_loop.wav',
    sfxSpawn: 'assets/spawn.wav',
    powerup: 'assets/powerup.wav',
    sfxPortal: 'assets/portal.wav',
    sfxDeath: 'assets/death.wav'
  };

  /* =========================
     STORAGE KEYS
     ========================= */
  const KEY_SETTINGS = 'sce_settings_v3';
  const KEY_LEADER = 'sce_leader_v3';
  const KEY_BEST = 'sce_best_v3';

  /* =========================
     SAFE DOM refs
     ========================= */
  const $ = id => document.getElementById(id);
  const loadingOverlay = $('loading');
  const loaderProgress = $('loader-progress');
  const loadingStatus = $('loading-status');

  const mainMenu = $('mainMenu');
  const btnStart = $('btnStart');
  const btnHow = $('btnHow');
  const btnLeaderboard = $('btnLeaderboard');
  const btnSettings = $('btnSettings');

  const gameWrap = $('gameWrap');
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const miniMap = $('miniMap');
  const miniCtx = miniMap.getContext('2d');

  const hudLevel = $('hud-level');
  const hudLives = $('hud-lives');
  const hudTime = $('hud-time');
  const hudScore = $('hud-score');
  const powerupBox = $('powerupBox');

  const overlayHow = $('overlayHow');
  const overlaySettings = $('overlaySettings');
  const overlayLeaderboard = $('overlayLeaderboard');
  const overlayPause = $('overlayPause');
  const overlayGameOver = $('overlayGameOver');

  const btnPause = $('btnPause');
  const btnRestart = $('btnRestart');
  const btnMenu = $('btnMenu');
  const btnResume = $('btnResume');
  const btnQuitToMenu = $('btnQuitToMenu');
  const btnGameOverRestart = $('btnGameOverRestart');

  // Settings inputs
  const toggleMusic = $('toggleMusic');
  const toggleSfx = $('toggleSfx');
  const musicVol = $('musicVol');
  const sfxVol = $('sfxVol');
  const difficultySelect = $('difficulty');
  const btnSaveSettings = $('btnSaveSettings');

  const leaderboardList = $('leaderboardList');
  const btnClearLeaderboard = $('btnClearLeaderboard');

  // audio elements
  const audioBg = $('bgMusic');
  const audioSpawn = $('sfxSpawn');
  const audioPickup = $('sfxPickup');
  const audioPortal = $('sfxPortal');
  const audioDeath = $('sfxDeath');
  const audioNewRecord = $('sfxNewRecord');

  // joystick
  const joystickEl = $('mobileJoystick');
  const joystickKnob = joystickEl ? joystickEl.querySelector('.joystick-knob') : null;

  // defensive presence check
  function safe(el, fallback) { return el || fallback; }

  /* =========================
     SETTINGS & STATE
     ========================= */
  let SETTINGS = {
    music: true, sfx: true, musicVolume: 0.45, sfxVolume: 1.0,
    difficulty: 'normal', joystickSensitivity: 0.9
  };
  try {
    const s = JSON.parse(localStorage.getItem(KEY_SETTINGS));
    if (s) SETTINGS = Object.assign(SETTINGS, s);
  } catch (e) { /* ignore */ }

  function saveSettings() {
    try { localStorage.setItem(KEY_SETTINGS, JSON.stringify(SETTINGS)); } catch (e) {}
  }

  let STATE = {
    maze: null, cols: 21, rows: 21, tile: 32,
    player: null, clones: [], powerups: [], particles: [],
    running: false, startTime: 0, frame: 0, level: 0, lives: 3, score: 0,
    best: Number(localStorage.getItem(KEY_BEST)) || 0,
    leader: JSON.parse(localStorage.getItem(KEY_LEADER) || '[]')
  };

  /* =========================
     UTILS
     ========================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const now = () => Date.now();
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  /* =========================
     ASSET LOADER (defensive)
     ========================= */
  const IMG = { ninja: null, clones: null, portal: null, background: null };
  async function loadImage(src) {
    if (!src) return null;
    return new Promise((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    });
  }

  async function loadAudio(el, src) {
    if (!el || !src) return null;
    return new Promise((res) => {
      el.src = src;
      el.oncanplaythrough = () => res(el);
      el.onerror = () => res(null);
      // if browser blocks autoplay, playback will be controlled on first user gesture
    });
  }

  async function preloadAll() {
    loadingStatus.textContent = 'Loading images…';
    const tasks = [
      loadImage(ASSETS.ninja).then(i => IMG.ninja = i),
      loadImage(ASSETS.clones).then(i => IMG.clones = i),
      loadImage(ASSETS.portal).then(i => IMG.portal = i),
      loadImage(ASSETS.background).then(i => IMG.background = i)
    ];
    updateLoader(20);

    loadingStatus.textContent = 'Loading audio…';
    tasks.push(loadAudio(audioBg, ASSETS.bgMusic).then(a=>{}));
    tasks.push(loadAudio(audioSpawn, ASSETS.sfxSpawn).then(a=>{}));
    tasks.push(loadAudio(audioPickup, ASSETS.sfxPickup).then(a=>{}));
    tasks.push(loadAudio(audioPortal, ASSETS.sfxPortal).then(a=>{}));
    tasks.push(loadAudio(audioDeath, ASSETS.sfxDeath).then(a=>{}));
    tasks.push(loadAudio(audioNewRecord, ASSETS.sfxNewRecord).then(a=>{}));
    updateLoader(55);

    await Promise.all(tasks);
    updateLoader(100);
    setTimeout(() => { loadingOverlay.classList.add('hidden'); }, 300);
  }

  function updateLoader(pct) {
    loaderProgress.style.width = clamp(pct, 0, 100) + '%';
  }

  /* =========================
     AUDIO / PLAY helpers
     ========================= */
  function applyAudioSettings() {
    try {
      if (audioBg) audioBg.volume = SETTINGS.musicVolume;
      [audioSpawn, audioPickup, audioPortal, audioDeath, audioNewRecord].forEach(a => { if (a) a.volume = SETTINGS.sfxVolume; });
      if (SETTINGS.music && audioBg && STATE.running) audioBg.play().catch(()=>{});
      else if (audioBg) audioBg.pause();
    } catch (e) { /* ignore */ }
  }

  function safePlay(el, vol = 1) {
    if (!SETTINGS.sfx) return;
    if (!el) { // fallback simple synth beep
      synthOnce('beep', SETTINGS.sfxVolume * vol); return;
    }
    try { el.volume = SETTINGS.sfxVolume * vol; el.currentTime = 0; el.play().catch(()=>{}); } catch (e) {}
  }

  // tiny synth fallback for missing sfx
  function synthOnce(kind = 'beep', volume = 0.6) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = kind === 'death' ? 80 : kind === 'portal' ? 520 : 440;
      g.gain.value = volume * 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 160);
    } catch (e) { /* ignore */ }
  }

  /* =========================
     CANVAS / RESIZE
     ========================= */
  function recomputeCanvas() {
    // responsive sizes
    const maxW = Math.min(window.innerWidth - 40, 980);
    const maxH = Math.min(window.innerHeight - 160, 720);
    const w = Math.min(maxW, Math.floor(maxH * (4 / 3)));
    const h = Math.floor(w * (3 / 4));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const pr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(w * pr));
    canvas.height = Math.max(240, Math.floor(h * pr));
    ctx.setTransform(pr,0,0,pr,0,0);

    // miniMap remains fixed ratio
    const mm = miniMap;
    const mmW = 280, mmH = 180;
    miniMap.style.width = mmW/2 + 'px';
    miniMap.style.height = mmH/2 + 'px';
    miniMap.width = Math.floor(mmW * pr);
    miniMap.height = Math.floor(mmH * pr);
    miniCtx.setTransform(pr,0,0,pr,0,0);

    // tile size based on cols/rows
    STATE.tile = Math.floor(Math.min((w-4) / STATE.cols, (h-4) / STATE.rows));
  }
  window.addEventListener('resize', recomputeCanvas);

  /* =========================
     MAZE generator (recursive backtracker)
     ========================= */
  function generateMaze(cols, rows) {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
    function carve(x, y) {
      grid[y][x] = 0;
      const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
          grid[y + dy/2][x + dx/2] = 0;
          carve(nx, ny);
        }
      }
    }
    carve(1,1);
    // ensure start area open
    grid[1][1] = 0;
    if (grid[1][2] !== undefined) grid[1][2] = 0;
    if (grid[2]) grid[2][1] = 0;
    return grid;
  }

  /* =========================
     GAME ENTITIES
     ========================= */
  function resetLevel(level = 0) {
    STATE.cols = Math.max(11, 11 + level * 2); // slightly bigger each level
    STATE.rows = Math.max(11, 11 + level * 2);
    if (STATE.cols % 2 === 0) STATE.cols++;
    if (STATE.rows % 2 === 0) STATE.rows++;
    STATE.maze = generateMaze(STATE.cols, STATE.rows);
    recomputeCanvas();
    // player
    STATE.player = { x: 1, y: 1, rx: 1, ry: 1, radius: Math.max(6, STATE.tile * 0.36), color: '#66ff99', trail: [] };
    STATE.clones = [];
    STATE.powerups = [];
    STATE.particles = [];
    STATE.frame = 0;
    STATE.cloneInterval = Math.max(60, 300 - (difficultyValue() * 80));
    placePortal();
    STATE.startTime = now();
    updateHUD();
  }

  function placePortal() {
    let best = null, bestd = -1;
    for (let y = STATE.rows - 2; y >= 1; y--) {
      for (let x = STATE.cols - 2; x >= 1; x--) {
        if (STATE.maze[y] && STATE.maze[y][x] === 0 && !(x === 1 && y === 1)) {
          const d = Math.abs(x - 1) + Math.abs(y - 1);
          if (d > bestd) { bestd = d; best = { x, y }; }
        }
      }
    }
    STATE.portal = best || { x: STATE.cols - 2, y: STATE.rows - 2 };
  }

  /* =========================
     POWERUPS
     ========================= */
  const POWER_TYPES = ['speed','cloak','summon']; // summon = spawn extra clone
  function spawnPowerup() {
    let attempts = 0;
    while (attempts++ < 200) {
      const x = randInt(1, STATE.cols - 2), y = randInt(1, STATE.rows - 2);
      if (STATE.maze[y] && STATE.maze[y][x] === 0 && !(x === STATE.player.x && y === STATE.player.y) && !(x === STATE.portal.x && y === STATE.portal.y) && !STATE.powerups.some(p => p.x === x && p.y === y)) {
        STATE.powerups.push({ x, y, type: POWER_TYPES[randInt(0, POWER_TYPES.length-1)], bob: Math.random()*Math.PI*2, spawned: now() });
        break;
      }
    }
  }
  function applyPowerup(type) {
    if (type === 'speed') {
      STATE.activePower = { type: 'speed', until: now() + 4500 };
    } else if (type === 'cloak') {
      STATE.activePower = { type: 'cloak', until: now() + 5000 };
    } else if (type === 'summon') {
      // spawn extra clone right away (simulate larger threat)
      spawnClone();
    }
    safePlay(audioPickup, 0.9);
    showToast(`Power: ${type.toUpperCase()}`);
  }

  /* =========================
     PARTICLES
     ========================= */
  function spawnParticles(px, py, color = '#fff', count = 18) {
    for (let i=0;i<count;i++){
      STATE.particles.push({
        x: px + (Math.random()-0.5) * STATE.tile,
        y: py + (Math.random()-0.5) * STATE.tile,
        vx: (Math.random()-0.5) * 3, vy:(Math.random()-0.8) * 3,
        life: 20 + Math.random()*40, color
      });
    }
  }
  function updateParticles() {
    for (let i = STATE.particles.length - 1; i >= 0; i--) {
      const p = STATE.particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06;
      p.vx *= 0.995; p.vy *= 0.995; p.life--;
      if (p.life <= 0) STATE.particles.splice(i, 1);
    }
  }

  /* =========================
     CLONE CLASS
     ========================= */
  class Clone {
    constructor(path, type = 'basic') {
      this.path = path.slice();
      this.index = 0;
      this.type = type;
      this.spawnFrame = STATE.frame;
      this.x = this.path[0]?.x ?? 1;
      this.y = this.path[0]?.y ?? 1;
      this.frozen = false;
      this.color = type === 'wraith'? '#ff66ff' : type === 'fast'? '#ffb86b' : '#ff6666';
      this.id = Math.random().toString(36).slice(2,8);
    }
    update() {
      if (this.frozen) return;
      if (this.type === 'fast') this.index += 1 + (Math.random() < 0.45 ? 1 : 0);
      else if (this.type === 'wraith') {
        if (Math.random() < 0.01 + Math.min(0.05, STATE.frame/60000)) {
          const jump = Math.min(50, Math.floor(Math.random() * Math.min(200, this.path.length)));
          this.index = Math.min(this.path.length - 1, this.index + jump);
        } else this.index++;
      } else this.index++;
      if (this.index < this.path.length) {
        this.x = this.path[this.index].x; this.y = this.path[this.index].y;
      }
    }
    draw(ctx) {
      const age = STATE.frame - this.spawnFrame;
      const alpha = Math.max(0.3, Math.min(1, 0.6 + Math.sin(age / 10) * 0.2));
      ctx.globalAlpha = alpha;
      if (IMG.clones) {
        const tIndex = (this.type === 'wraith') ? 2 : (this.type === 'fast' ? 1 : 0);
        const frameW = Math.floor(IMG.clones.naturalWidth / 3);
        const frameH = IMG.clones.naturalHeight;
        ctx.drawImage(IMG.clones, tIndex*frameW, 0, frameW, frameH, this.x*STATE.tile, this.y*STATE.tile, STATE.tile, STATE.tile);
      } else {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x*STATE.tile + 2, this.y*STATE.tile + 2, STATE.tile - 4, STATE.tile - 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  /* =========================
     PLAYER & INPUT
     ========================= */
  let activeDirs = { up:false, down:false, left:false, right:false };
  let lastStepTime = 0;
  let stepMsBase = 140;

  function difficultyValue() {
    switch (SETTINGS.difficulty) {
      case 'easy': return 0.8;
      case 'normal': return 1;
      case 'hard': return 1.6;
      case 'nightmare': return 2.2;
      default: return 1;
    }
  }

  function playFootstep() { safePlay(audioSpawn, 0.12); }

  function stepPlayer() {
    const nowp = performance.now();
    const speedFactor = (STATE.activePower && STATE.activePower.type === 'speed' && now() < STATE.activePower.until) ? 0.55 : 1;
    const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (difficultyValue() - 1) * 10));
    if (nowp - lastStepTime < ms) return;
    lastStepTime = nowp;
    if (!STATE.running) return;
    let nx = STATE.player.x, ny = STATE.player.y;
    if (activeDirs.up) ny--;
    else if (activeDirs.down) ny++;
    else if (activeDirs.left) nx--;
    else if (activeDirs.right) nx++;

    if (nx >= 0 && nx < STATE.cols && ny >= 0 && ny < STATE.rows && STATE.maze[ny][nx] === 0) {
      STATE.player.x = nx; STATE.player.y = ny;
      STATE.player.trail.push({ x: nx, y: ny });
      playFootstep();

      // check powerups
      for (let i = STATE.powerups.length - 1; i >= 0; i--) {
        const pu = STATE.powerups[i];
        if (pu.x === nx && pu.y === ny) {
          applyPowerup(pu.type);
          STATE.powerups.splice(i,1);
        }
      }

      // portal
      if (STATE.portal && nx === STATE.portal.x && ny === STATE.portal.y) {
        transitionToNextLevel();
      }
    }
  }

  // keyboard
  document.addEventListener('keydown', (e) => {
    if (!STATE.running && !['Space'].includes(e.key)) return;
    const key = e.key;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') { activeDirs.up = true; stepPlayer(); }
    if (key === 'ArrowDown' || key === 's' || key === 'S') { activeDirs.down = true; stepPlayer(); }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') { activeDirs.left = true; stepPlayer(); }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { activeDirs.right = true; stepPlayer(); }
    if (key === ' ') applyPowerup('summon');
    if (key === 'Escape') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const key = e.key;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') activeDirs.up = false;
    if (key === 'ArrowDown' || key === 's' || key === 'S') activeDirs.down = false;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') activeDirs.left = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') activeDirs.right = false;
  });

  /* Mobile joystick pointer handling */
  let joystickPointer = null;
  let joystickOrigin = { x:0, y:0 };
  let joystickPos = { x:0, y:0 };
  const joystickMax = 48;

  function initJoystick() {
    if (!joystickEl || !joystickKnob) return;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) { joystickEl.classList.add('hidden'); return; }
    joystickEl.classList.remove('hidden');
    joystickEl.addEventListener('pointerdown', (ev) => {
      joystickEl.setPointerCapture(ev.pointerId);
      joystickPointer = ev.pointerId;
      const rect = joystickEl.getBoundingClientRect();
      joystickOrigin.x = rect.left + rect.width/2;
      joystickOrigin.y = rect.top + rect.height/2;
      updateJoystick(ev.clientX, ev.clientY);
    });
    joystickEl.addEventListener('pointermove', (ev) => {
      if (joystickPointer !== ev.pointerId) return;
      updateJoystick(ev.clientX, ev.clientY);
    });
    joystickEl.addEventListener('pointerup', (ev) => {
      if (joystickPointer !== ev.pointerId) return;
      joystickPointer = null; joystickPos = { x:0, y:0 }; joystickKnob.style.transform = `translate(0px,0px)`;
      activeDirs = { up:false, down:false, left:false, right:false };
    });
    joystickEl.addEventListener('pointercancel', () => {
      joystickPointer = null; joystickPos = { x:0, y:0 }; joystickKnob.style.transform = `translate(0px,0px)`;
      activeDirs = { up:false, down:false, left:false, right:false };
    });
  }

  function updateJoystick(cx, cy) {
    const dx = cx - joystickOrigin.x, dy = cy - joystickOrigin.y;
    const dist = Math.hypot(dx,dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const r = Math.min(dist, joystickMax) * SETTINGS.joystickSensitivity;
    joystickPos.x = nx * r; joystickPos.y = ny * r;
    joystickKnob.style.transform = `translate(${joystickPos.x}px, ${joystickPos.y}px)`;
    activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
    activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
    activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
    activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
    stepPlayer();
  }

  /* =========================
     CLONE SPAWNING
     ========================= */
  function spawnClone() {
    if (STATE.player.trail.length < 6) return;
    const len = Math.min(900, STATE.player.trail.length);
    const snap = STATE.player.trail.slice(Math.max(0, STATE.player.trail.length - len));
    const p = Math.random();
    let type = 'basic';
    if (p < 0.08) type = 'wraith';
    else if (p < 0.22) type = 'fast';
    const c = new Clone(snap, type);
    STATE.clones.push(c);
    safePlay(audioSpawn);
    spawnParticles((c.x) * STATE.tile + STATE.tile/2, (c.y) * STATE.tile + STATE.tile/2, '#ff4466');
  }

  /* =========================
     GAME OVER / LEADERBOARD
     ========================= */
  function gameOver() {
    STATE.running = false;
    try { if (SETTINGS.music && audioBg) audioBg.pause(); } catch (e) {}
    safePlay(audioDeath);
    const elapsed = Math.floor((now() - STATE.startTime) / 1000);
    if (elapsed > STATE.best) {
      STATE.best = elapsed;
      localStorage.setItem(KEY_BEST, elapsed);
      safePlay(audioNewRecord);
      showToast(`NEW BEST: ${elapsed}s`);
      addToLeaderboard(elapsed);
    } else {
      showToast(`You survived ${elapsed}s`);
      addToLeaderboard(elapsed, false);
    }
    // show overlay
    $('gameOverText').textContent = `You survived ${elapsed}s`;
    overlayGameOver.classList.remove('hidden');
  }

  function addToLeaderboard(time, promptForName = true) {
    try {
      let list = STATE.leader || [];
      if (promptForName) {
        let name = prompt('New high score! Enter your name (max 12 chars):', 'Player') || 'Player';
        name = name.slice(0,12);
        list.push({ name, time });
      } else {
        list.push({ name: 'Player', time });
      }
      list.sort((a,b) => b.time - a.time);
      localStorage.setItem(KEY_LEADER, JSON.stringify(list.slice(0,50)));
      STATE.leader = list.slice(0,50);
      updateLeaderboardUI();
    } catch (e) { console.warn('leader add fail', e); }
  }

  function updateLeaderboardUI() {
    try {
      const list = STATE.leader || JSON.parse(localStorage.getItem(KEY_LEADER) || '[]');
      leaderboardList.innerHTML = '';
      list.slice(0,12).forEach(it => {
        const li = document.createElement('li');
        li.textContent = `${it.name} — ${it.time}s`;
        leaderboardList.appendChild(li);
      });
    } catch (e) {}
  }

  if (btnClearLeaderboard) btnClearLeaderboard.addEventListener('click', () => {
    if (confirm('Clear local leaderboard?')) {
      localStorage.removeItem(KEY_LEADER);
      STATE.leader = [];
      updateLeaderboardUI();
    }
  });

  /* =========================
     DRAW HELPERS
     ========================= */
  function drawMaze() {
    if (!STATE.maze) return;
    const cols = STATE.cols, rows = STATE.rows, t = STATE.tile;
    // background style
    if (IMG.background) {
      ctx.globalAlpha = 0.98;
      ctx.drawImage(IMG.background, -40, -20, canvas.clientWidth + 80, canvas.clientHeight + 40);
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createLinearGradient(0,0,canvas.width/ (window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
      g.addColorStop(0, '#071018'); g.addColorStop(1, '#03040a');
      ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
    }

    // maze rendering
    for (let y=0;y<rows;y++){
      for (let x=0;x<cols;x++){
        if (STATE.maze[y] && STATE.maze[y][x] === 1) {
          ctx.fillStyle = '#121517';
          ctx.fillRect(x*t, y*t, t, t);
          // subtle bevel
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          ctx.fillRect(x*t+1, y*t+1, t-2, t-2);
          ctx.strokeStyle = 'rgba(40,200,255,0.03)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x*t+0.5, y*t+0.5, t-1, t-1);
        } else {
          ctx.fillStyle = '#070707';
          ctx.fillRect(x*t, y*t, t, t);
        }
      }
    }
  }

  function drawPowerups(nowms) {
    for (const pu of STATE.powerups) {
      const cx = pu.x*STATE.tile + STATE.tile/2, cy = pu.y*STATE.tile + STATE.tile/2 + Math.sin((STATE.frame + pu.bob) * 0.12) * 3;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.sin(STATE.frame/18 + pu.bob) * 0.08);
      if (pu.type === 'speed') { ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,STATE.tile*0.24,0,Math.PI*2); ctx.fill(); }
      else if (pu.type === 'cloak') { ctx.fillStyle = '#9be7b0'; ctx.fillRect(-STATE.tile*0.2, -STATE.tile*0.2, STATE.tile*0.4, STATE.tile*0.4); }
      else { ctx.fillStyle = '#f4d78b'; ctx.beginPath(); ctx.moveTo(0,-STATE.tile*0.22); ctx.lineTo(STATE.tile*0.14,0); ctx.lineTo(-STATE.tile*0.14,0); ctx.fill(); }
      ctx.restore();
    }
  }

  function drawPortal(nowms) {
    if (!STATE.portal) return;
    const px = STATE.portal.x*STATE.tile + STATE.tile/2, py = STATE.portal.y*STATE.tile + STATE.tile/2;
    const scale = 0.9 + 0.08 * Math.sin(nowms / 280);
    const rot = (nowms / 1400) % (Math.PI*2);
    if (IMG.portal) {
      ctx.save(); ctx.translate(px,py); ctx.rotate(rot); ctx.globalAlpha = 0.9 + 0.06 * Math.sin(nowms/320);
      const s = STATE.tile * scale; ctx.drawImage(IMG.portal, -s/2, -s/2, s, s); ctx.restore();
    } else {
      ctx.save(); ctx.translate(px,py); ctx.rotate(rot/1.8); ctx.fillStyle = '#66ffcc'; ctx.beginPath(); ctx.ellipse(0,0,STATE.tile*0.42,STATE.tile*0.46,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  }

  function drawMiniMap() {
    const mmW = miniMap.width / (window.devicePixelRatio||1), mmH = miniMap.height/(window.devicePixelRatio||1);
    miniCtx.clearRect(0,0,mmW,mmH);
    const cw = mmW / STATE.cols, ch = mmH / STATE.rows;
    for (let y=0;y<STATE.rows;y++){
      for (let x=0;x<STATE.cols;x++){
        miniCtx.fillStyle = (STATE.maze[y] && STATE.maze[y][x] === 1) ? '#222' : '#070707';
        miniCtx.fillRect(x*cw, y*ch, cw, ch);
      }
    }
    for (const c of STATE.clones) {
      miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
      miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1, cw*0.9), Math.max(1, ch*0.9));
    }
    // player
    miniCtx.fillStyle = '#66ff99';
    miniCtx.fillRect(STATE.player.x*cw, STATE.player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
    // powerups
    for (const pu of STATE.powerups) {
      miniCtx.fillStyle = pu.type === 'speed' ? '#4fd1ff' : pu.type === 'cloak' ? '#9be7b0' : '#f4d78b';
      miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
    }
  }

  function drawPlayer(nowms) {
    if (!STATE.player) return;
    if (IMG.ninja) {
      const frameAnim = Math.floor((STATE.frame / 8) % 4);
      const frameW = Math.floor(IMG.ninja.naturalWidth / 4);
      const frameH = IMG.ninja.naturalHeight;
      const sx = frameAnim * frameW, sy = 0;
      ctx.drawImage(IMG.ninja, sx, sy, frameW, frameH, STATE.player.rx*STATE.tile, STATE.player.ry*STATE.tile, STATE.tile, STATE.tile);
    } else {
      const px = STATE.player.rx*STATE.tile + STATE.tile/2, py = STATE.player.ry*STATE.tile + STATE.tile/2;
      const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
      ctx.save(); ctx.shadowBlur = 18 * pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = STATE.player.color;
      ctx.beginPath(); ctx.arc(px, py, STATE.player.radius, 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
  }

  /* =========================
     HUD / TOASTS
     ========================= */
  function updateHUD() {
    const elapsed = Math.floor((now() - STATE.startTime) / 1000);
    hudTime.textContent = `Time: ${elapsed}s`;
    hudScore.textContent = `Score: ${STATE.score}`;
    hudLevel.textContent = `Level ${STATE.level + 1}`;
    hudLives.textContent = `Lives: ${STATE.lives}`;
    if (powerupBox) {
      if (STATE.activePower && now() < STATE.activePower.until) {
        const rem = Math.ceil((STATE.activePower.until - now()) / 1000);
        powerupBox.innerHTML = `<b>${STATE.activePower.type.toUpperCase()}</b> ${rem}s`;
      } else {
        powerupBox.innerHTML = '';
        if (STATE.activePower && now() >= STATE.activePower.until) STATE.activePower = null;
      }
    }
  }

  function showToast(text, duration = 1600) {
    const el = document.createElement('div');
    el.className = 'sce-toast';
    el.textContent = text;
    el.style.cssText = 'position:fixed;right:16px;top:16px;background:rgba(0,0,0,0.6);color:#fff;padding:8px 12px;border-radius:8px;font-family:sans-serif;z-index:9999;opacity:1;transition:all .45s';
    document.body.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-12px)'; setTimeout(()=>el.remove(),480); }, duration);
  }

  /* =========================
     MAIN ANIMATION LOOP
     ========================= */
  let lastFrame = performance.now();

  function animate(nowms) {
    if (!STATE.running) return;
    const dt = (nowms - lastFrame) / 1000; lastFrame = nowms; STATE.frame++;

    // spawn powerups occasionally
    if (STATE.frame % 900 === 0 && Math.random() < 0.88) spawnPowerup();

    // clones spawn pacing
    const intervalFrames = Math.max(8, Math.floor(STATE.cloneInterval / (1 + difficultyValue() * 0.6)));
    if (STATE.frame % intervalFrames === 0 && STATE.player.trail.length > 8) {
      spawnClone();
      if (STATE.cloneInterval > 30) STATE.cloneInterval -= 1 + (difficultyValue());
      if (Math.random() < 0.02 + (difficultyValue() - 1) * 0.03) spawnClone();
    }

    // update clones & collisions
    for (let i = STATE.clones.length - 1; i >= 0; i--) {
      const c = STATE.clones[i];
      c.update();
      if (Math.round(c.x) === STATE.player.x && Math.round(c.y) === STATE.player.y) {
        if (!(STATE.activePower && STATE.activePower.type === 'cloak' && now() < STATE.activePower.until)) {
          // death
          STATE.running = false;
          safePlay(audioDeath);
          showToast('☠️ You Died');
          spawnParticles(STATE.player.rx*STATE.tile + STATE.tile/2, STATE.player.ry*STATE.tile + STATE.tile/2, '#ffcc66', 40);
          setTimeout(()=>{ gameOver(); }, 800);
          return;
        }
      }
    }

    updateParticles();

    // render pipeline
    ctx.clearRect(0,0,canvas.width/(window.devicePixelRatio||1), canvas.height/(window.devicePixelRatio||1));
    drawMaze();
    drawPowerups(nowms);

    // clones
    for (const c of STATE.clones) c.draw(ctx);

    // smooth player interpolation
    const speed = 12 + difficultyValue() * 6;
    const t = Math.min(1, dt * speed);
    STATE.player.rx = STATE.player.rx === undefined ? STATE.player.x : (STATE.player.rx + (STATE.player.x - STATE.player.rx) * t);
    STATE.player.ry = STATE.player.ry === undefined ? STATE.player.y : (STATE.player.ry + (STATE.player.y - STATE.player.ry) * t);

    // trail rendering
    for (let i = Math.max(0, STATE.player.trail.length - 30); i < STATE.player.trail.length; i++) {
      const m = STATE.player.trail[i];
      const alpha = (i - Math.max(0, STATE.player.trail.length - 30)) / 30;
      ctx.globalAlpha = 0.05 + alpha * 0.25;
      ctx.fillStyle = '#33ff77';
      ctx.fillRect(m.x*STATE.tile + STATE.tile*0.28, m.y*STATE.tile + STATE.tile*0.28, STATE.tile*0.44, STATE.tile*0.44);
    }
    ctx.globalAlpha = 1;

    // player
    drawPlayer(nowms);

    // particles
    for (const p of STATE.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 70);
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    // portal
    drawPortal(nowms);

    // minimap & HUD
    drawMiniMap();
    updateHUD();

    requestAnimationFrame(animate);
  }

  /* =========================
     STEP LOOP for held keys
     ========================= */
  let lastTick = 0;
  function tickLoop() {
    if (!STATE.running) return;
    const nowt = performance.now();
    if (nowt - lastTick > 120) {
      if (activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer();
      lastTick = nowt;
    }
    requestAnimationFrame(tickLoop);
  }
  tickLoop();

  /* =========================
     LEVEL transitions
     ========================= */
  function transitionToNextLevel() {
    STATE.running = false;
    safePlay(audioPortal);
    let t = 0; const dur = 36;
    function anim() {
      ctx.save();
      const s = 1 + 0.08 * Math.sin(Math.PI * (t / dur));
      const cx = (STATE.cols * STATE.tile) / 2, cy = (STATE.rows * STATE.tile) / 2;
      ctx.setTransform(s,0,0,s, -(s-1)*cx, -(s-1)*cy);
      if (IMG.background) ctx.drawImage(IMG.background,-40,-20, canvas.clientWidth+80, canvas.clientHeight+40);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${(t/dur)*0.96})`; ctx.fillRect(0,0,STATE.cols*STATE.tile, STATE.rows*STATE.tile);
      t++;
      if (t <= dur) requestAnimationFrame(anim);
      else {
        STATE.level = Math.min(STATE.level + 1, 9);
        resetLevel(STATE.level);
        showToast(`Level Up! ${STATE.level + 1}`);
        STATE.running = true;
        lastFrame = performance.now();
        requestAnimationFrame(animate);
      }
    }
    anim();
  }

  /* =========================
     MAIN GAME control: start/reset/pause
     ========================= */
  function startRun() {
    saveSettings();
    mainMenu && mainMenu.classList.add('hidden');
    overlayHow.classList.add('hidden');
    overlaySettings.classList.add('hidden');
    overlayLeaderboard.classList.add('hidden');
    gameWrap.classList.remove('hidden');
    STATE.level = 0; STATE.lives = 3; STATE.score = 0; STATE.activePower = null;
    resetLevel(0);
    STATE.running = true;
    if (SETTINGS.music && audioBg) try { audioBg.currentTime = 0; audioBg.volume = SETTINGS.musicVolume; audioBg.play().catch(()=>{}); } catch (e) {}
    applyAudioSettings();
    lastFrame = performance.now();
    requestAnimationFrame(animate);
  }

  function resetGame() {
    STATE.level = 0; STATE.lives = 3; STATE.score = 0;
    resetLevel(0);
    STATE.running = true;
    lastFrame = performance.now();
    requestAnimationFrame(animate);
  }

  function togglePause() {
    if (!STATE.running) {
      // resume
      if (overlayPause) overlayPause.classList.add('hidden');
      STATE.running = true; lastFrame = performance.now(); requestAnimationFrame(animate); return;
    }
    // pause
    STATE.running = false;
    if (overlayPause) overlayPause.classList.remove('hidden');
  }

  /* =========================
     UI wiring
     ========================= */
  // main menu buttons
  btnStart && btnStart.addEventListener('click', () => { startRun(); });
  btnHow && btnHow.addEventListener('click', () => { overlayHow.classList.remove('hidden'); });
  btnLeaderboard && btnLeaderboard.addEventListener('click', () => { updateLeaderboardUI(); overlayLeaderboard.classList.remove('hidden'); });
  btnSettings && btnSettings.addEventListener('click', () => { overlaySettings.classList.remove('hidden'); });

  // overlay close buttons
  document.querySelectorAll('.close-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-close');
      if (target) $(target) && $(target).classList.add('hidden');
      // fallback: hide parent overlay
      const parent = e.target.closest('.overlay'); if (parent) parent.classList.add('hidden');
    });
  });

  // pause / restart / menu
  btnPause && btnPause.addEventListener('click', () => togglePause());
  btnResume && btnResume.addEventListener('click', () => { togglePause(); });
  btnQuitToMenu && btnQuitToMenu.addEventListener('click', () => { STATE.running = false; gameWrap.classList.add('hidden'); mainMenu.classList.remove('hidden'); overlayPause.classList.add('hidden'); });
  btnRestart && btnRestart.addEventListener('click', () => { resetGame(); });
  btnMenu && btnMenu.addEventListener('click', () => { STATE.running = false; gameWrap.classList.add('hidden'); mainMenu.classList.remove('hidden'); });

  // game over restart
  btnGameOverRestart && btnGameOverRestart.addEventListener('click', () => { overlayGameOver.classList.add('hidden'); resetGame(); });

  // settings wiring
  toggleMusic.checked = SETTINGS.music;
  toggleSfx.checked = SETTINGS.sfx;
  musicVol.value = SETTINGS.musicVolume;
  sfxVol.value = SETTINGS.sfxVolume;
  difficultySelect.value = SETTINGS.difficulty;

  toggleMusic && toggleMusic.addEventListener('change', (e) => { SETTINGS.music = e.target.checked; saveSettings(); applyAudioSettings(); });
  toggleSfx && toggleSfx.addEventListener('change', (e) => { SETTINGS.sfx = e.target.checked; saveSettings(); });
  musicVol && musicVol.addEventListener('input', (e) => { SETTINGS.musicVolume = parseFloat(e.target.value); saveSettings(); applyAudioSettings(); });
  sfxVol && sfxVol.addEventListener('input', (e) => { SETTINGS.sfxVolume = parseFloat(e.target.value); saveSettings(); });
  difficultySelect && difficultySelect.addEventListener('change', (e) => { SETTINGS.difficulty = e.target.value; saveSettings(); });

  btnSaveSettings && btnSaveSettings.addEventListener('click', () => { saveSettings(); overlaySettings.classList.add('hidden'); applyAudioSettings(); });

  // leaderboard UI update
  function updateLeaderboardUI() {
    const list = STATE.leader || JSON.parse(localStorage.getItem(KEY_LEADER) || '[]');
    leaderboardList.innerHTML = '';
    list.slice(0,12).forEach(it => {
      const li = document.createElement('li');
      li.textContent = `${it.name} — ${it.time}s`;
      leaderboardList.appendChild(li);
    });
  }

  // menu: clear leaderboard
  btnClearLeaderboard && btnClearLeaderboard.addEventListener('click', () => {
    if (confirm('Clear local leaderboard?')) {
      localStorage.removeItem(KEY_LEADER);
      STATE.leader = [];
      updateLeaderboardUI();
    }
  });

  /* =========================
     MINOR UI/UX & helpers
     ========================= */
  function showMainMenu() {
    mainMenu.classList.remove('hidden');
    gameWrap.classList.add('hidden');
  }

  function showMainAndStop() {
    STATE.running = false;
    overlayGameOver.classList.add('hidden');
    overlayPause.classList.add('hidden');
    showMainMenu();
  }

  // small toast used earlier (redeclared to be available)
  function showToastShort(msg) { showToast(msg, 1200); }

  /* =========================
     Game lifecycle helpers
     ========================= */
  function spawnParticlesForPortal() {
    spawnParticles(STATE.portal.x*STATE.tile + STATE.tile/2, STATE.portal.y*STATE.tile + STATE.tile/2, '#66ffcc', 26);
  }

  /* =========================
     Bootstrap & init
     ========================= */
  async function init() {
    // Safe defaults for missing DOM
    if (!mainMenu) { console.warn('Main menu element missing'); }
    recomputeCanvas();
    initJoystick();

    // load assets
    try {
      await preloadAll();
    } catch (e) { console.warn('preload failed', e); }
    // compute initial maze and draw something
    resetLevel(0);
    updateLeaderboardUI();
    applyAudioSettings();

    // display menu
    loadingOverlay.classList.add('hidden');
    mainMenu && mainMenu.classList.remove('hidden');

    // first-user-gesture to unlock audio on mobile — when user clicks Start we'll start audio
    btnStart && btnStart.addEventListener('click', () => {
      applyAudioSettings();
    });

    // ensure canvas focus for keyboard
    canvas && canvas.addEventListener('click', () => canvas.focus());
  }

  /* =========================
     Helper: small synth fallback if audio missing (already defined)
     ========================= */

  // Kick things off
  init();

  // expose debug API
  window.SCE = {
    resetLevel, resetGame, startRun, STATE, SETTINGS, IMG
  };

})();
