/* ========================================================================
   Shadow Clone Escape — Full AAA-ready script.js
   - Paste into script.js
   - Edit ASSETS if your files differ
   - Features: loader, sprites, maze, joystick, powerups, clones,
               mini-map, level transitions, audio, UI wiring, fallbacks
   ======================================================================== */

/* =========================
   ASSETS — adjust paths if needed
   ========================= */
const ASSETS = {
  ninja: 'assets/ninja_spritesheet.png',       // expected 1536x534 (4 frames)
  clones: 'assets/clones_spritesheet.png',     // expected 1060x433 (3 frames)
  portal: 'assets/portal.png',                 // expected 361x316
  background: 'background.png',
  bgLayers: ['assets/bg_layer1.png','assets/bg_layer2.png','assets/bg_layer3.png','assets/bg_layer4.png'],
  audio: {
    bg: 'assets/bg_music_loop.wav',
    spawn: 'assets/spawn.wav',
    pickup: 'assets/powerup.wav',
    portal: 'assets/portal.wav',
    death: 'assets/death.wav',
    newRecord: 'assets/newrecord.wav'
  }
};

/* =========================
   DOM references
   ========================= */
const gameCanvas = document.getElementById('gameCanvas');
const startBtn = document.getElementById('startBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
const settingsBtn = document.getElementById('settingsBtn');
const leaderBtn = document.getElementById('leaderBtn');
const menu = document.getElementById('menu');
const ui = document.getElementById('ui');
const preloader = document.getElementById('preloader');
const loaderPct = document.getElementById('loaderPct') || null;
const tutorialBox = document.getElementById('tutorial');
const settingsBox = document.getElementById('settings');
const leaderboardBox = document.getElementById('leaderboard');
const menuOverlay = document.getElementById('menuOverlay');
const restartBtn = document.getElementById('restartBtn');
const menuBtnHeader = document.getElementById('menuBtnHeader') || document.getElementById('menuBtn');
const btnPower = document.getElementById('btnPower');
const mobileControls = document.getElementById('mobileControls');
const musicToggleEl = document.getElementById('musicToggle');
const sfxToggleEl = document.getElementById('sfxToggle');
const difficultyEl = document.getElementById('difficulty');
const bestRecordText = document.getElementById('bestRecordText');
const powerupBox = document.getElementById('powerupBox');
const leaderboardList = document.getElementById('leaderboardList');
const clearLeaderboardBtn = document.getElementById('clearLeaderboard');

/* Audio elements on page (script will set src) */
const bgMusicEl = document.getElementById('bgMusic');
const spawnSfxEl = document.getElementById('spawnSfx');
const pickupSfxEl = document.getElementById('pickupSfx');
const portalSfxEl = document.getElementById('portalSfx');
const deathSfxEl = document.getElementById('deathSfx');
const newRecordSfxEl = document.getElementById('newRecordSfx');

/* =========================
   Runtime state & settings
   ========================= */
let ctx, miniMap, miniCtx;
let pixelRatio = window.devicePixelRatio || 1;
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
let currentLevel = 0;

/* local settings storage key */
const SETTINGS_KEY = 'shadow_clone_settings';
let SETTINGS = { music:true, sfx:true, difficulty:'normal' };

/* load saved settings */
try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if(s) SETTINGS = {...SETTINGS,...s}; } catch(e){}

/* =========================
   Asset containers
   ========================= */
const IMG = { ninja:null, clones:null, portal:null, background:null, bgLayers:[] };
const AUDIO = { bg:null, spawn:null, pickup:null, portal:null, death:null, newRecord:null };

/* sprite frame metadata (computed after load) */
const SPRITES = {
  ninja: { cols:4, rows:1, frameW:0, frameH:0 },   // 1536x534 -> 4 cols
  clones: { cols:3, rows:1, frameW:0, frameH:0 },  // 1060x433 -> 3 cols
  portal: { cols:1, rows:1, frameW:0, frameH:0 }
};

/* small helpers */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const shuffle = (a)=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; };
const nowSec = ()=> Math.floor((Date.now()-startTime)/1000);

/* =========================
   Loader utilities
   ========================= */
function loadImage(src){ return new Promise(res=>{ if(!src) return res(null); const i = new Image(); i.onload = ()=>res(i); i.onerror = ()=>{ console.warn('image failed', src); res(null); }; i.src = src; }); }
function loadAudio(src){ return new Promise(res=>{ if(!src) return res(null); try{ const a = new Audio(); a.addEventListener('canplaythrough', ()=>res(a), {once:true}); a.addEventListener('error', ()=>{ console.warn('audio failed', src); res(null); }, {once:true}); a.src = src; }catch(e){ console.warn('audio load exception', e); res(null); } }); }

async function preloadAll(show=true){
  if(show && preloader) preloader.classList.remove('hidden');
  const tasks = [
    {type:'img',key:'ninja',path:ASSETS.ninja},
    {type:'img',key:'clones',path:ASSETS.clones},
    {type:'img',key:'portal',path:ASSETS.portal},
    {type:'img',key:'background',path:ASSETS.background},
    {type:'img',key:'bg1',path:ASSETS.bgLayers?.[0]},
    {type:'img',key:'bg2',path:ASSETS.bgLayers?.[1]},
    {type:'img',key:'bg3',path:ASSETS.bgLayers?.[2]},
    {type:'img',key:'bg4',path:ASSETS.bgLayers?.[3]},
    {type:'audio',key:'bg',path:ASSETS.audio.bg},
    {type:'audio',key:'spawn',path:ASSETS.audio.spawn},
    {type:'audio',key:'pickup',path:ASSETS.audio.pickup},
    {type:'audio',key:'portal',path:ASSETS.audio.portal},
    {type:'audio',key:'death',path:ASSETS.audio.death},
    {type:'audio',key:'newRecord',path:ASSETS.audio.newRecord}
  ];
  let done=0, total = tasks.filter(t=>t.path).length || tasks.length;
  for(const t of tasks){
    if(!t.path){ done++; continue; }
    if(t.type === 'img'){
      const img = await loadImage(t.path);
      if(img){
        if(t.key==='ninja') IMG.ninja = img;
        else if(t.key==='clones') IMG.clones = img;
        else if(t.key==='portal') IMG.portal = img;
        else if(t.key==='background') IMG.background = img;
        else if(t.key==='bg1') IMG.bgLayers[0] = img;
        else if(t.key==='bg2') IMG.bgLayers[1] = img;
        else if(t.key==='bg3') IMG.bgLayers[2] = img;
        else if(t.key==='bg4') IMG.bgLayers[3] = img;
        console.log('Loaded image', t.path);
      } else console.warn('Missing image', t.path);
    } else {
      const a = await loadAudio(t.path);
      if(a){
        if(t.key==='bg') AUDIO.bg = a;
        else if(t.key==='spawn') AUDIO.spawn = a;
        else if(t.key==='pickup') AUDIO.pickup = a;
        else if(t.key==='portal') AUDIO.portal = a;
        else if(t.key==='death') AUDIO.death = a;
        else if(t.key==='newRecord') AUDIO.newRecord = a;
        console.log('Loaded audio', t.path);
      } else console.warn('Missing audio', t.path);
    }
    done++;
    if(loaderPct) loaderPct.textContent = `${Math.floor((done/total)*100)}%`;
    await new Promise(r=>setTimeout(r,10));
  }

  // set audio loop + volumes
  if(AUDIO.bg){ AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.music ? 0.45 : 0; }
  if(AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfx ? 1 : 0;
  if(AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfx ? 1 : 0;
  if(AUDIO.portal) AUDIO.portal.volume = SETTINGS.sfx ? 1 : 0;
  if(AUDIO.death) AUDIO.death.volume = SETTINGS.sfx ? 1 : 0;
  if(AUDIO.newRecord) AUDIO.newRecord.volume = SETTINGS.sfx ? 1 : 0;

  // compute sprites
  if(IMG.ninja){ SPRITES.ninja.frameW = Math.floor(IMG.ninja.naturalWidth / SPRITES.ninja.cols); SPRITES.ninja.frameH = Math.floor(IMG.ninja.naturalHeight / SPRITES.ninja.rows); }
  if(IMG.clones){ SPRITES.clones.frameW = Math.floor(IMG.clones.naturalWidth / SPRITES.clones.cols); SPRITES.clones.frameH = Math.floor(IMG.clones.naturalHeight / SPRITES.clones.rows); }
  if(IMG.portal){ SPRITES.portal.frameW = Math.floor(IMG.portal.naturalWidth / SPRITES.portal.cols); SPRITES.portal.frameH = Math.floor(IMG.portal.naturalHeight / SPRITES.portal.rows); }

  if(show && preloader) preloader.classList.add('hidden');
}

/* =========================
   Canvas sizing & grid
   ========================= */
function resizeCanvas(){
  pixelRatio = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth - 40, 1200);
  const cssW = Math.min(maxW, window.innerWidth - 40);
  gameCanvas.style.width = cssW + 'px';
  const logicalW = Math.floor(cssW);
  const logicalH = Math.floor(logicalW * 0.62);
  gameCanvas.width = Math.floor(logicalW * pixelRatio);
  gameCanvas.height = Math.floor(logicalH * pixelRatio);
  ctx = gameCanvas.getContext('2d');
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);

  // minimap
  if(!miniMap){ createMiniMap(); }
  const mmW = Math.min(220, Math.floor(cssW * 0.26));
  const mmH = Math.floor(mmW * 0.58);
  miniMap.width = mmW; miniMap.height = mmH; miniMap.style.width = mmW + 'px'; miniMap.style.height = mmH + 'px';
  miniCtx.setTransform(1,0,0,1,0,0);

  const preferred = window.innerWidth < 720 ? 24 : 36;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(logicalH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, logicalH / rows));
}
window.addEventListener('resize', ()=>{ resizeCanvas(); cacheMaze(); });

/* =========================
   Maze generation & caching
   ========================= */
function generateMaze(c,r){
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
  grid[1][1] = 0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}

function cacheMaze(){
  if(!maze || !maze[0]) { mazeCache = null; return; }
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize; mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');

  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(!maze[y] || typeof maze[y][x] === 'undefined') continue;
      if(maze[y][x] === 1){
        // wall tile: gradient + bevel + glow hint
        const gx = mctx.createLinearGradient(x*tileSize, y*tileSize, x*tileSize+tileSize, y*tileSize+tileSize);
        gx.addColorStop(0, '#15151a'); gx.addColorStop(0.5, '#24242b'); gx.addColorStop(1, '#0f0f12');
        mctx.fillStyle = gx; mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        mctx.fillStyle = 'rgba(255,255,255,0.02)'; mctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
        // little cracks
        mctx.strokeStyle = 'rgba(0,0,0,0.18)'; mctx.lineWidth = 0.8;
        mctx.beginPath(); mctx.moveTo(x*tileSize+4, y*tileSize+tileSize*0.2); mctx.lineTo(x*tileSize+tileSize-6, y*tileSize+tileSize*0.8); mctx.stroke();
      } else {
        mctx.fillStyle = '#060607'; mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* =========================
   find portal placement
   ========================= */
function placePortal(){
  let best=null, bestd=-1;
  for(let y=1;y<rows-1;y++){
    for(let x=1;x<cols-1;x++){
      if(maze[y] && maze[y][x] === 0 && !(x===1&&y===1)){
        const d = Math.abs(x-1)+Math.abs(y-1);
        if(d > bestd){ bestd = d; best = {x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* =========================
   powerups
   ========================= */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let tries = 0;
  while(tries++ < 300){
    const x = randInt(1, cols-2);
    const y = randInt(1, rows-2);
    if(maze[y] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      powerups.push({ x,y, type: POWER_TYPES[randInt(0,POWER_TYPES.length-1)], bob: Math.random()*Math.PI*2, spawned: Date.now() });
      break;
    }
  }
}

function applyPowerup(type){
  if(type==='speed'){ activePower = {type:'speed', until: Date.now()+4500}; }
  else if(type==='cloak'){ activePower = {type:'cloak', until: Date.now()+5000}; }
  else if(type==='shock'){ clones.forEach(c=> c.index = Math.max(0, (c.index||0)-28)); spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#bfe8ff'); if(AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfx?1:0); }
  if(AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfx?1:0);
}

/* =========================
   particles
   ========================= */
function spawnParticles(px,py,color,count=18){
  for(let i=0;i<count;i++){
    particles.push({ x:px + (Math.random()-0.5)*tileSize, y:py + (Math.random()-0.5)*tileSize, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:30 + Math.random()*40, color });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}

/* =========================
   Clone class
   ========================= */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice(); this.index = 0; this.type = type; this.spawnFrame = frameCount;
    this.x = this.path[0]?.x ?? 1; this.y = this.path[0]?.y ?? 1;
  }
  update(){
    if(this.type === 'fast'){ this.index += 1 + (Math.random() < 0.45 ? 1 : 0); }
    else if(this.type === 'wraith'){ if(Math.random() < 0.01 + Math.min(0.05, frameCount/60000)){ const jump = Math.min(50, Math.floor(Math.random()*Math.min(200, this.path.length))); this.index = Math.min(this.path.length-1, this.index + jump); } else this.index++; }
    else this.index++;
    if(this.index < this.path.length){ this.x = this.path[this.index].x; this.y = this.path[this.index].y; }
  }
  draw(){
    if(IMG.clones && SPRITES.clones.frameW){
      const tIndex = (this.type==='wraith')?2: (this.type==='fast')?1:0;
      const sx = tIndex * SPRITES.clones.frameW;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clones, sx, 0, SPRITES.clones.frameW, SPRITES.clones.frameH, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type==='wraith'? '#b14' : this.type==='fast'? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize + 2, this.y*tileSize + 2, tileSize-4, tileSize-4);
    }
  }
}

/* =========================
   input & movement
   ========================= */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', (e)=>{
  if(e.key==='ArrowUp' || e.key==='w') { activeDirs.up = true; stepPlayer(); playFootstep(); }
  if(e.key==='ArrowDown' || e.key==='s') { activeDirs.down = true; stepPlayer(); playFootstep(); }
  if(e.key==='ArrowLeft' || e.key==='a') { activeDirs.left = true; stepPlayer(); playFootstep(); }
  if(e.key==='ArrowRight' || e.key==='d') { activeDirs.right = true; stepPlayer(); playFootstep(); }
  if(e.key===' '){ applyPowerup('shock'); }
  if(e.key==='Escape'){ toggleMenuOverlay(); }
});
document.addEventListener('keyup', (e)=>{
  if(e.key==='ArrowUp' || e.key==='w') activeDirs.up = false;
  if(e.key==='ArrowDown' || e.key==='s') activeDirs.down = false;
  if(e.key==='ArrowLeft' || e.key==='a') activeDirs.left = false;
  if(e.key==='ArrowRight' || e.key==='d') activeDirs.right = false;
});

function playFootstep(){ if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, 0.6); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type==='speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - difficultyNumeric()*10));
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
    movesHistory.push({x:nx, y:ny});
    // pickups
    for(let i=powerups.length-1;i>=0;i--){
      if(powerups[i].x===nx && powerups[i].y===ny){
        applyPowerup(powerups[i].type);
        powerups.splice(i,1);
      }
    }
    // portal check
    if(PORTAL && nx===PORTAL.x && ny===PORTAL.y){
      if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, 1);
      transitionToNextLevel();
    }
  }
}

/* =========================
   joystick (mobile)
   ========================= */
let joystickActive=false, joystickPointerId=null;
let joystickOrigin={x:0,y:0}, joystickPos={x:0,y:0};
const joystickMax = 44;

function initJoystick(){
  const joyst = document.getElementById('joystickContainer');
  const stick = document.getElementById('joystick');
  if(!joyst || !stick) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if(!isTouch){ if(mobileControls) mobileControls.classList.add('hidden'); return; }
  mobileControls.classList.remove('hidden');

  joyst.addEventListener('pointerdown', (ev)=>{
    joyst.setPointerCapture(ev.pointerId);
    joystickActive = true; joystickPointerId = ev.pointerId;
    const rect = joyst.getBoundingClientRect();
    joystickOrigin.x = rect.left + rect.width/2; joystickOrigin.y = rect.top + rect.height/2;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joyst.addEventListener('pointermove', (ev)=>{
    if(!joystickActive || ev.pointerId !== joystickPointerId) return;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joyst.addEventListener('pointerup', (ev)=>{
    if(ev.pointerId !== joystickPointerId) return;
    joystickActive=false; joystickPointerId=null; joystickPos={x:0,y:0}; stick.style.transform = `translate(0px,0px)`; activeDirs={up:false,down:false,left:false,right:false};
  });
}
function updateJoystick(cx,cy){
  const stick = document.getElementById('joystick');
  const dx = cx - joystickOrigin.x, dy = cy - joystickOrigin.y;
  const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  const r = Math.min(dist, joystickMax) * SETTINGS.joystickSensitivity || 0.86;
  joystickPos.x = nx * r; joystickPos.y = ny * r;
  if(stick) stick.style.transform = `translate(${joystickPos.x}px, ${joystickPos.y}px)`;
  activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
  activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
  stepPlayer();
}

/* =========================
   spawn clone
   ========================= */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random(); let type='basic';
  if(p < 0.08) type = 'wraith'; else if(p < 0.22) type = 'fast';
  const c = new Clone(snap, type);
  clones.push(c);
  if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, 1);
  spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ff4466', 20);
}

/* =========================
   drawing helpers
   ========================= */
function drawBackground(now){
  const w = gameCanvas.clientWidth, h = gameCanvas.clientHeight;
  if(IMG.background) ctx.drawImage(IMG.background, -20, -10, w+40, h+20);
  else { const g = ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'#071018'); g.addColorStop(1,'#03040a'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h); }
  for(let i=0;i<IMG.bgLayers.length;i++){
    const layer = IMG.bgLayers[i]; if(!layer) continue;
    const depth = (i+1)/(IMG.bgLayers.length+1);
    const xoff = Math.sin(Date.now()/(7000*(1+depth))) * 12 * depth;
    ctx.globalAlpha = 0.75 - depth*0.15; ctx.drawImage(layer, -20 + xoff, -10, w+40, h+20); ctx.globalAlpha = 1;
  }
}

function drawMaze(){
  if(!maze) return;
  if(mazeCache){ ctx.drawImage(mazeCache, 0, 0); return; }
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
        ctx.fillStyle = '#2e2e2e'; ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        ctx.fillStyle = '#0f0f0f'; ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

function drawPowerups(){
  for(const pu of powerups){
    const cx = pu.x*tileSize + tileSize/2, cy = pu.y*tileSize + tileSize/2 + Math.sin((frameCount + pu.bob)*0.12)*3;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.sin(frameCount/18 + pu.bob)*0.08);
    if(pu.type==='speed'){ ctx.fillStyle='#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,tileSize*0.24,0,Math.PI*2); ctx.fill(); }
    else if(pu.type==='cloak'){ ctx.fillStyle='#9be7b0'; ctx.fillRect(-tileSize*0.18,-tileSize*0.18,tileSize*0.36,tileSize*0.36); }
    else { ctx.fillStyle='#bfe8ff'; ctx.beginPath(); ctx.moveTo(0,-tileSize*0.22); ctx.lineTo(tileSize*0.14,0); ctx.lineTo(-tileSize*0.14,0); ctx.fill(); }
    ctx.restore();
  }
}

function drawPortal(now){
  if(!PORTAL) return;
  const px = PORTAL.x*tileSize + tileSize/2, py = PORTAL.y*tileSize + tileSize/2;
  const scale = 0.9 + 0.08 * Math.sin(now/280);
  const rot = (now/1400) % (Math.PI*2);
  if(IMG.portal){ ctx.save(); ctx.translate(px,py); ctx.rotate(rot); ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320); ctx.drawImage(IMG.portal, -tileSize*scale/1.2, -tileSize*scale/1.2, tileSize*scale*1.4, tileSize*scale*1.4); ctx.restore(); }
  else { ctx.save(); ctx.translate(px,py); ctx.rotate(rot/1.8); ctx.fillStyle='#66ffcc'; ctx.beginPath(); ctx.ellipse(0,0,tileSize*0.42,tileSize*0.46,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
}

function drawMinimap(){
  if(!miniCtx) return;
  const mmW = miniMap.width, mmH = miniMap.height;
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
      miniCtx.fillRect(x*cw, y*ch, cw, ch);
    }
  }
  for(const c of clones){ miniCtx.fillStyle = c.type === 'wraith'? '#ff66ff' : c.type==='fast' ? '#ffb86b' : '#ff6666'; miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9)); }
  miniCtx.fillStyle = '#66ff99'; miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){ miniCtx.fillStyle = pu.type==='speed'? '#4fd1ff' : pu.type==='cloak'? '#9be7b0' : '#bfe8ff'; miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6); }
}

function drawPlayer(){
  if(!player) return;
  if(IMG.ninja && SPRITES.ninja.frameW){
    const animCol = Math.floor((frameCount/6) % SPRITES.ninja.cols);
    const sx = animCol * SPRITES.ninja.frameW, sy = 0;
    // draw larger than tile slightly to emphasize ninja (offset forward)
    const drawW = tileSize * 1.02, drawH = tileSize * 1.02;
    const dx = (player.rx * tileSize) - tileSize*0.01, dy = (player.ry * tileSize) - tileSize*0.06; // nudge forward/up
    ctx.drawImage(IMG.ninja, sx, sy, SPRITES.ninja.frameW, SPRITES.ninja.frameH, dx, dy, drawW, drawH);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
    ctx.save(); ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* =========================
   HUD & toasts
   ========================= */
function setStatusText(s){ const st = document.getElementById('status'); if(st) st.textContent = s; }
function showToast(text){ const a = document.createElement('div'); a.className='notif'; a.textContent = text; document.body.appendChild(a); setTimeout(()=>{ a.style.opacity='0'; a.style.transform='translateY(-18px)'; setTimeout(()=>a.remove(),480); },1500); }
function updateHUD(){
  const timer = document.getElementById('timer'); if(timer) timer.textContent = `Time: ${nowSec()}s`;
  if(activePower && Date.now() < activePower.until){ powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${Math.ceil((activePower.until - Date.now())/1000)}s`; } else { powerupBox.innerHTML=''; if(activePower && Date.now() >= activePower.until) activePower = null; }
}

/* =========================
   Main loop
   ========================= */
let lastFrame = performance.now();
function animate(now){
  if(!running) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  // spawn powerups occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + difficultyNumeric()*0.3)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneInterval > 30) cloneInterval -= 1 + (difficultyNumeric()-1);
    if(Math.random() < 0.02 + (difficultyNumeric()-1) * 0.03) spawnClone();
  }

  // update clones & collisions
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i]; c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type==='cloak' && Date.now() < activePower.until)){
        running = false;
        if(SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, 1); else synthOnce('death', 0.9);
        showToast('☠️ You Died'); spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66', 40);
        setTimeout(()=> onGameOver(), 900);
        return;
      }
    }
  }

  updateParticles();

  // render
  ctx.clearRect(0,0,gameCanvas.width/pixelRatio, gameCanvas.height/pixelRatio);
  drawBackground(now);
  drawMaze();
  drawPowerups();
  for(const c of clones) c.draw();
  // smooth player lerp
  const speed = 12 + (difficultyNumeric()-1)*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0,movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i]; const alpha = (i - Math.max(0,movesHistory.length-30))/30;
    ctx.globalAlpha = 0.05 + alpha*0.25; ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  drawPlayer(now);
  // particles
  for(const p of particles){ ctx.globalAlpha = Math.max(0, p.life/70); ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,3,3); }
  ctx.globalAlpha = 1;

  drawMinimap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* =========================
   difficulty mapping
   ========================= */
function difficultyNumeric(){ switch(SETTINGS.difficulty){ case 'easy': return 0.8; case 'normal': return 1; case 'hard': return 1.5; case 'nightmare': return 2.2; default: return 1; } }

/* =========================
   Level start / reset / gameover
   ========================= */
function startLevel(index=0){
  currentLevel = clamp(index, 0, LEVELS.length-1);
  const L = LEVELS[currentLevel] || { name:'Endless', scale:1.0 };
  resizeCanvas();
  cols = Math.max(11, Math.floor(19 * (L.scale || 1)));
  rows = Math.max(11, Math.floor(19 * (L.scale || 1)));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  maze = generateMaze(cols, rows);
  cacheMaze();
  // spawn player a little away from top-left so not clipped: forward offset
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = []; clones=[]; powerups=[]; particles=[]; frameCount=0; cloneInterval = Math.max(60, 300 - Math.floor(difficultyNumeric()*80));
  running = true; paused=false; startTime = Date.now(); activePower = null;
  placePortal();
  // hide menu completely
  if(menu) menu.classList.add('hidden'); if(ui) ui.classList.remove('panel-hidden');
  lastFrame = performance.now(); requestAnimationFrame(animate); tickLoop();
}

/* geometry-dash style transition to next */
function transitionToNextLevel(){
  running = false; if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, 1);
  let t=0, dur=36;
  function anim(){
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI*(t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, -(s-1)*cx, -(s-1)*cy);
    drawBackground(performance.now()); drawMaze(); drawPortal(performance.now());
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${t/dur*0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t <= dur) requestAnimationFrame(anim);
    else { startLevel(Math.min(LEVELS.length-1, currentLevel+1)); showToast(`Level Up: ${LEVELS[currentLevel].name}`); }
  }
  anim();
}

function onGameOver(){
  running = false; const elapsed = nowSec(); const prevBest = Number(localStorage.getItem('shadow_clone_best')) || 0;
  if(elapsed > prevBest){ localStorage.setItem('shadow_clone_best', elapsed); if(AUDIO.newRecord) safePlay(AUDIO.newRecord, 1); showToast('NEW RECORD!'); addToLeaderboard(elapsed); }
  setTimeout(()=>{ // show menu overlay
    if(menuOverlay) menuOverlay.classList.remove('hidden');
  }, 600);
}

/* =========================
   tick loop to hold directions
   ========================= */
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

/* =========================
   audio safe play + synth fallback
   ========================= */
let AUDIO_CTX = null;
function ensureAudioCtx(){ if(!AUDIO_CTX) AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)(); }
function synthOnce(type='pick', volume=0.8){
  try{
    ensureAudioCtx();
    const ctxx = AUDIO_CTX;
    const o = ctxx.createOscillator(); const g = ctxx.createGain(); o.connect(g); g.connect(ctxx.destination);
    const t = ctxx.currentTime;
    if(type==='spawn'){ o.type='sawtooth'; o.frequency.value=640; g.gain.value=0.0001; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx?volume:0.0001, t+0.002); g.gain.exponentialRampToValueAtTime(0.0001, t+0.15); }
    else if(type==='pickup'){ o.type='triangle'; o.frequency.value=980; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx?volume:0.0001, t+0.002); g.gain.exponentialRampToValueAtTime(0.0001, t+0.12); }
    else if(type==='portal'){ o.type='sine'; o.frequency.value=420; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx?volume*0.9:0.0001, t+0.002); g.gain.exponentialRampToValueAtTime(0.0001, t+0.24); }
    else if(type==='death'){ o.type='sine'; o.frequency.value=150; g.gain.exponentialRampToValueAtTime(SETTINGS.sfx?volume:0.0001, t+0.002); g.gain.exponentialRampToValueAtTime(0.0001, t+0.34); }
    o.start(t); o.stop(t+0.26);
  }catch(e){}
}

function safePlay(a, vol=1){
  if(!a) return false;
  try{ a.volume = vol; a.currentTime = 0; a.play().catch(()=>{}); return true; }catch(e){ return false; }
}

/* =========================
   leaderboard
   ========================= */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem('shadow_clone_leaderboard') || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):','Player') || 'Player';
  name = name.slice(0,12);
  list.push({name,time}); list.sort((a,b)=> b.time - a.time); localStorage.setItem('shadow_clone_leaderboard', JSON.stringify(list.slice(0,50))); updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem('shadow_clone_leaderboard') || '[]');
  if(!leaderboardList) return;
  leaderboardList.innerHTML = '';
  list.slice(0,10).forEach(it => { const li = document.createElement('li'); li.textContent = `${it.name} — ${it.time}s`; leaderboardList.appendChild(li); });
}
clearLeaderboardBtn?.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem('shadow_clone_leaderboard'); updateLeaderboardUI(); } });

/* =========================
   UI wiring
   ========================= */
function wireUI(){
  // start
  startBtn?.addEventListener('click', async ()=>{
    if(preloader) preloader.classList.remove('hidden');
    await preloadAll(true);
    // set audio elements src fallback
    try{ if(AUDIO.bg) bgMusicEl.src = AUDIO.bg.src; if(AUDIO.spawn) spawnSfxEl.src = AUDIO.spawn.src; if(AUDIO.pickup) pickupSfxEl.src = AUDIO.pickup.src; if(AUDIO.portal) portalSfxEl.src = AUDIO.portal.src; if(AUDIO.death) deathSfxEl.src = AUDIO.death.src; if(AUDIO.newRecord) newRecordSfxEl.src = AUDIO.newRecord.src; }catch(e){}
    // stop showing main menu
    menu?.classList.add('hidden'); ui?.classList.remove('panel-hidden');
    // show mobile joystick if small screens
    if(window.innerWidth <= 720) mobileControls?.classList.remove('hidden');
    // initialize joystick keyboard
    initJoystick();
    // start
    startLevel(0);
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, 0.45);
    if(preloader) preloader.classList.add('hidden');
  });

  // tutorial
  tutorialBtn?.addEventListener('click', ()=>{ tutorialBox && tutorialBox.classList.toggle('hidden'); });
  // settings
  settingsBtn?.addEventListener('click', ()=>{ settingsBox && settingsBox.classList.toggle('hidden'); });
  // leaderboard
  leaderBtn?.addEventListener('click', ()=>{ leaderboardBox && leaderboardBox.classList.toggle('hidden'); updateLeaderboardUI(); });

  // close buttons
  qAll('.closeBtn').forEach(b=> b.addEventListener('click', (e)=>{ e.target.closest('.modal')?.classList.add('hidden'); menu?.classList.remove('hidden'); }));

  // header menu
  menuBtnHeader?.addEventListener('click', ()=>{ menuOverlay && menuOverlay.classList.remove('hidden'); });

  // menu overlay controls
  restartBtn?.addEventListener('click', ()=>{ startLevel(0); menuOverlay?.classList.add('hidden'); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, 0.45); });
  document.querySelectorAll('#menuOverlay .closeBtn').forEach(b=> b.addEventListener('click', ()=> menuOverlay?.classList.add('hidden')));
  document.getElementById('menuReturnBtn')?.addEventListener('click', ()=>{ running=false; ui?.classList.add('panel-hidden'); menu?.classList.remove('hidden'); if(AUDIO.bg) AUDIO.bg.pause(); });

  // toggles
  musicToggleEl?.addEventListener('change', ()=>{ SETTINGS.music = !!musicToggleEl.checked; if(!SETTINGS.music) AUDIO.bg && AUDIO.bg.pause(); else if(AUDIO.bg) safePlay(AUDIO.bg, 0.45); saveSettings(); });
  sfxToggleEl?.addEventListener('change', ()=>{ SETTINGS.sfx = !!sfxToggleEl.checked; saveSettings(); });
  difficultyEl?.addEventListener('input', ()=>{ SETTINGS.difficulty = difficultyEl.value; saveSettings(); });

  // power button
  btnPower?.addEventListener('click', ()=>{ applyPowerup('shock'); });
}

/* =========================
   save settings
   ========================= */
function saveSettings(){ try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); }catch(e){ console.warn('save settings failed', e); } }

/* =========================
   mini map creation (if absent)
   ========================= */
let miniMap = null;
function createMiniMap(){
  miniMap = document.getElementById('miniMap') || document.createElement('canvas');
  if(!document.getElementById('miniMap')){ miniMap.id = 'miniMap'; document.body.appendChild(miniMap); miniMap.style.position='absolute'; miniMap.style.right='18px'; miniMap.style.top='18px'; miniMap.style.borderRadius='8px'; miniMap.style.zIndex = 30; }
  miniCtx = miniMap.getContext('2d');
}

/* =========================
   helper for missing-field guard
   ========================= */
function qAll(sel){ return Array.from(document.querySelectorAll(sel)); }

/* =========================
   Boot
   ========================= */
const LEVELS = [
  {name:'Novice Shadow', scale:1.0},
  {name:'Wandering Echo', scale:1.12},
  {name:'Night Stalker', scale:1.25},
  {name:'Spectral Onslaught', scale:1.45},
  {name:"Ninja's Dread", scale:1.75},
  {name:'Endless', scale:2.2}
];

function init(){
  // canvas context
  resizeCanvas();
  createMiniMap();
  wireUI();
  // apply audio element sources (if audio loaded)
  if(AUDIO.bg) bgMusicEl.src = AUDIO.bg.src;
  if(AUDIO.spawn) spawnSfxEl.src = AUDIO.spawn.src;
  if(AUDIO.pickup) pickupSfxEl.src = AUDIO.pickup.src;
  if(AUDIO.portal) portalSfxEl.src = AUDIO.portal.src;
  if(AUDIO.death) deathSfxEl.src = AUDIO.death.src;
  if(AUDIO.newRecord) newRecordSfxEl.src = AUDIO.newRecord.src;

  // populate best record
  const best = Number(localStorage.getItem('shadow_clone_best')) || 0;
  bestRecordText && (bestRecordText.textContent = best ? `Best: ${best}s` : 'Best: —');

  // quick prefetch small (no preloader)
  preloadAll(false).then(()=>{ console.log('Prefetch complete'); });

  // fine tune ninja offset so it's not clipped: slightly advance rx/ry
  // UI ready
  console.log('Init complete');
}
init();

/* =========================
   Expose debug
   ========================= */
window.__SCE = { startLevel, spawnPowerup, spawnClone, IMG, AUDIO, SPRITES };
