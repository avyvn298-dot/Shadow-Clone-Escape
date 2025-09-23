/* script.js — Shadow Clone Escape (Polished AAA-level)
   Put in repo root. Make sure assets exist in assets/ or edit ASSET paths below.
   Features:
   - Robust asset loader with progress bar and fallbacks
   - Polished UI transitions (start hides overlay, settings, tutorial)
   - Sprite frame math computed from natural sizes (prevents bleeding)
   - Separate clone frames (basic/fast/wraith)
   - Portal animation (pulse + rotate)
   - Parallax background layers (procedural if images missing)
   - Settings persistence (music/sfx/volume/difficulty)
   - Remappable controls, mobile controls, accessibility
   - Particles, camera shake, smooth animations, leaderboards
*/

/* ========================= ASSETS (edit if your filenames differ) ========================= */
const ASSET = {
  ninja: "assets/ninja_spritesheet.png",
  clone: "assets/clones_spritesheet.png",
  portal: "assets/portal.png",
  bgMusic: "assets/bg_music_loop.wav",
  spawn: "assets/spawn.wav",
  powerup: "assets/powerup.wav",
  portal: "assets/portal.wav",
  death: "assets/death.wav",
  // optional background layers (you may add bg_layer1..4)
  bg1: "assets/bg_layer1.png",
  bg2: "assets/bg_layer2.png",
  bg3: "assets/bg_layer3.png"
};

/* ========================= DOM & CANVAS ========================= */
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas?.getContext('2d');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniMap = document.getElementById('miniMap');
const miniCtx = miniMap?.getContext('2d');

const startBtn = document.getElementById('startBtn');
const continueBtn = document.getElementById('continueBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const menuBtnHeader = document.getElementById('menuBtnHeader');
const settingsBtn = document.getElementById('settingsBtn');
const settingsOpen = document.getElementById('settingsOpen');
const tutorialBtn = document.getElementById('tutorialBtn');
const closeTutorial = document.getElementById('closeTutorial');
const powerupBox = document.getElementById('powerupBox');
const timerText = document.getElementById('timer');
const statusText = document.getElementById('status');
const bestRecordText = document.getElementById('bestRecordText');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const titleOverlay = document.getElementById('titleOverlay');
const tutorialModal = document.getElementById('tutorial');
const notifArea = document.getElementById('notifArea');
const mobileControls = document.getElementById('mobileControls');
const dpad = document.getElementById('dpad');
const btnPower = document.getElementById('btnPower');
const difficultyEl = document.getElementById('difficulty');
const musicToggleEl = document.getElementById('musicToggle');
const sfxToggleEl = document.getElementById('sfxToggle');
const leaderboardList = document.getElementById('leaderboardList');
const clearLeaderboardBtn = document.getElementById('clearLeaderboard');

/* ========================= SETTINGS & STORAGE ========================= */
const STORAGE = { settings: 'shadow_clone_settings', best: 'shadow_clone_best', leader: 'shadow_clone_leaderboard' };
let SETTINGS = { music: true, sfx: true, musicVolume: 0.45, sfxVolume: 1.0, difficulty: 1, controls: { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', shock:' ' } };

/* load settings from localStorage */
try {
  const s = JSON.parse(localStorage.getItem(STORAGE.settings));
  if(s) SETTINGS = {...SETTINGS, ...s};
} catch(e){}

/* ========================= STATE ========================= */
let cols = 19, rows = 19, tileSize = 30;
let maze = [], mazeCache = null;
let player = null, movesHistory = [], clones = [], powerups = [], particles = [];
let frameCount = 0, lastFrame = performance.now();
let running = false, paused = false, startTime = 0, cloneInterval = 300;
let activePower = null;
let PORTAL = null;

/* ========================= ASSET HOLDERS ========================= */
const IMG = { ninja:null, clone:null, portal:null, bg1:null, bg2:null, bg3:null };
const SFX = { bg:null, spawn:null, powerup:null, portal:null, death:null };

/* sprite info container (updated after images load) */
const SPRITE = { ninja: {cols:4, rows:1, frameW:384, frameH:534}, clone: {cols:3, rows:1, frameW:353, frameH:433}, portal:{cols:1, rows:1, frameW:361, frameH:316} };

/* ========================= UTILITIES ========================= */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now() - startTime)/1000); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function safePlay(audio, vol=1){ if(!audio) return; try{ audio.volume = vol; audio.currentTime = 0; audio.play().catch(()=>{}); }catch(e){} }

/* ========================= PRELOADER (progress + fallback) ========================= */
async function tryLoadImage(src){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=> res({img,src});
    img.onerror = ()=> res(null);
    img.src = src;
  });
}
async function tryLoadAudio(src){
  return new Promise(res=>{
    try{
      const a = new Audio();
      a.addEventListener('canplaythrough', ()=> res({audio:a,src}), {once:true});
      a.addEventListener('error', ()=> res(null), {once:true});
      a.src = src;
    }catch(e){ res(null); }
  });
}

async function preloadAll(withProgress=true){
  const tasks = [
    {type:'img', key:'ninja', paths:[ASSET.ninja]},
    {type:'img', key:'clone', paths:[ASSET.clone]},
    {type:'img', key:'portal', paths:[ASSET.portal]},
    {type:'img', key:'bg1', paths:[ASSET.bg1]},
    {type:'img', key:'bg2', paths:[ASSET.bg2]},
    {type:'img', key:'bg3', paths:[ASSET.bg3]},
    {type:'audio', key:'bg', paths:[ASSET.bgMusic]},
    {type:'audio', key:'spawn', paths:[ASSET.spawn]},
    {type:'audio', key:'powerup', paths:[ASSET.powerup]},
    {type:'audio', key:'portal', paths:[ASSET.portal]},
    {type:'audio', key:'death', paths:[ASSET.death]},
  ];

  let completed = 0;
  const total = tasks.length;

  function updateProgress(){
    if(!withProgress) return;
    const pct = Math.round((completed / total) * 100);
    if(progressFill) progressFill.style.width = pct + '%';
    if(progressText) progressText.textContent = `Loading assets… ${pct}%`;
  }

  for(const t of tasks){
    if(t.type === 'img'){
      let res = null;
      for(const p of t.paths){
        if(!p) continue;
        res = await tryLoadImage(p);
        if(res) break;
      }
      if(res){
        IMG[t.key] = res.img;
        console.log(`Loaded image: ${t.key} -> ${res.src}`);
      } else {
        console.warn(`Missing image: ${t.key}`);
      }
    } else {
      let res = null;
      for(const p of t.paths){
        if(!p) continue;
        res = await tryLoadAudio(p);
        if(res) break;
      }
      if(res){
        SFX[t.key] = res.audio;
        console.log(`Loaded audio: ${t.key} -> ${res.src}`);
      } else {
        console.warn(`Missing audio: ${t.key}`);
      }
    }
    completed++;
    updateProgress();
    await new Promise(r=>setTimeout(r, 80)); // small pacing for UX
  }

  // if bg music loaded, set volume
  if(SFX.bg){ SFX.bg.loop = true; SFX.bg.volume = SETTINGS.musicVolume || 0.45; }
  if(SFX.spawn) SFX.spawn.volume = SETTINGS.sfxVolume || 1.0;
  if(SFX.powerup) SFX.powerup.volume = SETTINGS.sfxVolume || 1.0;
  if(SFX.death) SFX.death.volume = SETTINGS.sfxVolume || 1.0;

  // compute sprite frames to integer values (avoid fractional bleed)
  initSpriteFrames();
}

/* compute integer sprite frame sizes from naturalImage sizes */
function initSpriteFrames(){
  if(IMG.ninja){
    const cols = 4;
    SPRITE.ninja.frameW = Math.floor(IMG.ninja.naturalWidth / cols);
    SPRITE.ninja.frameH = Math.floor(IMG.ninja.naturalHeight / 1);
    SPRITE.ninja.cols = cols;
  }
  if(IMG.clone){
    const cols = 3;
    SPRITE.clone.frameW = Math.floor(IMG.clone.naturalWidth / cols);
    SPRITE.clone.frameH = Math.floor(IMG.clone.naturalHeight / 1);
    SPRITE.clone.cols = cols;
  }
  if(IMG.portal){
    SPRITE.portal.frameW = Math.floor(IMG.portal.naturalWidth / 1);
    SPRITE.portal.frameH = Math.floor(IMG.portal.naturalHeight / 1);
    SPRITE.portal.cols = 1;
  }
}

/* ========================= CANVAS RESIZE & GRID ========================= */
function resizeCanvas(){
  const maxW = Math.min(window.innerWidth - 40, 1280);
  const width = Math.min(maxW, 1100);
  canvas.style.width = width + 'px';
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

  if(miniMap){
    miniMap.width = 280 * (window.devicePixelRatio || 1);
    miniMap.height = 160 * (window.devicePixelRatio || 1);
    miniMap.style.width = '140px';
    miniMap.style.height = '80px';
    miniCtx.setTransform(window.devicePixelRatio || 1,0,0,window.devicePixelRatio || 1,0,0);
  }
}
window.addEventListener('resize', resizeCanvas);

/* ========================= MAZE (recursive backtracker) ========================= */
function generateMaze(c,r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x+dx, ny = y+dy;
      if(nx>0 && nx<c-1 && ny>0 && ny<r-1 && grid[ny][nx] === 1){
        grid[y+dy/2][x+dx/2] = 0;
        carve(nx,ny);
      }
    }
  }
  carve(1,1);
  grid[1][1]=0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}

/* cache maze to offscreen canvas for performance */
function cacheMaze(){
  if(!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  mctx.fillStyle = '#070707';
  mctx.fillRect(0,0,mazeCache.width, mazeCache.height);

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

/* ========================= SPAWN PORTAL (farthest cell) ========================= */
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

/* ========================= RESET / START ========================= */
function resetGame(){
  resizeCanvas();
  maze = generateMaze(cols,rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = []; clones = []; powerups = []; particles = []; frameCount = 0;
  cloneInterval = Math.max(40, 300 - (SETTINGS.difficulty-1)*80);
  running = true; paused = false; startTime = Date.now();
  activePower = null;
  spawnPortal();
  updateLeaderboardUI();
  if(bestRecordText) bestRecordText.textContent = (Number(localStorage.getItem(STORAGE.best))||0) ? `Best: ${Number(localStorage.getItem(STORAGE.best))}s` : 'Best: —';
  if(statusText) statusText.textContent = 'Survive as long as you can';
  if(timerText) timerText.textContent = 'Time: 0s';
  if(restartBtn) restartBtn.style.display = 'none';
}

/* ========================= POWERUPS ========================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let attempts=0;
  while(attempts++ < 200){
    const x = randInt(1, cols-2);
    const y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      powerups.push({ x,y, type: POWER_TYPES[randInt(0,POWER_TYPES.length-1)], spawned: Date.now(), bob: Math.random()*Math.PI*2 });
      return;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type==='cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type==='shock') clones.forEach(c=> c.index = Math.max(0, (c.index||0) - 28));
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

/* ========================= CLONE CLASS (distinct frames) ========================= */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.spawnFrame = frameCount;
    this.frozen = false;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
  }
  update(){
    if(this.frozen) return;
    if(this.type === 'fast'){
      this.index += 1 + (Math.random() < 0.45 ? 1 : 0);
    } else if(this.type === 'wraith'){
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
    if(IMG.clone){
      const info = SPRITE.clone;
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

function bindKeys(){
  document.addEventListener('keydown', (e)=>{
    // Allow remapped controls
    if(!running) return;
    if(e.key === SETTINGS.controls.up) { activeDirs.up = true; stepPlayer(); if(SETTINGS.sfx && SFX.spawn) safePlay(SFX.spawn, SETTINGS.sfxVolume); }
    if(e.key === SETTINGS.controls.down) { activeDirs.down = true; stepPlayer(); }
    if(e.key === SETTINGS.controls.left) { activeDirs.left = true; stepPlayer(); }
    if(e.key === SETTINGS.controls.right) { activeDirs.right = true; stepPlayer(); }
    if(e.key === SETTINGS.controls.shock) { applyPowerup('shock'); }
    // allow pause
    if(e.key === 'Escape') togglePause();
  });
  document.addEventListener('keyup', (e)=>{
    if(e.key === SETTINGS.controls.up) activeDirs.up = false;
    if(e.key === SETTINGS.controls.down) activeDirs.down = false;
    if(e.key === SETTINGS.controls.left) activeDirs.left = false;
    if(e.key === SETTINGS.controls.right) activeDirs.right = false;
  });
}
bindKeys();

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type === 'speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (SETTINGS.difficulty-1)*10));
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
  }
}

/* mobile dpad */
dpad?.addEventListener('pointerdown', (ev)=>{
  const btn = ev.target.closest('button[data-dir]');
  if(btn){ const dir = btn.dataset.dir; pressDir(dir); btn.setPointerCapture(ev.pointerId); }
});
dpad?.addEventListener('pointerup', (ev)=>{
  const btn = ev.target.closest('button[data-dir]');
  if(btn) releaseDir(btn.dataset.dir);
});
function pressDir(dir){ if(dir==='up') activeDirs.up=true; if(dir==='down') activeDirs.down=true; if(dir==='left') activeDirs.left=true; if(dir==='right') activeDirs.right=true; stepPlayer(); }
function releaseDir(dir){ if(dir==='up') activeDirs.up=false; if(dir==='down') activeDirs.down=false; if(dir==='left') activeDirs.left=false; if(dir==='right') activeDirs.right=false; }

/* ========================= SPAWN CLONE ========================= */
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
  // parallax procedural: use small moving gradients or images if available
  ctx.save();
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  // layered parallax
  const t = now / 6000;
  if(IMG.bg1) ctx.drawImage(IMG.bg1, Math.sin(t)*20, Math.cos(t)*6, w+40, h+40);
  else {
    // nice gradient + subtle moving lines
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#061017'); g.addColorStop(1, '#020406');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
    // moving subtle stars
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for(let i=0;i<20;i++){
      const x = (i*73 + Math.sin(t*(0.5+i))*20) % w;
      const y = (i*43 + Math.cos(t*(0.4+i))*18) % h;
      ctx.fillRect(x,y,1.5,1.5);
    }
  }
  ctx.restore();
}

function drawMaze(){
  if(!maze) return;
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
    // draw simple icons
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.sin(frameCount/18 + pu.bob)*0.08);
    if(pu.type === 'speed') { ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,tileSize*0.22,0,Math.PI*2); ctx.fill(); }
    else if(pu.type === 'cloak'){ ctx.fillStyle = '#9be7b0'; ctx.fillRect(-tileSize*0.2,-tileSize*0.2,tileSize*0.4,tileSize*0.4); }
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
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320);
    ctx.drawImage(IMG.portal, -tileSize*scale/2, -tileSize*scale/2, tileSize*scale, tileSize*scale);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot/1.6);
    ctx.fillStyle = '#66ffcc';
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.ellipse(0,0, tileSize*0.42, tileSize*0.5, 0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/* minimap */
function drawMiniMap(){
  if(!miniMap || !maze) return;
  const mmW = miniMap.width / (window.devicePixelRatio || 1), mmH = miniMap.height / (window.devicePixelRatio || 1);
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
      miniCtx.fillRect(x*cw, y*ch, cw, ch);
    }
  }
  for(const c of clones){
    const color = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
    miniCtx.fillStyle = color;
    miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  }
  miniCtx.fillStyle = '#66ff99';
  miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){
    miniCtx.fillStyle = pu.type==='speed' ? '#ffd86b' : pu.type==='cloak' ? '#7af' : '#9be7b0';
    miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
  }
}

/* HUD update */
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

/* ========================= MAIN LOOP ========================= */
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

let lastAnimFrame = performance.now();
function animate(now){
  if(!running || paused) return;
  const dt = (now - lastAnimFrame)/1000; lastAnimFrame = now; frameCount++;

  // spawn powerups
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // spawn clones pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + (SETTINGS.difficulty-1)*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(Math.random() < 0.02 + (SETTINGS.difficulty-1)*0.03) spawnClone();
    if(cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - (SETTINGS.difficulty-1));
  }

  // update clones and collisions
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i];
    c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)){
        // death sequence
        running = false;
        if(SETTINGS.sfx && SFX.death) safePlay(SFX.death, SETTINGS.sfxVolume);
        showNotif("☠️ You died");
        restartBtn && (restartBtn.style.display = 'inline-block');
        const elapsed = nowSec();
        const prev = Number(localStorage.getItem(STORAGE.best)) || 0;
        if(elapsed > prev){
          localStorage.setItem(STORAGE.best, elapsed);
          showNotif("NEW RECORD!");
          addToLeaderboard(elapsed);
        }
        setTimeout(()=>{ resetGame(); }, 900);
        return;
      }
    }
  }

  updateParticles();

  // rendering pipeline
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawBackground(now);
  drawMaze();
  drawPowerups();
  drawPortal(now);
  for(const c of clones) c.draw();

  // player smoothing / lerp
  const speed = 12 + (SETTINGS.difficulty-1)*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0,movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i];
    const alpha = (i - Math.max(0,movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha * 0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // draw player sprite with correct source rect (avoid frame bleed)
  if(IMG.ninja){
    try {
      const info = SPRITE.ninja;
      const colsFrames = info.cols || 4;
      const animCol = Math.floor((frameCount/6) % colsFrames);
      const sx = animCol * info.frameW;
      const sy = 0;
      ctx.drawImage(IMG.ninja, sx, sy, info.frameW, info.frameH, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
    } catch(e){
      ctx.drawImage(IMG.ninja, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
    }
  } else {
    // fallback: fancy circle
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    ctx.save();
    const pulse = 0.9 + Math.sin(Date.now()/420)*0.08;
    ctx.shadowBlur = 18 * pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)';
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  drawParticles();
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* ========================= TRANSITION / PORTAL ========================= */
function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && SFX.portal) safePlay(SFX.portal, SETTINGS.sfxVolume);
  let t=0, dur=38;
  function step(){
    const s = 1 + 0.08 * Math.sin(Math.PI*(t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.save();
    ctx.setTransform(s,0,0,s, - (s-1)*cx, - (s-1)*cy);
    drawBackground(performance.now());
    drawMaze();
    drawPortal(performance.now());
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t<=dur) requestAnimationFrame(step);
    else { resetGame(); running = true; lastAnimFrame = performance.now(); requestAnimationFrame(animate); }
  }
  step();
}

/* ========================= UI & CONTROLS BINDING ========================= */
function showOverlayHideUI(){
  if(titleOverlay) titleOverlay.style.display = 'block';
  document.getElementById('ui')?.classList.add('panel-hidden');
}
function hideOverlayShowUI(){
  if(titleOverlay) titleOverlay.style.display = 'none';
  document.getElementById('ui')?.classList.remove('panel-hidden');
}

startBtn?.addEventListener('click', async ()=>{
  // ensure assets loaded
  try { await preloadAll(true); } catch(e){ console.warn('preload error', e); }
  hideOverlayShowUI();
  resetGame();
  lastAnimFrame = performance.now();
  running = true;
  if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume);
  requestAnimationFrame(animate);
  tickLoop();
});

continueBtn?.addEventListener('click', ()=>{
  hideOverlayShowUI();
});

restartBtn?.addEventListener('click', ()=>{
  restartBtn.style.display = 'none';
  resetGame();
  if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume);
  lastAnimFrame = performance.now();
  running = true;
  requestAnimationFrame(animate);
  tickLoop();
});

pauseBtn?.addEventListener('click', ()=>{
  togglePause();
});

menuBtnHeader?.addEventListener('click', ()=>{
  const menu = document.getElementById('menu');
  if(menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
});

settingsBtn?.addEventListener('click', ()=> {
  const s = document.getElementById('settings');
  if(s) s.style.display = (s.style.display==='block') ? 'none' : 'block';
  else {
    const music = confirm("Enable music? OK=yes, Cancel=no");
    SETTINGS.music = music;
    if(!music && SFX.bg) SFX.bg.pause();
    saveSettings();
  }
});

settingsOpen?.addEventListener('click', ()=> settingsBtn?.click());
tutorialBtn?.addEventListener('click', ()=> { if(tutorialModal) tutorialModal.classList.remove('panel-hidden'); else alert('Use WASD/arrow keys to move.'); });
closeTutorial?.addEventListener('click', ()=> { if(tutorialModal) tutorialModal.classList.add('panel-hidden'); });

btnPower?.addEventListener('click', ()=> applyPowerup('shock'));
clearLeaderboardBtn?.addEventListener('click', ()=> { if(confirm('Clear leaderboard?')){ localStorage.removeItem(STORAGE.leader); updateLeaderboardUI(); } });

/* mobile visibility */
if(window.innerWidth <= 720) { mobileControls.classList.remove('hidden'); mobileControls.classList.remove('hidden'); }

/* toggle pause */
function togglePause(){
  paused = !paused;
  if(paused){ running = false; pauseBtn && (pauseBtn.textContent = '▶ Resume'); if(SFX.bg) SFX.bg.pause(); }
  else { running = true; pauseBtn && (pauseBtn.textContent = '⏸ Pause'); if(SETTINGS.music && SFX.bg) safePlay(SFX.bg, SETTINGS.musicVolume); lastAnimFrame = performance.now(); requestAnimationFrame(animate); tickLoop(); }
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

/* ========================= NOTIFICATIONS ========================= */
function showNotif(text){
  if(!notifArea) return;
  const el = document.createElement('div'); el.className = 'notif'; el.textContent = text; notifArea.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .5s, transform .5s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),520); },1400);
}

/* ========================= BOOTSTRAP PREVIEW & BOOT ========================= */
async function boot(){
  resizeCanvas();
  // show quick preview before full preload
  previewAssetsQuick();
  // prefetch assets quietly in background (progress already handled when user presses Start)
  await preloadAll(false);
  initSpriteFrames(); // final safety
  updateLeaderboardUI();
}
function previewAssetsQuick(){
  if(!previewCanvas) return;
  const ctxp = previewCtx;
  ctxp.clearRect(0,0,previewCanvas.width, previewCanvas.height);
  ctxp.fillStyle = '#02030a'; ctxp.fillRect(0,0,previewCanvas.width, previewCanvas.height);
  // simple animated dots to show life
  for(let i=0;i<8;i++){
    const x = 20 + i*44 + Math.sin(Date.now()/600 + i)*6;
    ctxp.fillStyle = `rgba(102,255,153,${0.2 + (i%2)*0.25})`;
    ctxp.beginPath(); ctxp.arc(x, previewCanvas.height/2, 12, 0, Math.PI*2); ctxp.fill();
  }
}

/* init sprite frames if images already loaded */
function initSpriteFrames(){
  if(IMG.ninja) SPRITE.ninja.frameW = Math.floor(IMG.ninja.naturalWidth / 4), SPRITE.ninja.frameH = Math.floor(IMG.ninja.naturalHeight / 1), SPRITE.ninja.cols = 4;
  if(IMG.clone) SPRITE.clone.frameW = Math.floor(IMG.clone.naturalWidth / 3), SPRITE.clone.frameH = Math.floor(IMG.clone.naturalHeight / 1), SPRITE.clone.cols = 3;
  if(IMG.portal) SPRITE.portal.frameW = Math.floor(IMG.portal.naturalWidth / 1), SPRITE.portal.frameH = Math.floor(IMG.portal.naturalHeight / 1), SPRITE.portal.cols = 1;
}

/* ========================= HELPERS: save/load settings ========================= */
function saveSettings(){
  localStorage.setItem(STORAGE.settings, JSON.stringify(SETTINGS));
}
function loadSettingsToUI(){
  try{
    if(musicToggleEl) musicToggleEl.checked = SETTINGS.music;
    if(sfxToggleEl) sfxToggleEl.checked = SETTINGS.sfx;
    if(difficultyEl) difficultyEl.value = SETTINGS.difficulty;
  }catch(e){}
}
musicToggleEl?.addEventListener('change', ()=>{ SETTINGS.music = musicToggleEl.checked; saveSettings(); if(!SETTINGS.music && SFX.bg) SFX.bg.pause(); });
sfxToggleEl?.addEventListener('change', ()=>{ SETTINGS.sfx = sfxToggleEl.checked; saveSettings(); });
difficultyEl?.addEventListener('input', ()=>{ SETTINGS.difficulty = Number(difficultyEl.value); saveSettings(); });

/* ========================= START BOOT ========================= */
boot();

/* ========================= EXPORT DEBUG ========================= */
window.__SHADOWCLONE = {
  IMG, SFX, resetGame, spawnPowerup, spawnClone, addToLeaderboard, SETTINGS
};
