/* script.js — Polished Shadow Clone Escape (AAA-grade, robust)
   Paste this file into your repo root. It will try assets in:
     - "assets/..." then fallback to root (e.g. "ninja_spritesheet.png")
   Adjust ASSET_CANDIDATES top section if your filenames or locations differ.
*/
// === GLOBAL FLAGS ===
let gameRunning = false;

// === GAME LOOP ===
function gameLoop() {
  if (!gameRunning) return; // stop if game not running

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw maze, player, clones, portal etc.
  drawMaze();
  drawNinja();
  drawClones();
  drawPortal();

  requestAnimationFrame(gameLoop);
}

// === START GAME FUNCTION ===
function startGame() {
  console.log("✅ Game Started");
  gameRunning = true;

  // reset player state
  ninja.x = 100;
  ninja.y = 100;

  // play music
  if (sounds.bgMusic.paused) {
    sounds.bgMusic.play();
  }

  gameLoop(); // kick off loop
}

// === BUTTON LISTENER ===
document.getElementById("startBtn").addEventListener("click", startGame);

/* ========================= ASSET PATHS (edit if needed) ======================= */
const ASSET_CANDIDATES = {
  ninja: ["assets/ninja_spritesheet.png","ninja_spritesheet.png"],
  clone: ["assets/clones_spritesheet.png","clones_spritesheet.png"],
  portal: ["assets/portal_spritesheet.png","portal_spritesheet.png"],
  // optional / fallback (not required)
  power_speed: ["assets/powerup_speed.png","powerup_speed.png"],
  power_cloak: ["assets/powerup_cloak.png","powerup_cloak.png"],
  power_clone: ["assets/powerup_clone.png","powerup_clone.png"],
  bg_music: ["assets/bg_music_loop.wav","bg_music_loop.wav"],
  spawn_sfx: ["assets/spawn.wav","spawn.wav"],
  power_sfx: ["assets/powerup.wav","powerup.wav"],
  portal_sfx: ["assets/portal.wav","portal.wav"],
  death_sfx: ["assets/death.wav","death.wav"]
};

/* ========================= SPRITE FRAME INFO (from you) ===================== */
/* Provided dimensions:
   - ninja sheet: 1536 x 534 -> 4 frames across -> frameW = 384, frameH = 534
   - clone sheet: 1060 x 433 -> 3 frames across -> frameW ≈ 353.333 -> use 353
   - portal sheet: 361 x 316 -> single frame
*/
const SPRITE_INFO = {
  ninja: { sheetW:1536, sheetH:534, cols:4, rows:1, frameW:384, frameH:534 },
  clone: { sheetW:1060, sheetH:433, cols:3, rows:1, frameW:353, frameH:433 },
  portal:{ sheetW:361, sheetH:316, cols:1, rows:1, frameW:361, frameH:316 }
};

/* ========================= DOM / CANVAS ===================================== */
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');
const miniMap = document.getElementById('miniMap');
const miniCtx = miniMap?.getContext('2d');

const startBtn = document.getElementById('startBtn') || document.getElementById('startBtnOverlay');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.querySelector('#menuBtn') || document.getElementById('menuBtnHeader');
const powerupBox = document.getElementById('powerupBox');
const timerText = document.getElementById('timer');
const statusText = document.getElementById('status');
const bestRecordText = document.getElementById('bestRecordText');
const notifArea = document.getElementById('notifArea');

/* ========================= UTILS: load assets with fallback ================== */
function tryLoadImage(paths){
  return new Promise(resolve=>{
    let i=0;
    function next(){
      if(i>=paths.length){ resolve(null); return; }
      const url = paths[i++]; const img = new Image();
      img.src = url;
      img.onload = ()=> resolve({img, url});
      img.onerror = ()=> next();
    }
    next();
  });
}
function tryLoadAudio(paths){
  return new Promise(resolve=>{
    let i=0;
    function next(){
      if(i>=paths.length){ resolve(null); return; }
      const url = paths[i++]; const a = new Audio();
      a.src = url;
      a.addEventListener('canplaythrough', ()=> resolve({audio:a,url}), {once:true});
      a.addEventListener('error', ()=> next(), {once:true});
    }
    next();
  });
}

/* ========================= GAME STATE ====================================== */
let cols=19, rows=19, tileSize=30;
let maze = [], mazeCache = null;
let player = null;
let movesHistory = [], clones = [], powerups = [], particles = [];
let frameCount = 0, lastFrame = performance.now();
let running = false, startTime = 0;
let activePower = null;
let cloneInterval = 300;
const STORAGE_KEY = 'shadow_clone_best';
let SETTINGS = { music:true, sfx:true, difficulty:1 };

/* ========================= ASSETS HOLDER =================================== */
const ASSETS = {
  images: { ninja:null, clone:null, portal:null, power_speed:null, power_cloak:null, power_clone:null },
  audios: { bg:null, spawn:null, powerup:null, portal:null, death:null }
};

/* ========================= PRELOAD SELECTIVE ASSETS ======================== */
async function preloadAssets(){
  // images
  const nin = await tryLoadImage(ASSET_CANDIDATES.ninja);
  if(nin){ ASSETS.images.ninja = nin.img; console.log("Loaded ninja:", nin.url); } else console.warn("ninja sheet missing");
  const cl = await tryLoadImage(ASSET_CANDIDATES.clone);
  if(cl){ ASSETS.images.clone = cl.img; console.log("Loaded clone:", cl.url); } else console.warn("clone sheet missing");
  const po = await tryLoadImage(ASSET_CANDIDATES.portal);
  if(po){ ASSETS.images.portal = po.img; console.log("Loaded portal:", po.url); } else console.warn("portal sheet missing");

  // optional images
  const ps = await tryLoadImage(ASSET_CANDIDATES.power_speed); if(ps) ASSETS.images.power_speed = ps.img;
  const pc = await tryLoadImage(ASSET_CANDIDATES.power_cloak); if(pc) ASSETS.images.power_cloak = pc.img;
  const pcl = await tryLoadImage(ASSET_CANDIDATES.power_clone); if(pcl) ASSETS.images.power_clone = pcl.img;

  // audio
  const bg = await tryLoadAudio(ASSET_CANDIDATES.bg_music); if(bg){ ASSETS.audios.bg = bg.audio; ASSETS.audios.bg.loop = true; ASSETS.audios.bg.volume=0.45; }
  const s_spawn = await tryLoadAudio(ASSET_CANDIDATES.spawn_sfx); if(s_spawn) ASSETS.audios.spawn = s_spawn.audio;
  const s_power = await tryLoadAudio(ASSET_CANDIDATES.power_sfx); if(s_power) ASSETS.audios.powerup = s_power.audio;
  const s_port = await tryLoadAudio(ASSET_CANDIDATES.portal_sfx); if(s_port) ASSETS.audios.portal = s_port.audio;
  const s_death = await tryLoadAudio(ASSET_CANDIDATES.death_sfx); if(s_death) ASSETS.audios.death = s_death.audio;

  console.log("Asset load summary:", {
    ninja: !!ASSETS.images.ninja,
    clone: !!ASSETS.images.clone,
    portal: !!ASSETS.images.portal,
    bg: !!ASSETS.audios.bg
  });
}

/* ========================= CANVAS & GRID SIZING =========================== */
function resizeCanvas(){
  const maxW = Math.min(window.innerWidth - 40, 980);
  const width = Math.min(maxW, 940);
  gameCanvas.style.width = width + 'px';
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * 0.66);
  gameCanvas.width = Math.floor(logicalW * ratio);
  gameCanvas.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);

  const cssW = gameCanvas.clientWidth || logicalW, cssH = gameCanvas.clientHeight || logicalH;
  const preferred = window.innerWidth < 720 ? 26 : 30;
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

/* ========================= MAZE GENERATION ================================= */
function generateMaze(c,r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x]=0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x+dx, ny = y+dy;
      if(nx>0 && nx<c-1 && ny>0 && ny<r-1 && grid[ny][nx]===1){
        grid[y+dy/2][x+dx/2]=0;
        carve(nx,ny);
      }
    }
  }
  carve(1,1);
  // small safe area
  grid[1][1]=0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}

/* ========================= CACHE MAZE TO OFFSCREEN CANVAS =================== */
function cacheMaze(){
  if(!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');

  // background fill
  mctx.fillStyle = '#0b0b0b';
  mctx.fillRect(0,0,mazeCache.width,mazeCache.height);

  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x]===1){
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

/* ========================= SPAWN PORTAL (farthest from origin) ============== */
let PORTAL = null;
function spawnPortal(){
  let best=null, bestd=-1;
  for(let y=rows-2;y>=1;y--){
    for(let x=cols-2;x>=1;x--){
      if(maze[y][x]===0 && !(x===1 && y===1)){
        const d = Math.abs(x-1) + Math.abs(y-1);
        if(d>bestd){ bestd = d; best = {x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* ========================= GAME RESET ====================================== */
function resetGame(){
  resizeCanvas();
  maze = generateMaze(cols,rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = [];
  clones = [];
  powerups = [];
  particles = [];
  frameCount = 0;
  cloneInterval = Math.max(50, 300 - (SETTINGS.difficulty-1)*80);
  running = true; startTime = Date.now();
  spawnPortal();
  bestRecordText && (bestRecordText.textContent = ((Number(localStorage.getItem(STORAGE_KEY))||0) ? `Best: ${Number(localStorage.getItem(STORAGE_KEY))}s` : 'Best: —'));
  statusText && (statusText.textContent='Survive as long as you can');
  timerText && (timerText.textContent='Time: 0s');
}

/* ========================= POWERUPS ======================================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let attempts=0;
  while(attempts++<200){
    const x = randInt(1, cols-2), y = randInt(1, rows-2);
    if(maze[y][x]===0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x && p.y===y)){
      powerups.push({ x,y,type:POWER_TYPES[randInt(0,POWER_TYPES.length-1)], spawned: Date.now(), bob: Math.random()*Math.PI*2 });
      return;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type==='cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type==='shock') clones.forEach(c=> c.index = Math.max(0, (c.index||0) - 28));
  if(SETTINGS.sfx && ASSETS.audios.powerup) safePlay(ASSETS.audios.powerup);
  showNotif(`${type.toUpperCase()}!`);
}

/* ========================= PARTICLES ===================================== */
function spawnParticles(px,py,color){
  for(let i=0;i<18;i++){
    particles.push({ x:px + (Math.random()-0.5)*tileSize, y:py + (Math.random()-0.5)*tileSize, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, life:20 + Math.random()*30, color });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
}
function drawParticles(){
  for(const p of particles){ ctx.globalAlpha = Math.max(0, p.life/50); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3,3); } ctx.globalAlpha = 1;
}

/* ========================= Clone CLASS ==================================== */
class Clone {
  constructor(path,type='basic'){
    this.path = path.slice();
    this.index = 0; this.type=type; this.spawnFrame = frameCount;
    this.x = this.path[0]?.x ?? 1; this.y = this.path[0]?.y ?? 1;
  }
  update(){
    if(this.type==='fast') this.index += 1 + (Math.random()<0.45?1:0);
    else if(this.type==='wraith'){
      if(Math.random() < 0.01 + Math.min(0.05, frameCount/60000)){
        const jump = Math.min(50, Math.floor(Math.random()*Math.min(200, this.path.length)));
        this.index = Math.min(this.path.length-1, this.index + jump);
      } else this.index++;
    } else this.index++;
    if(this.index < this.path.length){ this.x = this.path[this.index].x; this.y = this.path[this.index].y; }
  }
  draw(){
    const img = ASSETS.images.clone;
    if(img){
      // compute sheet frame dims and draw scaled to tileSize
      const info = SPRITE_INFO.clone;
      const colsFrames = Math.max(1, Math.floor(img.naturalWidth / info.frameW));
      const rowsFrames = Math.max(1, Math.floor(img.naturalHeight / info.frameH));
      const row = 0; // clones single-row in your sheet
      const col = Math.floor((frameCount/8) % colsFrames);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(img, col*info.frameW, row*info.frameH, info.frameW, info.frameH, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#c33'; ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
    }
  }
}

/* ========================= INPUT / MOVEMENT =============================== */
let activeDirs = {up:false,down:false,left:false,right:false};
let lastStepTime = 0;
let stepMsBase = 140;
document.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(e.key==='ArrowUp' || e.key==='w'){ activeDirs.up = true; stepPlayer(); if(SETTINGS.sfx && ASSETS.audios.spawn) safePlay(ASSETS.audios.spawn); }
  if(e.key==='ArrowDown' || e.key==='s'){ activeDirs.down = true; stepPlayer(); }
  if(e.key==='ArrowLeft' || e.key==='a'){ activeDirs.left = true; stepPlayer(); }
  if(e.key==='ArrowRight' || e.key==='d'){ activeDirs.right = true; stepPlayer(); }
});
document.addEventListener('keyup', (e)=>{
  if(e.key==='ArrowUp' || e.key==='w') activeDirs.up=false;
  if(e.key==='ArrowDown' || e.key==='s') activeDirs.down=false;
  if(e.key==='ArrowLeft' || e.key==='a') activeDirs.left=false;
  if(e.key==='ArrowRight' || e.key==='d') activeDirs.right=false;
});

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

  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny][nx]===0){
    player.x = nx; player.y = ny;
    movesHistory.push({x:nx,y:ny});
    // pick up powerups
    for(let i=powerups.length-1;i>=0;i--){
      if(powerups[i].x===nx && powerups[i].y===ny){
        applyPowerup(powerups[i].type);
        powerups.splice(i,1);
        break;
      }
    }
  }
}

/* ========================= spawn clone logic ============================== */
function spawnClone() {
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random();
  let type = 'basic';
  if(p < 0.08) type = 'wraith';
  else if(p < 0.22) type = 'fast';
  const c = new Clone(snap, type);
  clones.push(c);
  if(SETTINGS.sfx && ASSETS.audios.spawn) safePlay(ASSETS.audios.spawn);
  spawnParticles((c.x||player.x)*tileSize + tileSize/2, (c.y||player.y)*tileSize + tileSize/2, '#ff4466');
}

/* ========================= DRAW HELPERS ================================== */
function drawMaze(){
  if(!maze) return;
  if(mazeCache) ctx.drawImage(mazeCache,0,0);
  else {
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        ctx.fillStyle = maze[y][x]===1 ? '#222' : '#070707';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

function drawPowerups(){
  for(const pu of powerups){
    const bob = Math.sin((frameCount + pu.bob*60)/18) * 3;
    const px = pu.x*tileSize + tileSize/2, py = pu.y*tileSize + tileSize/2 + bob;
    const img = (pu.type==='speed') ? ASSETS.images.power_speed : (pu.type==='cloak' ? ASSETS.images.power_cloak : ASSETS.images.power_clone);
    if(img) ctx.drawImage(img, px - tileSize*0.32, py - tileSize*0.32, tileSize*0.64, tileSize*0.64);
    else { ctx.fillStyle = pu.type==='speed' ? '#ffd86b' : pu.type==='cloak' ? '#7af' : '#9be7b0'; ctx.fillRect(pu.x*tileSize + tileSize*0.2, pu.y*tileSize + tileSize*0.2, tileSize*0.6, tileSize*0.6); }
  }
}

function drawPortal(){
  if(!PORTAL) return;
  const img = ASSETS.images.portal;
  if(img){
    const info = SPRITE_INFO.portal;
    const frame = 0;
    ctx.drawImage(img, frame*info.frameW, 0, info.frameW, info.frameH, PORTAL.x*tileSize, PORTAL.y*tileSize, tileSize, tileSize);
  } else {
    ctx.fillStyle = '#66ffcc'; ctx.fillRect(PORTAL.x*tileSize+1, PORTAL.y*tileSize+1, tileSize-2, tileSize-2);
  }
}

function drawMiniMap(){
  if(!miniMap || !maze) return;
  const mmW = miniMap.width / (window.devicePixelRatio || 1), mmH = miniMap.height / (window.devicePixelRatio || 1);
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ miniCtx.fillStyle = maze[y][x]===1 ? '#222' : '#070707'; miniCtx.fillRect(x*cw, y*ch, cw, ch); }
  for(const c of clones){ miniCtx.fillStyle = c.type==='wraith' ? '#ff66ff' : c.type==='fast' ? '#ffb86b' : '#ff6666'; miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9)); }
  miniCtx.fillStyle = '#66ff99'; miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){ miniCtx.fillStyle = pu.type==='speed' ? '#ffd86b' : pu.type==='cloak' ? '#7af' : '#9be7b0'; miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6); }
}

/* ========================= HUD ============================================ */
function updateHUD(){ if(timerText) timerText.textContent = `Time: ${Math.floor((Date.now()-startTime)/1000)}s`; if(activePower && Date.now() < activePower.until){ const rem = Math.ceil((activePower.until - Date.now())/1000); if(powerupBox) powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`; } else { if(powerupBox) powerupBox.innerHTML = ''; activePower = null; } }
function showNotif(text){ if(!notifArea) return; const el = document.createElement('div'); el.className='notif'; el.textContent = text; notifArea.appendChild(el); setTimeout(()=>{ el.style.transition='opacity .5s, transform .5s'; el.style.opacity='0'; el.style.transform='translateY(-16px)'; setTimeout(()=>el.remove(),520); },1200); }

/* ========================= MAIN LOOP ====================================== */
function animate(now){
  if(!running) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  // spawn powerups occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.8) spawnPowerup();

  // spawn clones over time (difficulty tweaks)
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + (SETTINGS.difficulty-1)*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(Math.random() < 0.02 + (SETTINGS.difficulty-1)*0.03) spawnClone();
    if(cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - (SETTINGS.difficulty-1));
  }

  // update clones and check collisions
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i]; c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type==='cloak' && Date.now() < activePower.until)){
        // death
        running = false;
        if(SETTINGS.sfx && ASSETS.audios.death) safePlay(ASSETS.audios.death);
        showNotif("YOU DIED");
        setTimeout(()=>{ resetGame(); }, 900);
        return;
      }
    }
  }

  // update particles
  updateParticles();

  // render
  ctx.clearRect(0,0,gameCanvas.width, gameCanvas.height);
  drawMaze();
  drawPowerups();
  drawPortal();
  for(const c of clones) c.draw();

  // smooth player lerp
  const speed = 12 + (SETTINGS.difficulty-1)*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i]; const alpha = (i - Math.max(0, movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha*0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // draw player sprite properly using provided frame dims
  if(ASSETS.images.ninja){
    try {
      const info = SPRITE_INFO.ninja;
      const colsFrames = Math.max(1, Math.floor(ASSETS.images.ninja.naturalWidth / info.frameW));
      const animCol = Math.floor((frameCount/6) % colsFrames);
      const animRow = 0;
      ctx.drawImage(ASSETS.images.ninja, animCol*info.frameW, animRow*info.frameH, info.frameW, info.frameH, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
    } catch(e){
      // fallback if odd sizes -> draw whole image scaled
      ctx.drawImage(ASSETS.images.ninja, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
    }
  } else {
    // shape fallback
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    ctx.save();
    const pulse = 0.9 + Math.sin(Date.now()/420)*0.08;
    ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)';
    ctx.fillStyle = player.color;
    ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  drawParticles();
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* ========================= LEVEL TRANSITION (Geometry Dash style) ========== */
function transitionToNextLevel(){
  running = false;
  let t=0, dur=26;
  function step(){
    ctx.save();
    const s = 1 + 0.06 * Math.sin(Math.PI*(t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, - (s-1)*cx, - (s-1)*cy);
    drawMaze(); drawPortal(); for(const c of clones) c.draw();
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t<=dur) requestAnimationFrame(step);
    else { resetGame(); running = true; lastFrame = performance.now(); requestAnimationFrame(animate); }
  }
  step();
}

/* ========================= HELPERS ======================================== */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function safePlay(audio){ if(!audio) return; try{ audio.currentTime=0; audio.play().catch(()=>{}); }catch(e){} }
function showNotif(t){ showNotif(t); } // keep interface

/* ========================= TICK LOOP FOR HELD KEYS ======================== */
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

/* ========================= UI BINDINGS =================================== */
startBtn?.addEventListener('click', ()=>{
  // safe-play audio on user gesture
  if(ASSETS.audios.bg && SETTINGS.music) { try{ ASSETS.audios.bg.play().catch(()=>{}); }catch(e){} }
  lastFrame = performance.now(); running = true; requestAnimationFrame(animate);
});
restartBtn?.addEventListener('click', ()=>{ resetGame(); if(ASSETS.audios.bg && SETTINGS.music) safePlay(ASSETS.audios.bg); lastFrame = performance.now(); requestAnimationFrame(animate); });
menuBtn?.addEventListener('click', ()=>{ running = false; });

/* ========================= BOOTSTRAP & TEST SCENE ========================= */
async function boot(){
  resizeCanvas();
  await preloadAssets();

  // If some images missing, log and continue
  if(!ASSETS.images.ninja) console.warn("ninja sheet not found — using fallback shapes.");
  if(!ASSETS.images.clone) console.warn("clone sheet not found — using fallback shapes.");
  if(!ASSETS.images.portal) console.warn("portal sheet not found — using fallback box.");

  // create initial maze & game state
  resetGame();

  // Quick test: if user wants immediate visual confirmation, draw static test scene once
  // (We still start normal loop only when user clicks start button)
  // draw test preview
  testPreview();
}
function testPreview(){
  // Clear and show center preview of assets
  ctx.clearRect(0,0,gameCanvas.width, gameCanvas.height);
  const cx = gameCanvas.width/2, cy = gameCanvas.height/2;
  ctx.fillStyle = '#0b0b0b'; ctx.fillRect(0,0,gameCanvas.width, gameCanvas.height);

  // draw ninja first frame if available
  if(ASSETS.images.ninja){
    const info = SPRITE_INFO.ninja;
    ctx.drawImage(ASSETS.images.ninja, 0, 0, info.frameW, info.frameH, cx-220, cy- Math.round(tileSize/2), tileSize, tileSize);
  } else ctx.fillStyle='#66ff99', ctx.fillRect(cx-220, cy- Math.round(tileSize/2), tileSize, tileSize);

  // draw clone
  if(ASSETS.images.clone){
    const info = SPRITE_INFO.clone;
    ctx.drawImage(ASSETS.images.clone, 0, 0, info.frameW, info.frameH, cx-32, cy- Math.round(tileSize/2), tileSize, tileSize);
  } else ctx.fillStyle='#ff6666', ctx.fillRect(cx-32, cy- Math.round(tileSize/2), tileSize, tileSize);

  // draw portal
  if(ASSETS.images.portal){
    const info = SPRITE_INFO.portal;
    ctx.drawImage(ASSETS.images.portal, 0, 0, info.frameW, info.frameH, cx+160, cy- Math.round(tileSize/2), tileSize, tileSize);
  } else ctx.fillStyle='#66ccff', ctx.fillRect(cx+160, cy- Math.round(tileSize/2), tileSize, tileSize);
}

/* ========================= DEBUG / EXPOSURE =============================== */
window.__SHADOWCLONE = { ASSETS, resetGame, spawnPowerup, spawnClone };

/* ========================= START BOOT ==================================== */
boot();
