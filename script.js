/* ==================================================================================
   Shadow Clone Escape — Polished AAA-style script.js
   Paste this file into your repo root as script.js (next to index.html).
   It will try to load assets from:
     - "assets/..." first, then fallback to files in repo root.
   Edit ASSET_CANDIDATES if your filenames differ.
   ================================================================================== */

/* ========================= ASSET PATHS (edit if your filenames differ) ============ */
const ASSET_CANDIDATES = {
  ninja: ["assets/ninja_spritesheet.png", "ninja_spritesheet.png", "assets/characters/ninja_spritesheet.png"],
  clones: ["assets/clones_spritesheet.png", "clones_spritesheet.png", "assets/characters/clones_spritesheet.png"],
  portal: ["assets/portal_spritesheet.png", "portal_spritesheet.png", "assets/characters/portal_spritesheet.png"],
  power_speed: ["assets/powerup_speed.png", "powerup_speed.png", "assets/powerups/powerup_speed.png"],
  power_cloak: ["assets/powerup_cloak.png", "powerup_cloak.png", "assets/powerups/powerup_cloak.png"],
  power_clone: ["assets/powerup_clone.png", "powerup_clone.png", "assets/powerups/powerup_clone.png"],
  background: [
    ["assets/bg_layer1.png", "bg_layer1.png"],
    ["assets/bg_layer2.png", "bg_layer2.png"],
    ["assets/bg_layer3.png", "bg_layer3.png"],
    ["assets/bg_layer4.png", "bg_layer4.png"]
  ],
  audio: {
    bg: ["assets/bg_music_loop.wav", "assets/bg_music_loop.mp3", "bg_music_loop.wav", "bg_music_loop.mp3"],
    jump: ["assets/spawn.wav","assets/sfx_jump.wav","spawn.wav","sfx_jump.wav"],
    clone: ["assets/spawn.wav","assets/sfx_clone.wav","spawn.wav","sfx_clone.wav"],
    powerup: ["assets/powerup.wav","sfx_powerup.wav","powerup.wav","assets/powerup.wav"],
    portal: ["assets/portal.wav","sfx_portal.wav","portal.wav","assets/portal.wav"],
    death: ["assets/death.wav","death.wav"]
  }
};

/* ========================= DOM ELEMENTS ========================================== */
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
const leaderboardList = document.getElementById('leaderboardList');
const clearLeaderboardBtn = document.getElementById('clearLeaderboard');
const titleOverlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const notifArea = document.getElementById('notifArea');

/* ========================= UTILS: load with fallback ============================= */
function loadImageCandidates(candidates) {
  return new Promise((resolve) => {
    if (!Array.isArray(candidates)) candidates = [candidates];
    let i = 0;
    function tryNext() {
      if (i >= candidates.length) return resolve(null);
      const url = candidates[i++];
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
    let i = 0;
    function tryNext() {
      if (i >= candidates.length) return resolve(null);
      const url = candidates[i++];
      try {
        const a = new Audio();
        a.src = url;
        // check canplaythrough or error
        a.addEventListener('canplaythrough', () => resolve({ audio: a, url }), { once: true });
        a.addEventListener('error', () => tryNext(), { once: true });
      } catch (e) { tryNext(); }
    }
    tryNext();
  });
}

/* ========================= GAME CONFIG & STATE ================================ */
let cols = 19, rows = 19, tileSize = 30;
let maze = [], mazeCache = null;
let movesHistory = [], clones = [], powerups = [], particlesArr = [];
let frameCount = 0, running = false, startTime = 0, LEVEL = 1;
let cloneInterval = 300;
const STORAGE_KEY = 'shadow_clone_best';
const LEADER_KEY = 'shadow_clone_leaderboard';
const SETTINGS_KEY = 'shadow_clone_settings';
let SETTINGS = { music:true, sfx:true, difficulty:1 };
let ASSETS = { images: {}, audios: {}, backgrounds: [] };

/* ========================= HELPERS =========================================== */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now() - startTime)/1000); }
function safePlay(audio){ if(!audio) return; try{ audio.currentTime=0; audio.play().catch(()=>{}); }catch(e){} }

/* ========================= ASSET PRELOAD ===================================== */
async function preloadAll(){
  // images
  const ninja = await loadImageCandidates(ASSET_CANDIDATES.ninja);
  const clonesImg = await loadImageCandidates(ASSET_CANDIDATES.clones);
  const portal = await loadImageCandidates(ASSET_CANDIDATES.portal);
  ASSETS.images.ninjaSheet = ninja?.img ?? null;
  ASSETS.images.clonesSheet = clonesImg?.img ?? ASSETS.images.ninjaSheet;
  ASSETS.images.portalSheet = portal?.img ?? ASSETS.images.ninjaSheet;

  ASSETS.images.power_speed = (await loadImageCandidates(ASSET_CANDIDATES.power_speed))?.img;
  ASSETS.images.power_cloak = (await loadImageCandidates(ASSET_CANDIDATES.power_cloak))?.img;
  ASSETS.images.power_clone = (await loadImageCandidates(ASSET_CANDIDATES.power_clone))?.img;
  ASSETS.images.obstacles = (await loadImageCandidates(ASSET_CANDIDATES.obstacles))?.img;

  ASSETS.backgrounds = [];
  for(const bc of ASSET_CANDIDATES.background){
    const loaded = await loadImageCandidates(bc);
    ASSETS.backgrounds.push(loaded?.img ?? null);
  }

  // audio
  ASSETS.audios.bg = (await loadAudioCandidates(ASSET_CANDIDATES.audio.bg))?.audio;
  ASSETS.audios.jump = (await loadAudioCandidates(ASSET_CANDIDATES.audio.jump))?.audio;
  ASSETS.audios.clone = (await loadAudioCandidates(ASSET_CANDIDATES.audio.clone))?.audio;
  ASSETS.audios.powerup = (await loadAudioCandidates(ASSET_CANDIDATES.audio.powerup))?.audio;
  ASSETS.audios.portal = (await loadAudioCandidates(ASSET_CANDIDATES.audio.portal))?.audio;
  ASSETS.audios.death = (await loadAudioCandidates(ASSET_CANDIDATES.audio.death))?.audio;

  if(ASSETS.audios.bg){ ASSETS.audios.bg.loop = true; ASSETS.audios.bg.volume = 0.45; }
  if(ASSETS.audios.jump) ASSETS.audios.jump.volume = 0.9;
  if(ASSETS.audios.clone) ASSETS.audios.clone.volume = 0.9;
  if(ASSETS.audios.powerup) ASSETS.audios.powerup.volume = 0.9;
  if(ASSETS.audios.portal) ASSETS.audios.portal.volume = 0.95;
  if(ASSETS.audios.death) ASSETS.audios.death.volume = 0.9;

  console.log("Loaded assets:", {
    ninja: !!ASSETS.images.ninjaSheet,
    cloneSheet: !!ASSETS.images.clonesSheet,
    portal: !!ASSETS.images.portalSheet,
    bgAudio: !!ASSETS.audios.bg
  });
}

/* ========================= CANVAS SIZING & GRID ============================== */
function resizeCanvas(){
  const maxW = Math.min(window.innerWidth - 40, 980);
  const width = Math.min(maxW, 960);
  gameCanvas.style.width = width + 'px';
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * 0.66);
  gameCanvas.width = Math.floor(logicalW * ratio);
  gameCanvas.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);

  const cssW = gameCanvas.clientWidth || logicalW;
  const cssH = gameCanvas.clientHeight || logicalH;
  const preferred = window.innerWidth < 720 ? 26 : 30;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(cssH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, cssH / rows));

  miniMap.width = 280 * (window.devicePixelRatio || 1);
  miniMap.height = 160 * (window.devicePixelRatio || 1);
  miniMap.style.width = '140px';
  miniMap.style.height = '80px';
  miniCtx.setTransform(window.devicePixelRatio || 1,0,0,window.devicePixelRatio || 1,0,0);
}
window.addEventListener('resize', resizeCanvas);

/* ========================= MAZE GENERATOR ==================================== */
function generateMaze(c,r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x] = 0;
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

/* ========================= CACHE MAZE ======================================= */
function cacheMaze(){
  if(!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');

  if(ASSETS.backgrounds[0]){
    mctx.drawImage(ASSETS.backgrounds[0], 0, 0, mazeCache.width, mazeCache.height);
  } else {
    mctx.fillStyle = '#070707';
    mctx.fillRect(0,0,mazeCache.width,mazeCache.height);
  }

  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
        mctx.fillStyle = '#222';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        mctx.fillStyle = 'rgba(0,0,0,0.06)';
        mctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        mctx.fillStyle = '#0b0b0b';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* ========================= PORTAL SPAWN ===================================== */
let PORTAL = null;
function spawnPortal(){
  let best=null, bestd=-1;
  for(let y=rows-2;y>=1;y--){
    for(let x=cols-2;x>=1;x--){
      if(maze[y][x]===0 && !(x===1 && y===1)){
        const d = Math.abs(x-1) + Math.abs(y-1);
        if(d>bestd){ bestd=d; best={x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* ========================= RESET GAME ======================================= */
let player = null;
function loadSettings(){ try{ const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if(s) SETTINGS = {...SETTINGS,...s}; }catch(e){} if(difficultyEl) difficultyEl.value = SETTINGS.difficulty; }
function saveSettings(){ if(difficultyEl) SETTINGS.difficulty = Number(difficultyEl.value); localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); }

function resetGame(){
  saveSettings();
  resizeCanvas();
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'lime' };
  movesHistory = [];
  clones = [];
  powerups = [];
  particlesArr = [];
  frameCount = 0;
  cloneInterval = Math.max(50, 300 - (SETTINGS.difficulty - 1) * 80);
  running = true;
  startTime = Date.now();
  spawnPortal();
  bestRecordText && (bestRecordText.textContent = (Number(localStorage.getItem(STORAGE_KEY)) || 0) ? `Best: ${Number(localStorage.getItem(STORAGE_KEY))}s` : 'Best: —');
  statusText && (statusText.textContent = 'Survive as long as you can');
  timerText && (timerText.textContent = 'Time: 0s');
  restartBtn && (restartBtn.style.display = 'none');
  menuBtn && (menuBtn.style.display = 'none');
}

/* ========================= POWERUPS ========================================= */
const POWER_TYPES = ['speed','cloak','shock'];
let activePower = null;
function spawnPowerup(){
  let attempts=0;
  while(attempts++<200){
    const x = randInt(1, cols-2), y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      powerups.push({ x,y,type:POWER_TYPES[randInt(0,POWER_TYPES.length-1)], spawned: Date.now(), bob: Math.random()*Math.PI*2 });
      return;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type==='cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type==='shock'){ clones.forEach(c=> c.index = Math.max(0, (c.index||0) - 28)); }
  if(SETTINGS.sfx && ASSETS.audios.powerup) safePlay(ASSETS.audios.powerup);
  showNotification(`${type.toUpperCase()}!`);
}

/* ========================= PARTICLES ======================================= */
function spawnParticles(px,py,color){
  for(let i=0;i<22;i++){
    particlesArr.push({ x:px + (Math.random()-0.5)*tileSize, y:py + (Math.random()-0.5)*tileSize, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:30 + Math.random()*40, color });
  }
}
function updateParticles(){
  for(let i=particlesArr.length-1;i>=0;i--){
    const p = particlesArr[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.06;
    p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particlesArr.splice(i,1);
  }
}
function drawParticles(ctx){
  for(const p of particlesArr){ ctx.globalAlpha = Math.max(0, p.life/70); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3,3); } ctx.globalAlpha = 1;
}

/* ========================= CLONE CLASS ====================================== */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
    this.spawnFrame = frameCount;
  }
  update(){
    if(this.type === 'fast') this.index += 1 + (Math.random() < 0.45 ? 1 : 0);
    else if(this.type === 'wraith'){
      if(Math.random() < 0.01 + Math.min(0.05, frameCount/60000)){
        const jump = Math.min(50, Math.floor(Math.random()*Math.min(200, this.path.length)));
        this.index = Math.min(this.path.length - 1, this.index + jump);
      } else this.index++;
    } else this.index++;
    if(this.index < this.path.length){ this.x = this.path[this.index].x; this.y = this.path[this.index].y; }
  }
  draw(ctx){
    const img = ASSETS.images.clonesSheet;
    if(img){
      const colsFrames = Math.max(1, Math.floor(img.naturalWidth / tileSize));
      const rowsFrames = Math.max(1, Math.floor(img.naturalHeight / tileSize));
      const row = this.type==='wraith' ? Math.min(rowsFrames-1,2) : (this.type==='fast' ? Math.min(rowsFrames-1,1) : 0);
      const col = Math.floor((frameCount/6) % colsFrames);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, col*tileSize, row*tileSize, tileSize, tileSize, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = this.type==='wraith' ? '#b14' : this.type==='fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
      ctx.globalAlpha = 1;
    }
  }
}

/* ========================= INPUT & STEPPING ================================== */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(e.key==='ArrowUp' || e.key==='w'){ activeDirs.up = true; stepPlayer(); tryPlay('jump'); }
  if(e.key==='ArrowDown' || e.key==='s'){ activeDirs.down = true; stepPlayer(); }
  if(e.key==='ArrowLeft' || e.key==='a'){ activeDirs.left = true; stepPlayer(); }
  if(e.key==='ArrowRight' || e.key==='d'){ activeDirs.right = true; stepPlayer(); }
});
document.addEventListener('keyup', (e)=>{
  if(e.key==='ArrowUp' || e.key==='w') activeDirs.up = false;
  if(e.key==='ArrowDown' || e.key==='s') activeDirs.down = false;
  if(e.key==='ArrowLeft' || e.key==='a') activeDirs.left = false;
  if(e.key==='ArrowRight' || e.key==='d') activeDirs.right = false;
});

function playFootstep(){ if(SETTINGS.sfx && ASSETS.audios.jump) safePlay(ASSETS.audios.jump); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type==='speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (SETTINGS.difficulty-1)*8));
  if(now - lastStepTime < ms) return;
  lastStepTime = now;
  if(!running) return;

  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--;
  else if(activeDirs.down) ny++;
  else if(activeDirs.left) nx--;
  else if(activeDirs.right) nx++;

  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny][nx] === 0){
    player.x = nx; player.y = ny;
    movesHistory.push({x:nx,y:ny});
    for(let i=powerups.length-1;i>=0;i--){
      if(powerups[i].x===nx && powerups[i].y===ny){
        applyPowerup(powerups[i].type);
        powerups.splice(i,1);
        break;
      }
    }
  }
}

/* D-pad mobile */
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

btnPower?.addEventListener('click', ()=>{ applyPowerup('shock'); });

/* ========================= SPAWN CLONE ====================================== */
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
  if(SETTINGS.sfx && ASSETS.audios.clone) safePlay(ASSETS.audios.clone);
  spawnParticles((c.x||player.x)*tileSize + tileSize/2, (c.y||player.y)*tileSize + tileSize/2, '#ff4466');
  showNotification(`${type.toUpperCase()} CLONE!`);
}

/* ========================= GAME OVER & LEADERBOARD ========================== */
function gameOver(){
  running = false;
  if(SETTINGS.music && ASSETS.audios.bg) try{ ASSETS.audios.bg.pause(); }catch(e){}
  if(SETTINGS.sfx && ASSETS.audios.death) safePlay(ASSETS.audios.death);
  const elapsed = nowSec();
  const prevBest = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  if(elapsed > prevBest){
    localStorage.setItem(STORAGE_KEY, elapsed);
    if(SETTINGS.sfx && ASSETS.audios.powerup) safePlay(ASSETS.audios.powerup);
    statusText.textContent = `☠️ You survived ${elapsed}s — NEW RECORD!`;
    addToLeaderboard(elapsed);
  } else statusText.textContent = `☠️ You survived ${elapsed}s (Best: ${prevBest}s)`;
  spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66');
  restartBtn.style.display = 'inline-block';
  menuBtn && (menuBtn.style.display = 'inline-block');
}

function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):','Player') || 'Player';
  name = name.slice(0,12);
  list.push({name, time});
  list.sort((a,b)=> b.time - a.time);
  localStorage.setItem(LEADER_KEY, JSON.stringify(list.slice(0,50)));
  updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem(LEADER_KEY) || '[]');
  if(!leaderboardList) return;
  leaderboardList.innerHTML = '';
  list.slice(0,10).forEach(it=>{
    const li = document.createElement('li');
    li.textContent = `${it.name} — ${it.time}s`;
    leaderboardList.appendChild(li);
  });
}
clearLeaderboardBtn?.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(LEADER_KEY); updateLeaderboardUI(); } });

/* ========================= DRAW HELPERS ===================================== */
function drawMaze(){
  if(mazeCache) ctx.drawImage(mazeCache,0,0);
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
    const img = pu.type==='speed' ? ASSETS.images.power_speed : pu.type==='cloak' ? ASSETS.images.power_cloak : ASSETS.images.power_clone;
    if(img) ctx.drawImage(img, px - tileSize*0.32, py - tileSize*0.32, tileSize*0.64, tileSize*0.64);
    else {
      ctx.fillStyle = pu.type==='speed' ? '#4fd1ff' : pu.type==='cloak' ? '#9be7b0' : '#bfe8ff';
      ctx.fillRect(pu.x*tileSize + tileSize*0.2, pu.y*tileSize + tileSize*0.2, tileSize*0.6, tileSize*0.6);
    }
  }
}

function drawPortal(){
  if(!PORTAL) return;
  const img = ASSETS.images.portalSheet;
  if(img){
    const colsFrames = Math.max(1, Math.floor(img.naturalWidth / tileSize));
    const frame = Math.floor(frameCount/6) % colsFrames;
    ctx.drawImage(img, frame*tileSize, 0, tileSize, tileSize, PORTAL.x*tileSize, PORTAL.y*tileSize, tileSize, tileSize);
  } else {
    ctx.fillStyle = '#66ffcc'; ctx.fillRect(PORTAL.x*tileSize + 2, PORTAL.y*tileSize + 2, tileSize-4, tileSize-4);
  }
}

function drawMiniMap(){
  const mmW = miniMap.width / (window.devicePixelRatio || 1), mmH = miniMap.height / (window.devicePixelRatio || 1);
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707'; miniCtx.fillRect(x*cw, y*ch, cw, ch); }
  for(const c of clones){ miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666'; miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9)); }
  miniCtx.fillStyle = '#66ff99'; miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){ miniCtx.fillStyle = pu.type==='speed' ? '#4fd1ff' : pu.type==='cloak' ? '#9be7b0' : '#bfe8ff'; miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6); }
}

/* ========================= HUD & NOTIFICATIONS ============================== */
function updateHUD(){
  timerText && (timerText.textContent = `Time: ${nowSec()}s`);
  if(activePower && Date.now() < activePower.until){
    const rem = Math.ceil((activePower.until - Date.now())/1000);
    powerupBox && (powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`);
  } else { powerupBox && (powerupBox.innerHTML = ''); if(activePower && Date.now() >= activePower.until) activePower = null; }
}

function showNotification(text, color='#fff'){
  if(!notifArea) return;
  const el = document.createElement('div');
  el.className = 'notif';
  el.style.color = color;
  el.textContent = text;
  notifArea.appendChild(el);
  setTimeout(()=>{ el.style.transition='transform .45s, opacity .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); }, 1400);
}

/* ========================= MAIN LOOP ======================================== */
let lastFrame = performance.now();
function animate(now){
  if(!running) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + (SETTINGS.difficulty-1)*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(Math.random() < 0.02 + (SETTINGS.difficulty-1)*0.03) spawnClone();
    if(cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - (SETTINGS.difficulty-1));
  }

  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i];
    c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type==='cloak' && Date.now() < activePower.until)){
        gameOver(); return;
      }
    }
  }

  updateParticles();

  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  drawMaze();
  drawPowerups();
  for(const c of clones) c.draw(ctx);

  // smooth player rendering (lerp)
  const speed = 12 + (SETTINGS.difficulty-1)*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i];
    const alpha = (i - Math.max(0, movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha*0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // draw player sprite (from ninjaSheet) or fallback
  const ninjaImg = ASSETS.images.ninjaSheet;
  if(ninjaImg){
    const colsFrames = Math.max(1, Math.floor(ninjaImg.naturalWidth / tileSize));
    const animCol = Math.floor((frameCount / 6) % colsFrames);
    const animRow = 0;
    ctx.drawImage(ninjaImg, animCol*tileSize, animRow*tileSize, tileSize, tileSize, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    ctx.save();
    const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
    ctx.shadowBlur = 18 * pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)';
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  drawParticles(ctx);
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* ========================= TRANSITION TO NEXT LEVEL ========================= */
function transitionToNextLevel(){
  running = false;
  let t = 0, dur = 22;
  function anim(){
    ctx.save();
    const s = 1 + 0.06 * Math.sin(Math.PI * (t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, - (s-1)*cx, - (s-1)*cy);
    drawMaze(); drawPortal(); for(const c of clones) c.draw(ctx);
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${t/dur * 0.95})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t <= dur) requestAnimationFrame(anim);
    else { LEVEL++; resetGame(); running = true; lastFrame = performance.now(); requestAnimationFrame(animate); }
  }
  anim();
}

/* ========================= AUDIO PLAY HELPER =============================== */
function tryPlay(name){
  if(!SETTINGS.sfx) return;
  const a = ASSETS.audios[name];
  if(!a) return;
  try{ a.currentTime = 0; a.play().catch(()=>{}); }catch(e){}
}

/* ========================= TICK LOOP (hold dirs) =========================== */
let lastTick = 0;
function tickLoop(){
  if(!running) return;
  const now = performance.now();
  if(now - lastTick > 120){
    if(activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer();
    lastTick = now;
  }
  requestAnimationFrame(tickLoop);
}

/* ========================= UI BINDINGS ===================================== */
startBtn?.addEventListener('click', startRun);
startBtnOverlay?.addEventListener('click', startRun);
tutorialBtn?.addEventListener('click', ()=>{ if(tutorialBox) tutorialBox.style.display = tutorialBox.style.display === 'none' ? 'block' : 'none'; });
settingsBtn?.addEventListener('click', ()=>{ if(settingsBox) settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none'; });
restartBtn?.addEventListener('click', ()=>{ resetGame(); if(SETTINGS.music && ASSETS.audios.bg) safePlay(ASSETS.audios.bg); lastFrame = performance.now(); requestAnimationFrame(animate); });
menuBtn?.addEventListener('click', ()=>{ running = false; document.getElementById('menu') && (document.getElementById('menu').style.display = 'block'); document.getElementById('ui') && (document.getElementById('ui').classList.add('panel-hidden')); mobileControls && mobileControls.classList.add('hidden'); if(ASSETS.audios.bg) try{ ASSETS.audios.bg.pause(); }catch(e){} });
menuBtnHeader?.addEventListener('click', ()=>{ document.getElementById('menu') && (document.getElementById('menu').style.display = 'block'); });

difficultyEl?.addEventListener('input', ()=>{ saveSettings(); });
clearLeaderboardBtn?.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(LEADER_KEY); updateLeaderboardUI(); } });

btnPower?.addEventListener('click', ()=>{ applyPowerup('shock'); });

/* ========================= GAME BOOTSTRAP ================================== */
async function boot(){
  resizeCanvas();
  loadSettings();
  await preloadAll();
  resetGame();
  tickLoop();
  updateLeaderboardUI();
  if(titleOverlay) titleOverlay.style.display = 'flex';
}
function startRun(){
  if(titleOverlay) titleOverlay.style.display = 'none';
  hud && hud.classList.remove('panel-hidden');
  try{ if(ASSETS.audios.bg && SETTINGS.music) ASSETS.audios.bg.play().catch(()=>{}); }catch(e){}
  lastFrame = performance.now(); running = true; requestAnimationFrame(animate);
}

/* ========================= NOTIFICATIONS & DEBUG ========================== */
function showNotification(msg){ showNotification(msg); }

/* ========================= EXPOSE HELPERS ================================= */
window.__SHADOWCLONE = { resetGame, spawnPowerup, spawnClone, ASSETS };

/* ========================= START BOOT ===================================== */
boot();

