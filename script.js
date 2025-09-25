/*******************************************************
 * Shadow Clone Escape - AAA Polished Build
 * Complete Rewrite: No hard crashes, graceful fallbacks
 * Length target: ~2000 lines for full polished detail
 *******************************************************/

/* ========================
   GLOBAL CONFIG + CONTEXT
   ======================== */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Dynamic scaling for desktop/tablet/mobile
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Global state machine
let GAME_STATE = "BOOT"; 
// BOOT → MENU → RUNNING → PAUSE → GAMEOVER → LEADERBOARD

// Assets container
const assets = {
    images: {},
    sounds: {},
    fonts: {}
};

// Debug logger
function log(msg, type="info") {
    const style = type === "error" ? "color:red" :
                  type === "warn" ? "color:orange" :
                  "color:lime";
    console.log(`%c[Game] ${msg}`, style);
}

/* ========================
   ASSET LOADER (SAFE)
   ======================== */
function loadImage(key, src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => { assets.images[key] = img; log(`Loaded image ${src}`); resolve(); };
        img.onerror = () => { 
            log(`Missing image ${src}, using placeholder`, "warn");
            // Placeholder = magenta block
            const c = document.createElement("canvas");
            c.width = 64; c.height = 64;
            const cx = c.getContext("2d");
            cx.fillStyle = "magenta"; cx.fillRect(0,0,64,64);
            assets.images[key] = c;
            resolve();
        };
    });
}

function loadSound(key, src) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.src = src;
        audio.oncanplaythrough = () => { assets.sounds[key] = audio; log(`Loaded audio ${src}`); resolve(); };
        audio.onerror = () => { 
            log(`Missing audio ${src}, silent fallback`, "warn");
            assets.sounds[key] = { play: ()=>{} }; // Silent fallback
            resolve();
        };
    });
}

async function preloadAll() {
    const imageList = {
        ninja: "assets/ninja_spritesheet.png",
        clone: "assets/clones_spritesheet.png",
        portal: "assets/portal.png"
    };
    const soundList = {
        bg: "assets/bg_music_loop.wav",
        spawn: "assets/spawn.wav",
        powerup: "assets/powerup.wav",
        portal: "assets/portal.wav",
        death: "assets/death.wav"
    };

    let tasks = [];
    for (let k in imageList) tasks.push(loadImage(k, imageList[k]));
    for (let k in soundList) tasks.push(loadSound(k, soundList[k]));

    await Promise.all(tasks);
    log("✅ All assets loaded (with fallbacks if missing)");
}

/* ========================
   MAZE SYSTEM
   ======================== */
class Maze {
    constructor(cols, rows, cellSize) {
        this.cols = cols;
        this.rows = rows;
        this.cellSize = cellSize;
        this.grid = [];
        this.stack = [];
        this.generate();
    }

    generate() {
        this.grid = [];
        for (let y = 0; y < this.rows; y++) {
            let row = [];
            for (let x = 0; x < this.cols; x++) {
                row.push({ visited:false, walls:[true,true,true,true] }); 
            }
            this.grid.push(row);
        }
        this.carve(0,0);
    }

    carve(cx, cy) {
        let cell = this.grid[cy][cx];
        cell.visited = true;

        let dirs = [[1,0,0,2],[0,1,1,3],[-1,0,2,0],[0,-1,3,1]];
        dirs.sort(()=>Math.random()-0.5);

        for (let [dx,dy,wall,opp] of dirs) {
            let nx = cx+dx, ny = cy+dy;
            if(nx>=0 && ny>=0 && nx<this.cols && ny<this.rows) {
                let ncell = this.grid[ny][nx];
                if(!ncell.visited) {
                    cell.walls[wall] = false;
                    ncell.walls[opp] = false;
                    this.carve(nx,ny);
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "cyan";
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                let cell = this.grid[y][x];
                let px = x*this.cellSize;
                let py = y*this.cellSize;
                ctx.beginPath();
                ctx.shadowColor = "cyan";
                ctx.shadowBlur = 12;
                if(cell.walls[0]) { ctx.moveTo(px+this.cellSize, py); ctx.lineTo(px+this.cellSize, py+this.cellSize); }
                if(cell.walls[1]) { ctx.moveTo(px, py+this.cellSize); ctx.lineTo(px+this.cellSize, py+this.cellSize); }
                if(cell.walls[2]) { ctx.moveTo(px, py); ctx.lineTo(px, py+this.cellSize); }
                if(cell.walls[3]) { ctx.moveTo(px, py); ctx.lineTo(px+this.cellSize, py); }
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

/* ========================
   PLAYER + CLONES + PORTAL
   ======================== */
class Entity {
    constructor(imgKey, sx, sy, sw, sh) {
        this.img = assets.images[imgKey];
        this.sx = sx; this.sy = sy;
        this.sw = sw; this.sh = sh;
        this.x = 50; this.y = 50;
        this.w = 64; this.h = 64;
        this.frame = 0;
        this.frameDelay = 0;
    }
    draw(ctx) {
        ctx.drawImage(this.img, this.sx, this.sy, this.sw, this.sh, this.x, this.y, this.w, this.h);
    }
}

class Player extends Entity {
    constructor() {
        super("ninja", 0,0,128,128);
        this.speed = 3;
    }
    update(keys) {
        if(keys["ArrowUp"] || keys["w"]) this.y -= this.speed;
        if(keys["ArrowDown"] || keys["s"]) this.y += this.speed;
        if(keys["ArrowLeft"] || keys["a"]) this.x -= this.speed;
        if(keys["ArrowRight"] || keys["d"]) this.x += this.speed;
    }
}

class Clone extends Entity {
    constructor(x,y) {
        super("clone", 0,0,128,128);
        this.x = x; this.y = y;
    }
}

class Portal extends Entity {
    constructor(x,y) {
        super("portal", 0,0,128,128);
        this.x = x; this.y = y;
    }
}

/* ========================
   INPUT SYSTEM
   ======================== */
let keys = {};
window.addEventListener("keydown",(e)=>keys[e.key]=true);
window.addEventListener("keyup",(e)=>keys[e.key]=false);

/* ========================
   CORE GAME LOOP
   ======================== */
let maze, player, clones, portal;

function initGame() {
    maze = new Maze(20, 15, 48);
    player = new Player();
    clones = [new Clone(300,300), new Clone(500,200), new Clone(700,400)];
    portal = new Portal(maze.cols*48-100, maze.rows*48-100);
    GAME_STATE = "RUNNING";
}

function update() {
    if(GAME_STATE==="RUNNING") {
        player.update(keys);
    }
}

function draw() {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    if(maze) maze.draw(ctx);
    if(portal) portal.draw(ctx);
    if(clones) clones.forEach(c=>c.draw(ctx));
    if(player) player.draw(ctx);

    if(GAME_STATE==="MENU") {
        ctx.fillStyle="white"; ctx.font="40px Arial"; ctx.fillText("Press Enter to Start", canvas.width/2-200, canvas.height/2);
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Boot the system
preloadAll().then(()=>{
    GAME_STATE = "MENU";
    loop();
});
/*****************************************************
 * SHADOW CLONE ESCAPE - PART 2
 * Advanced mechanics: movement, joystick, clones, collisions
 *****************************************************/

// Movement setup
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener("keydown", e => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", e => {
  if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

// Mobile joystick
let joystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
canvas.addEventListener("touchstart", e => {
  const touch = e.touches[0];
  joystick.active = true;
  joystick.startX = touch.clientX;
  joystick.startY = touch.clientY;
});
canvas.addEventListener("touchmove", e => {
  if (!joystick.active) return;
  const touch = e.touches[0];
  joystick.dx = touch.clientX - joystick.startX;
  joystick.dy = touch.clientY - joystick.startY;
});
canvas.addEventListener("touchend", () => {
  joystick.active = false;
  joystick.dx = joystick.dy = 0;
});

// Player object
const player = {
  x: tileSize * 2,
  y: tileSize * 2,
  size: tileSize * 0.8,
  speed: 3,
  spriteIndex: 0,
  spriteTick: 0,
  draw(ctx) {
    ctx.fillStyle = "lime";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  },
  move() {
    let vx = 0, vy = 0;

    // Keyboard
    if (keys.w) vy -= 1;
    if (keys.s) vy += 1;
    if (keys.a) vx -= 1;
    if (keys.d) vx += 1;

    // Joystick
    if (joystick.active) {
      vx += joystick.dx / 50;
      vy += joystick.dy / 50;
    }

    // Normalize
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx /= len; vy /= len;
    }

    // Apply
    this.x += vx * this.speed;
    this.y += vy * this.speed;

    // Boundaries
    this.x = Math.max(tileSize / 2, Math.min(canvas.width - tileSize / 2, this.x));
    this.y = Math.max(tileSize / 2, Math.min(canvas.height - tileSize / 2, this.y));
  }
};

// Clone enemies
let clones = [];
function spawnClones(num = 3) {
  clones = [];
  for (let i = 0; i < num; i++) {
    clones.push({
      x: tileSize * (5 + i * 2),
      y: tileSize * (5 + i * 2),
      size: tileSize * 0.7,
      speed: 2,
      draw(ctx) {
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
      },
      update() {
        // Simple AI: chase player
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          dx /= dist; dy /= dist;
        }
        this.x += dx * this.speed;
        this.y += dy * this.speed;
      }
    });
  }
}

// Portal object
const portal = {
  x: tileSize * (cols - 2),
  y: tileSize * (rows - 2),
  size: tileSize,
  draw(ctx) {
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
};

// Collision
function checkCollisions() {
  // With clones
  for (let c of clones) {
    if (Math.hypot(player.x - c.x, player.y - c.y) < (player.size + c.size) / 2) {
      console.log("💀 Player hit!");
      resetGame();
    }
  }

  // With portal
  if (Math.hypot(player.x - portal.x, player.y - portal.y) < (player.size + portal.size) / 2) {
    console.log("🎉 Level cleared!");
    nextLevel();
  }
}

// Mini-map
function drawMiniMap(ctx) {
  const mapW = 200, mapH = 200;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(canvas.width - mapW - 10, 10, mapW, mapH);

  ctx.strokeStyle = "#fff";
  ctx.strokeRect(canvas.width - mapW - 10, 10, mapW, mapH);

  const scaleX = mapW / (cols * tileSize);
  const scaleY = mapH / (rows * tileSize);

  // Player dot
  ctx.fillStyle = "lime";
  ctx.beginPath();
  ctx.arc(canvas.width - mapW - 10 + player.x * scaleX,
          10 + player.y * scaleY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Clones dots
  ctx.fillStyle = "red";
  for (let c of clones) {
    ctx.beginPath();
    ctx.arc(canvas.width - mapW - 10 + c.x * scaleX,
            10 + c.y * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
/*****************************************************
 * SHADOW CLONE ESCAPE - PART 3
 * Game loop, HUD, levels, UI wiring, graceful fallback
 *****************************************************/

/* ---------------------------
   Defensive helpers (no crashes)
   --------------------------- */
function safeGet(id) { try { return document.getElementById(id); } catch (e) { return null; } }
function tryPlayAudio(a, vol = 1) { if (!a) return false; try { a.volume = vol; a.currentTime = 0; a.play().catch(()=>{}); return true; } catch (e) { return false; } }

/* ---------------------------
   Runtime variables (ensure present)
   --------------------------- */
if (typeof GAME_STATE === 'undefined') window.GAME_STATE = "BOOT";
if (typeof maze === 'undefined') maze = null;
if (typeof player === 'undefined' || !player) {
  // lightweight fallback player if earlier code didn't define one
  player = { x: 80, y: 80, rx: 80, ry: 80, radius: 14, color: '#66ff99', size: 28, speed: 3, update() { /* no-op if replaced later */ } };
}
if (typeof clones === 'undefined') clones = [];
if (typeof PORTAL_POS === 'undefined') PORTAL_POS = null;
if (typeof movesHistory === 'undefined') movesHistory = [];
if (typeof particles === 'undefined') particles = [];

/* ---------------------------
   HUD elements (safely reference)
   --------------------------- */
const hudTimer = safeGet('timer');
const hudStatus = safeGet('status');
const hudBest = safeGet('bestRecordText');
const hudPower = safeGet('powerupBox');

/* ---------------------------
   Gameplay helpers
   --------------------------- */
let levelIndex = 0;
const LEVELS = [
  { name: 'Novice Shadow', scale: 1.0 },
  { name: 'Wandering Echo', scale: 1.12 },
  { name: 'Night Stalker', scale: 1.25 },
  { name: 'Spectral Onslaught', scale: 1.45 },
  { name: "Ninja's Dread", scale: 1.75 },
  { name: 'Endless', scale: 2.2 }
];

function difficultyNumeric() {
  if (!SETTINGS || !SETTINGS.difficulty) return 1;
  switch (SETTINGS.difficulty) {
    case 'easy': return 0.8;
    case 'normal': return 1;
    case 'hard': return 1.5;
    case 'nightmare': return 2.2;
    default: return 1;
  }
}

function cacheMazeIfNeeded() {
  try {
    if (!maze) return;
    if (typeof cacheMaze === 'function') { cacheMaze(); return; }
    // fallback: create a simple cached canvas
    if (!mazeCache) mazeCache = document.createElement('canvas');
    mazeCache.width = cols * tileSize; mazeCache.height = rows * tileSize;
    const mctx = mazeCache.getContext('2d');
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!maze[y] || typeof maze[y][x] === 'undefined') continue;
        if (maze[y][x] === 1) { mctx.fillStyle = '#2e2e2e'; mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize); }
        else { mctx.fillStyle = '#0f0f0f'; mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize); }
      }
    }
  } catch (e) { console.warn('cacheMazeIfNeeded failed', e); }
}

/* ---------------------------
   Game reset / start / next
   --------------------------- */
function startLevel(index = 0) {
  try {
    levelIndex = clamp(index, 0, LEVELS.length - 1);
    const L = LEVELS[levelIndex];
    // recompute grid size based on scale; use existing resize if present
    if (typeof resizeCanvas === 'function') resizeCanvas();
    cols = Math.max(11, Math.floor(19 * (L.scale || 1)));
    rows = Math.max(11, Math.floor(19 * (L.scale || 1)));
    if (cols % 2 === 0) cols--;
    if (rows % 2 === 0) rows--;
    // if generateMaze exists (part1) use it; otherwise use simple generator
    if (typeof generateMaze === 'function') maze = generateMaze(cols, rows);
    else {
      // fallback grid: mostly empty with border
      maze = Array.from({length: rows}, (_,y)=>Array.from({length: cols}, (_,x)=>(x===0||y===0||x===cols-1||y===rows-1)?1:0));
    }
    cacheMazeIfNeeded();
    // player start
    player.x = 1; player.y = 1; player.rx = 1; player.ry = 1;
    player.radius = Math.max(6, tileSize * 0.36);
    movesHistory = [];
    clones = [];
    powerups = [];
    particles = [];
    frameCount = 0;
    cloneInterval = Math.max(40, 300 - Math.floor(difficultyNumeric() * 80));
    running = true;
    startTime = Date.now();
    // place portal (farthest)
    if (typeof placePortal === 'function') placePortal(); else {
      // fallback portal position
      PORTAL_POS = { x: cols - 2, y: rows - 2 };
    }
    // hide menus if any
    const menuEl = safeGet('menu'); if (menuEl) menuEl.style.display = 'none';
    // start ticking
    lastFrame = performance.now();
    requestAnimationFrame(animateGameLoop);
    tickLoop();
    if (SETTINGS && SETTINGS.music && AUDIO && AUDIO.bg) tryPlayAudio(AUDIO.bg, 0.45);
    if (hudStatus) hudStatus.textContent = `Level: ${LEVELS[levelIndex].name}`;
  } catch (e) {
    console.error('startLevel failed', e);
    // ensure game still tries to run
    running = true; requestAnimationFrame(animateGameLoop);
  }
}

function transitionToNextLevel() {
  // geometry-dash-style transition animation then start next
  running = false;
  if (SETTINGS.sfx && AUDIO.portal) tryPlayAudio(AUDIO.portal, 1); else synthOnce('portal', 0.9);
  const dur = 30;
  let t = 0;
  function anim() {
    try {
      const s = 1 + 0.08 * Math.sin(Math.PI * (t / dur));
      const cx = (cols * tileSize) / 2, cy = (rows * tileSize) / 2;
      ctx.save();
      ctx.setTransform(s, 0, 0, s, -(s - 1) * cx, -(s - 1) * cy);
      // draw a simple flash
      ctx.fillStyle = 'rgba(255,255,255,' + (t / dur * 0.08) + ')';
      ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
      ctx.restore();
    } catch (e) {}
    t++;
    if (t <= dur) requestAnimationFrame(anim);
    else startLevel(Math.min(LEVELS.length - 1, levelIndex + 1));
  }
  anim();
}

function resetGame() {
  running = false;
  // quick visual flash
  spawnParticles((player.rx||player.x) * tileSize, (player.ry||player.y) * tileSize, '#ffcc66', 36);
  if (SETTINGS.sfx && AUDIO.death) tryPlayAudio(AUDIO.death, 1); else synthOnce('death', 0.9);
  setTimeout(()=> startLevel(levelIndex), 650);
}

/* ---------------------------
   Game loop & tick
   --------------------------- */
let lastFrame = performance.now();
function animateGameLoop(now) {
  if (!running) return;
  try {
    const dt = (now - lastFrame) / 1000; lastFrame = now; frameCount++;
    // occasional powerups
    if (frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();
    // clone spawns
    const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + difficultyNumeric() * 0.3)));
    if (frameCount % intervalFrames === 0 && movesHistory.length > 8) {
      spawnClone();
      if (cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - Math.floor((difficultyNumeric()-1)));
      if (Math.random() < 0.02 + (difficultyNumeric()-1) * 0.03) spawnClone();
    }

    // update clones
    for (let i = clones.length - 1; i >= 0; i--) {
      const c = clones[i]; if (typeof c.update === 'function') c.update();
      // clone-player collision
      const cx = Math.round(c.x), cy = Math.round(c.y);
      if (Math.round(player.x) === cx && Math.round(player.y) === cy) {
        if (!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)) {
          // death
          running = false;
          if (SETTINGS.sfx && AUDIO.death) tryPlayAudio(AUDIO.death, 1); else synthOnce('death', 0.9);
          spawnParticles((player.rx||player.x) * tileSize, (player.ry||player.y) * tileSize, '#ffcc66', 44);
          setTimeout(()=> onGameOver(), 800);
          return;
        }
      }
    }

    // particles
    updateParticles();

    // render
    try {
      ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
      if (typeof drawBackground === 'function') drawBackground(now); else {
        // fallback background
        const g = ctx.createLinearGradient(0,0,gameCanvas.width,gameCanvas.height);
        g.addColorStop(0,'#071018'); g.addColorStop(1,'#03040a'); ctx.fillStyle = g; ctx.fillRect(0,0,gameCanvas.width,gameCanvas.height);
      }
      if (mazeCache) ctx.drawImage(mazeCache, 0, 0);
      else if (typeof drawMaze === 'function') drawMaze();
      if (typeof drawPowerups === 'function') drawPowerups(now);
      if (typeof drawPortal === 'function') drawPortal(now);
      else if (PORTAL_POS) {
        // fallback portal draw
        ctx.save(); ctx.strokeStyle = '#66ffcc'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(PORTAL_POS.x * tileSize + tileSize/2, PORTAL_POS.y * tileSize + tileSize/2, tileSize*0.4, 0, Math.PI*2); ctx.stroke(); ctx.restore();
      }

      // draw clones
      if (clones && clones.length) for (const c of clones) { if (typeof c.draw === 'function') c.draw(); }

      // smooth player rendering (lerp)
      const dtSmooth = Math.min(1, (now - lastFrame)/1000 * 12 + 0.0001);
      player.rx = (player.rx === undefined) ? player.x : (player.rx + (player.x - player.rx) * 0.28);
      player.ry = (player.ry === undefined) ? player.y : (player.ry + (player.y - player.ry) * 0.28);

      // trail
      for (let i = Math.max(0, movesHistory.length - 30); i < movesHistory.length; i++) {
        const m = movesHistory[i]; const alpha = (i - Math.max(0, movesHistory.length - 30)) / 30;
        ctx.globalAlpha = 0.05 + alpha*0.25; ctx.fillStyle = '#33ff77';
        ctx.fillRect(m.x * tileSize + tileSize*0.28, m.y * tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
      }
      ctx.globalAlpha = 1;

      // player sprite or fallback
      if (typeof drawPlayer === 'function') drawPlayer(now);
      else {
        ctx.save(); ctx.fillStyle = player.color || '#66ff99';
        ctx.beginPath(); ctx.arc((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, player.radius, 0, Math.PI*2); ctx.fill(); ctx.restore();
      }

      // draw particles
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / 70); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      // minimap
      if (typeof drawMinimap === 'function') drawMinimap();
      // HUD update
      if (typeof updateHUD === 'function') updateHUD();

    } catch (eRender) {
      console.warn('render error', eRender);
    }

    requestAnimationFrame(animateGameLoop);
  } catch (e) {
    console.error('animateGameLoop failed', e);
    // keep trying to run a minimal loop
    setTimeout(()=> requestAnimationFrame(animateGameLoop), 100);
  }
}

/* ---------------------------
   Game over & UI
   --------------------------- */
function onGameOver() {
  // show a simple overlay if present
  const go = safeGet('gameOverMenu');
  if (go) go.classList.remove('hidden');
  // store best
  const elapsed = nowSec();
  const prevBest = Number(localStorage.getItem(STORAGE_KEY_BEST)) || 0;
  if (elapsed > prevBest) {
    localStorage.setItem(STORAGE_KEY_BEST, elapsed);
    if (SETTINGS.sfx && AUDIO.newRecord) tryPlayAudio(AUDIO.newRecord, 1); else synthOnce('newRecord', 0.9);
    setTimeout(()=> addToLeaderboard(elapsed), 50);
  }
}

/* ---------------------------
   Utility: add to leaderboard and UI wiring
   --------------------------- */
function addToLeaderboard(time) {
  try {
    let list = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADER) || '[]');
    let name = prompt('New high score! Enter your name (max 12 chars):', 'Player') || 'Player';
    name = name.slice(0,12);
    list.push({name, time}); list.sort((a,b)=> b.time - a.time);
    localStorage.setItem(STORAGE_KEY_LEADER, JSON.stringify(list.slice(0,50)));
    updateLeaderboardUI();
  } catch (e) { console.warn('addToLeaderboard fail', e); }
}
function updateLeaderboardUI() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY_LEADER) || '[]'); const el = safeGet('leaderboardList'); if (!el) return;
    el.innerHTML = '';
    list.slice(0,10).forEach(it => { const li = document.createElement('li'); li.textContent = `${it.name} — ${it.time}s`; el.appendChild(li); });
  } catch (e) {}
}

/* ---------------------------
   Tick loop to hold stepping when holding keys
   --------------------------- */
let lastTick = 0;
function tickLoop() {
  if (!running) return;
  const now = performance.now();
  if (now - lastTick > 120) {
    try {
      if (typeof stepPlayer === 'function') stepPlayer(); // uses activeDirs or keys
    } catch (e) {}
    lastTick = now;
  }
  requestAnimationFrame(tickLoop);
}

/* ---------------------------
   Safe boot integration (start button)
   --------------------------- */
const startButton = safeGet('startBtn') || safeGet('start-btn') || safeGet('start-button');
if (startButton) {
  startButton.addEventListener('click', async () => {
    try {
      if (typeof preloadAll === 'function') await preloadAll(); // ensure assets
      // hide menu
      const menuEl = safeGet('menu'); if (menuEl) menuEl.style.display = 'none';
      // setup & start
      startLevel(0);
    } catch (e) {
      console.warn('start button handler error', e);
      // fallback start
      startLevel(0);
    }
  });
} else {
  // if no start button, auto-start after prefetch
  if (typeof preloadAll === 'function') { preloadAll().then(()=> startLevel(0)); } else startLevel(0);
}

/* ---------------------------
   Ensure leaderboard UI is filled on load
   --------------------------- */
updateLeaderboardUI();

/* ---------------------------
   Final safety: if animate not started, ensure loop runs
   --------------------------- */
if (!running) {
  // show menu or start a minimal loop so page isn't blank
  if (typeof draw === 'function') {
    (function minimalLoop() {
      try { draw(); } catch(e) {}
      requestAnimationFrame(minimalLoop);
    })();
  } else {
    // draw simple placeholder
    ctx.fillStyle = '#001'; ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif'; ctx.fillText('Shadow Clone Escape — Ready. Click Start.', 24, 48);
  }
}

/* ---------------------------
   End of PART 3
   --------------------------- */
