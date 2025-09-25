/* Shadow Clone Escape — Full rebuild
   script.js
   Put this file in repo root and ensure your index.html & style.css are the versions provided.
*/

/* ---------------- ASSET CONFIG ---------------- */
const ASSETS = {
  ninja: 'assets/ninja_spritesheet.png',   // expected 1536x534, 4 frames horizontally
  clones: 'assets/clones_spritesheet.png', // expected 1060x433, 3 frames horizontally
  portal: 'assets/portal.png',             // expected 361x316
  background: 'assets/background.png',
  bgLayers: ['assets/bg_layer1.png','assets/bg_layer2.png','assets/bg_layer3.png'],
  bgMusic: 'assets/bg_music_loop.wav',
  spawnSfx: 'assets/spawn.wav',
  pickupSfx: 'assets/powerup.wav',
  portalSfx: 'assets/portal.wav',
  deathSfx: 'assets/death.wav'
};

/* ---------------- DOM ---------------- */
const $ = id => document.getElementById(id);
const preloader = $('preloader');
const preloadText = $('preloadText');

const btnStart = $('btnStart'), btnTutorial = $('btnTutorial'), btnSettings = $('btnSettings'), btnLeaderboard = $('btnLeaderboard'), btnCredits = $('btnCredits');
const tutorialEl = $('tutorial'), settingsEl = $('settings'), leaderboardEl = $('leaderboard'), creditsEl = $('credits');
const closeTutorial = $('closeTutorial'), closeSettings = $('closeSettings'), closeLeaderboard = $('closeLeaderboard'), closeCredits = $('closeCredits');

const mainMenu = $('mainMenu');
const UI = $('ui');
const canvas = $('gameCanvas');
const miniCanvas = $('miniMap');

const statusText = $('status'), timerText = $('timer'), powerupBox = $('powerupBox');
const joystickContainer = $('joystickContainer'), joystickEl = $('joystick');
const pauseBtn = $('pauseBtn'), menuOverlay = $('menuOverlay'), resumeBtn = $('resumeBtn'), restartBtn = $('restartBtn'), backMenuBtn = $('backMenuBtn');
const gameOverEl = $('gameOver'), gameOverText = $('gameOverText'), retryBtn = $('retryBtn'), quitBtn = $('quitBtn');

const leaderboardList = $('leaderboardList'), clearLeaderboardBtn = $('clearLeaderboard');

const notifArea = $('notifArea') || (() => { const d=document.createElement('div'); d.id='notifArea'; document.body.appendChild(d); return d; })();

/* ---------------- STORAGE & SETTINGS ---------------- */
const STORAGE_KEYS = { SETTINGS:'sce_settings_v1', BEST:'sce_best_v1', LEADER:'sce_leader_v1' };
let SETTINGS = { music:true, sfx:true, musicVolume:0.45, sfxVolume:1.0, difficulty:'normal', joystickSensitivity:0.9 };
try { const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)); if(s) SETTINGS = {...SETTINGS, ...s}; } catch(e){}

/* ---------------- AUDIO FALLBACKS ---------------- */
let audioCtx = null;
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSynth(type){
  try {
    ensureAudioCtx();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime;
    if(type==='spawn'){ o.type='sawtooth'; o.frequency.value = 640; }
    else if(type==='pickup'){ o.type='triangle'; o.frequency.value = 980; }
    else if(type==='portal'){ o.type='sine'; o.frequency.value = 420; }
    else if(type==='death'){ o.type='sine'; o.frequency.value = 120; }
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    g.gain.linearRampToValueAtTime(SETTINGS.sfx ? SETTINGS.sfxVolume * 0.8 : 0, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.start(now); o.stop(now + 0.18);
  } catch(e){}
}

/* ---------------- LOADERS ---------------- */
function loadImage(src){ return new Promise(res => { if(!src) return res(null); const i=new Image(); i.onload=()=>res(i); i.onerror=()=>{ console.warn('image failed', src); res(null); }; i.src=src; }); }
function loadAudio(src){ return new Promise(res => { if(!src) return res(null); try { const a=new Audio(); a.addEventListener('canplaythrough', ()=>res(a), {once:true}); a.addEventListener('error', ()=>{ console.warn('audio failed',src); res(null); }, {once:true}); a.src = src; } catch(e){ res(null); } }); }

const IMG = { ninja:null, clones:null, portal:null, background:null, bgLayers:[] };
const AUDIO = { bg:null, spawn:null, pickup:null, portal:null, death:null };
const SPR = { ninja:{cols:4,w:0,h:0}, clones:{cols:3,w:0,h:0}, portal:{cols:1,w:0,h:0} };

async function preloadAll(show=true){
  if(show && preloader) preloader.classList.remove('hidden');
  const tasks = [
    {t:'img', k:'ninja', p:ASSETS.ninja},
    {t:'img', k:'clones', p:ASSETS.clones},
    {t:'img', k:'portal', p:ASSETS.portal},
    {t:'img', k:'bg', p:ASSETS.background},
    {t:'img', k:'bg1', p:ASSETS.bgLayers?.[0]},
    {t:'img', k:'bg2', p:ASSETS.bgLayers?.[1]},
    {t:'img', k:'bg3', p:ASSETS.bgLayers?.[2]},
    {t:'audio', k:'bg', p:ASSETS.bgMusic},
    {t:'audio', k:'spawn', p:ASSETS.spawnSfx},
    {t:'audio', k:'pickup', p:ASSETS.pickupSfx},
    {t:'audio', k:'portal', p:ASSETS.portalSfx},
    {t:'audio', k:'death', p:ASSETS.deathSfx}
  ];

  let done = 0, total = tasks.filter(t=>t.p).length || tasks.length;
  for(const t of tasks){
    if(!t.p){ done++; continue; }
    if(t.t === 'img'){
      const im = await loadImage(t.p);
      if(im){
        if(t.k==='ninja') IMG.ninja = im;
        else if(t.k==='clones') IMG.clones = im;
        else if(t.k==='portal') IMG.portal = im;
        else if(t.k==='bg') IMG.background = im;
        else if(t.k==='bg1') IMG.bgLayers[0] = im;
        else if(t.k==='bg2') IMG.bgLayers[1] = im;
        else if(t.k==='bg3') IMG.bgLayers[2] = im;
        console.log('Loaded image', t.p);
      } else console.warn('Missing image', t.p);
    } else {
      const a = await loadAudio(t.p);
      if(a){
        if(t.k==='bg') AUDIO.bg = a;
        else if(t.k==='spawn') AUDIO.spawn = a;
        else if(t.k==='pickup') AUDIO.pickup = a;
        else if(t.k==='portal') AUDIO.portal = a;
        else if(t.k==='death') AUDIO.death = a;
        console.log('Loaded audio', t.p);
      } else console.warn('Missing audio', t.p);
    }
    done++; const pct = Math.floor((done/total)*100);
    if(preloadText) preloadText.textContent = `Loading assets... ${pct}%`;
    await new Promise(r=>setTimeout(r,20));
  }

  // compute sprite frame sizes defensively
  if(IMG.ninja){ SPR.ninja.w = Math.floor(IMG.ninja.naturalWidth / SPR.ninja.cols); SPR.ninja.h = Math.floor(IMG.ninja.naturalHeight / 1); }
  if(IMG.clones){ SPR.clones.w = Math.floor(IMG.clones.naturalWidth / SPR.clones.cols); SPR.clones.h = Math.floor(IMG.clones.naturalHeight / 1); }
  if(IMG.portal){ SPR.portal.w = Math.floor(IMG.portal.naturalWidth / SPR.portal.cols); SPR.portal.h = Math.floor(IMG.portal.naturalHeight / 1); }

  // audio
  if(AUDIO.bg){ AUDIO.bg.loop = true; AUDIO.bg.volume = SETTINGS.musicVolume; }
  if(AUDIO.spawn) AUDIO.spawn.volume = SETTINGS.sfxVolume;
  if(AUDIO.pickup) AUDIO.pickup.volume = SETTINGS.sfxVolume;
  if(AUDIO.portal) AUDIO.portal.volume = SETTINGS.sfxVolume;
  if(AUDIO.death) AUDIO.death.volume = SETTINGS.sfxVolume;

  if(show && preloader) preloader.classList.add('hidden');
}

/* ---------------- CANVAS / GRID ---------------- */
const ctx = canvas.getContext('2d');
const miniCtx = miniCanvas ? miniCanvas.getContext('2d') : null;
let pixelRatio = window.devicePixelRatio || 1;
let cols = 19, rows = 19, tileSize = 30;
let maze = null, mazeCache = null;

/* gameplay state */
let player = null, movesHistory = [], clones = [], powerups = [], particles = [];
let frameCount = 0, running=false, paused=false, startTime=0, cloneInterval = 300, activePower = null, PORTAL = null, currentLevel = 0;

/* resize */
function setupCanvas(){
  pixelRatio = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth - 40, 1400);
  const cssW = Math.min(maxW, window.innerWidth - 40);
  canvas.style.width = cssW + 'px';
  const logicalW = Math.floor(cssW);
  const logicalH = Math.floor(logicalW * 0.62);
  canvas.width = Math.floor(logicalW * pixelRatio);
  canvas.height = Math.floor(logicalH * pixelRatio);
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);

  if(miniCanvas){
    const mmW = Math.min(220, Math.floor(cssW * 0.28));
    const mmH = Math.floor(mmW * 0.55);
    miniCanvas.width = mmW; miniCanvas.height = mmH; miniCanvas.style.width = mmW + 'px'; miniCanvas.style.height = mmH + 'px';
  }

  const preferred = window.innerWidth < 720 ? 24 : 36;
  cols = Math.max(11, Math.floor(logicalW / preferred));
  rows = Math.max(11, Math.floor(logicalH / preferred));
  if(cols % 2 === 0) cols--; if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(logicalW / cols, logicalH / rows));
}
window.addEventListener('resize', ()=>{ setupCanvas(); cacheMaze(); });

/* ---------------- MAZE (recursive backtracker) ---------------- */
function generateMaze(c, r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x]=0;
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
  grid[1][1]=0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}
function cacheMaze(){
  if(!maze || !maze[0]){ mazeCache = null; return; }
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize; mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const v = (maze[y] && typeof maze[y][x] !== 'undefined') ? maze[y][x] : 1;
      if(v === 1){
        mctx.fillStyle = '#17171b'; mctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
        // wall bevel
        mctx.fillStyle = 'rgba(255,255,255,0.02)'; mctx.fillRect(x*tileSize+1,y*tileSize+1,tileSize-2,tileSize-2);
      } else {
        mctx.fillStyle = '#07070a'; mctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
      }
    }
  }
}

/* portal placement */
function placePortal(){
  let best=null,bestd=-1;
  for(let y=1;y<rows-1;y++){
    for(let x=1;x<cols-1;x++){
      if(maze[y] && maze[y][x]===0 && !(x===1 && y===1)){
        const d = Math.abs(x-1) + Math.abs(y-1);
        if(d > bestd){ bestd = d; best = {x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* ---------------- POWERUPS & PARTICLES ---------------- */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let tries=0;
  while(tries++ < 300){
    const x = randInt(1, cols-2), y = randInt(1, rows-2);
    if(maze[y] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      powerups.push({x,y,type:POWER_TYPES[randInt(0,POWER_TYPES.length-1)], bob:Math.random()*Math.PI*2, spawned:Date.now()});
      break;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = {type:'speed', until: Date.now()+4500};
  else if(type==='cloak') activePower = {type:'cloak', until: Date.now()+5000};
  else if(type==='shock'){
    clones.forEach(c=>{ c.index = Math.max(0, (c.index||0) - 28); });
    spawnParticles((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, '#bfe8ff', 18);
    if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); else playSynth('spawn');
  }
  if(SETTINGS.sfx && AUDIO.pickup) safePlay(AUDIO.pickup, SETTINGS.sfxVolume); else playSynth('pickup');
  showToast(type.toUpperCase());
}

function spawnParticles(px,py,color,count=18){
  for(let i=0;i<count;i++){
    particles.push({ x:px + (Math.random()-0.5)*tileSize, y:py + (Math.random()-0.5)*tileSize, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:30+Math.random()*40, color });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.995; p.vy *= 0.995; p.life--;
    if(p.life <= 0) particles.splice(i,1);
  }
}

/* ---------------- CLONE CLASS ---------------- */
class Clone {
  constructor(path,type='basic'){ this.path = path.slice(); this.index = 0; this.type = type; this.spawnFrame = frameCount; this.x=this.path[0]?.x??1; this.y=this.path[0]?.y??1; }
  update(){
    if(this.type==='fast') this.index += 1 + (Math.random()<0.45?1:0);
    else if(this.type==='wraith'){
      if(Math.random() < 0.01 + Math.min(0.05, frameCount/60000)){
        const jump = Math.min(50, Math.floor(Math.random()*Math.min(200, this.path.length))); this.index = Math.min(this.path.length-1, this.index + jump);
      } else this.index++;
    } else this.index++;
    if(this.index < this.path.length){ this.x = this.path[this.index].x; this.y = this.path[this.index].y; }
  }
  draw(){
    if(IMG.clones && SPR.clones.w){
      const tIndex = (this.type==='wraith')?2:(this.type==='fast'?1:0);
      const sx = tIndex * SPR.clones.w;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(IMG.clones, sx, 0, SPR.clones.w, SPR.clones.h, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = this.type === 'wraith' ? '#b14' : this.type === 'fast' ? '#f90' : '#c33';
      ctx.fillRect(this.x*tileSize+1, this.y*tileSize+1, tileSize-2, tileSize-2);
    }
  }
}

/* ---------------- INPUT ---------------- */
let activeDirs = {up:false,down:false,left:false,right:false};
let lastStepTime = 0, stepMsBase = 140;

function initInput(){
  document.addEventListener('keydown', (e)=>{
    const k = e.key;
    if(k==='w' || k==='W' || k==='ArrowUp'){ activeDirs.up = true; stepPlayer(); playStep(); }
    if(k==='s' || k==='S' || k==='ArrowDown'){ activeDirs.down = true; stepPlayer(); playStep(); }
    if(k==='a' || k==='A' || k==='ArrowLeft'){ activeDirs.left = true; stepPlayer(); playStep(); }
    if(k==='d' || k==='D' || k==='ArrowRight'){ activeDirs.right = true; stepPlayer(); playStep(); }
    if(k === ' ') applyPowerup('shock');
    if(k === 'Escape') togglePause();
  });
  document.addEventListener('keyup', (e)=>{
    const k = e.key;
    if(k==='w' || k==='W' || k==='ArrowUp') activeDirs.up = false;
    if(k==='s' || k==='S' || k==='ArrowDown') activeDirs.down = false;
    if(k==='a' || k==='A' || k==='ArrowLeft') activeDirs.left = false;
    if(k==='d' || k==='D' || k==='ArrowRight') activeDirs.right = false;
  });
}
function playStep(){ if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); else playSynth('spawn'); }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type==='speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - (difficultyNumeric()-1) * 8));
  if(now - lastStepTime < ms) return;
  lastStepTime = now;
  if(!running || paused) return;

  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--;
  else if(activeDirs.down) ny++;
  else if(activeDirs.left) nx--;
  else if(activeDirs.right) nx++;

  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny] && maze[ny][nx] === 0){
    player.x = nx; player.y = ny;
    movesHistory.push({x:nx,y:ny});
    for(let i=powerups.length-1;i>=0;i--){
      const p = powerups[i];
      if(p.x === nx && p.y === ny){ applyPowerup(p.type); powerups.splice(i,1); break; }
    }
    if(PORTAL && nx === PORTAL.x && ny === PORTAL.y){ if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume); else playSynth('portal'); transitionToNextLevel(); }
  }
}

/* ---------------- JOYSTICK (mobile) ---------------- */
let joyActive=false, joyPtr=null, joyOrigin={x:0,y:0}, joyPos={x:0,y:0}, JOY_MAX=40;
function initJoystick(){
  if(!joystickContainer || !joystickEl) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if(!isTouch){ joystickContainer.classList.add('hidden'); return; }
  joystickContainer.classList.remove('hidden');

  joystickContainer.addEventListener('pointerdown', (ev)=>{
    joystickContainer.setPointerCapture(ev.pointerId);
    joyActive = true; joyPtr = ev.pointerId;
    const rect = joystickContainer.getBoundingClientRect();
    joyOrigin.x = rect.left + rect.width/2; joyOrigin.y = rect.top + rect.height/2;
    updateJoystick(ev.clientX, ev.clientY);
  });
  joystickContainer.addEventListener('pointermove', (ev)=>{ if(!joyActive || ev.pointerId!==joyPtr) return; updateJoystick(ev.clientX, ev.clientY); });
  joystickContainer.addEventListener('pointerup', (ev)=>{ if(ev.pointerId!==joyPtr) return; joyActive=false; joyPtr=null; joyPos={x:0,y:0}; joystickEl.style.transform='translate(0px,0px)'; activeDirs={up:false,down:false,left:false,right:false}; });
  joystickContainer.addEventListener('pointercancel', ()=>{ joyActive=false; joyPtr=null; joyPos={x:0,y:0}; joystickEl.style.transform='translate(0px,0px)'; activeDirs={up:false,down:false,left:false,right:false}; });
}
function updateJoystick(cx,cy){
  const dx = cx - joyOrigin.x, dy = cy - joyOrigin.y; const dist = Math.sqrt(dx*dx + dy*dy) || 1;
  const nx = dx/dist, ny = dy/dist; const r = Math.min(dist, JOY_MAX) * SETTINGS.joystickSensitivity;
  joyPos.x = nx * r; joyPos.y = ny * r; joystickEl.style.transform = `translate(${joyPos.x}px, ${joyPos.y}px)`;
  activeDirs.up = (ny < -0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.down = (ny > 0.45 && Math.abs(ny) > Math.abs(nx));
  activeDirs.left = (nx < -0.45 && Math.abs(nx) > Math.abs(ny));
  activeDirs.right = (nx > 0.45 && Math.abs(nx) > Math.abs(ny));
  stepPlayer();
}

/* ---------------- SPAWN CLONE ---------------- */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random(); let type='basic'; if(p < 0.08) type='wraith'; else if(p < 0.22) type='fast';
  clones.push(new Clone(snap, type));
  if(SETTINGS.sfx && AUDIO.spawn) safePlay(AUDIO.spawn, SETTINGS.sfxVolume); else playSynth('spawn');
  spawnParticles((player.rx||player.x)*tileSize + tileSize/2, (player.ry||player.y)*tileSize + tileSize/2, '#ff4466', 20);
}

/* ---------------- DRAW HELPERS ---------------- */
function drawBackground(now){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.save();
  if(IMG.background){ const t = Date.now()/12000; const xoff = Math.sin(t) * 36; ctx.drawImage(IMG.background, -40 + xoff, -20, w+80, h+40); }
  else { const g = ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,'#071018'); g.addColorStop(1,'#03040a'); ctx.fillStyle = g; ctx.fillRect(0,0,w,h); }
  for(let i=0;i<IMG.bgLayers.length;i++){ const layer = IMG.bgLayers[i]; if(!layer) continue; const depth=(i+1)/(IMG.bgLayers.length+1); const xoff = Math.sin(Date.now()/(7000*(1+depth))) * 12 * depth; ctx.globalAlpha = 0.75 - depth*0.15; ctx.drawImage(layer, -20 + xoff, -10, w+40, h+20); ctx.globalAlpha=1; }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0,0,canvas.width/pixelRatio, canvas.height/pixelRatio);
}

function drawMaze(){
  if(!maze) return;
  if(mazeCache){ ctx.drawImage(mazeCache, 0, 0); return; }
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      const v = maze[y] && typeof maze[y][x] !== 'undefined' ? maze[y][x] : 1;
      if(v === 1){ ctx.fillStyle = '#2a2a36'; ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(x*tileSize+1,y*tileSize+1,tileSize-2,tileSize-2); }
      else { ctx.fillStyle = '#07070a'; ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); }
    }
  }
}

function drawPowerups(now){
  for(const pu of powerups){
    const cx = pu.x*tileSize + tileSize/2; const cy = pu.y*tileSize + tileSize/2 + Math.sin((frameCount+pu.bob)*0.12)*3;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(Math.sin(frameCount/18 + pu.bob)*0.08);
    if(pu.type==='speed'){ ctx.fillStyle='#4fd1ff'; ctx.beginPath(); ctx.arc(0,0,tileSize*0.24,0,Math.PI*2); ctx.fill(); }
    else if(pu.type==='cloak'){ ctx.fillStyle='#9be7b0'; ctx.fillRect(-tileSize*0.2,-tileSize*0.2,tileSize*0.4,tileSize*0.4); }
    else { ctx.fillStyle='#bfe8ff'; ctx.beginPath(); ctx.moveTo(0,-tileSize*0.22); ctx.lineTo(tileSize*0.14,0); ctx.lineTo(-tileSize*0.14,0); ctx.fill(); }
    ctx.restore();
  }
}

function drawPortal(now){
  if(!PORTAL) return;
  const px = PORTAL.x*tileSize + tileSize/2, py = PORTAL.y*tileSize + tileSize/2;
  const scale = 0.9 + 0.08 * Math.sin(now/280); const rot = (now/1400)%(Math.PI*2);
  if(IMG.portal){ ctx.save(); ctx.translate(px,py); ctx.rotate(rot); ctx.globalAlpha = 0.9 + 0.06 * Math.sin(now/320); ctx.drawImage(IMG.portal, -tileSize*scale/2, -tileSize*scale/2, tileSize*scale, tileSize*scale); ctx.restore(); }
  else { ctx.save(); ctx.translate(px,py); ctx.rotate(rot/1.8); ctx.fillStyle='#66ffcc'; ctx.beginPath(); ctx.ellipse(0,0,tileSize*0.42,tileSize*0.46,0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
}

function drawMinimap(){
  if(!miniCtx || !maze) return;
  const mmW = miniCanvas.width, mmH = miniCanvas.height; miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++){ for(let x=0;x<cols;x++){ miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707'; miniCtx.fillRect(x*cw, y*ch, cw, ch); } }
  for(const c of clones){ miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666'; miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9)); }
  miniCtx.fillStyle = '#66ff99'; miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){ miniCtx.fillStyle = pu.type==='speed' ? '#4fd1ff' : pu.type==='cloak' ? '#9be7b0' : '#bfe8ff'; miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6); }
}

function drawPlayer(){
  if(!player) return;
  if(IMG.ninja && SPR.ninja.w){
    const animCol = Math.floor((frameCount/6) % SPR.ninja.cols); const sx = animCol * SPR.ninja.w;
    ctx.drawImage(IMG.ninja, sx, 0, SPR.ninja.w, SPR.ninja.h, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize);
  } else {
    const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
    const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
    ctx.save(); ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px,py,player.radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}

/* ---------------- HUD & TOAST ---------------- */
function showToast(text, duration=1400){ const el=document.createElement('div'); el.className='notif'; el.textContent=text; notifArea.appendChild(el); setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); }, duration); }
function updateHUD(){ if(timerText) timerText.textContent = `Time: ${nowSec()}s`; if(powerupBox){ if(activePower && Date.now() < activePower.until){ const rem=Math.ceil((activePower.until - Date.now())/1000); powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`; } else { powerupBox.innerHTML=''; if(activePower && Date.now() >= activePower.until) activePower = null; } } }

/* ---------------- MAIN LOOP ---------------- */
let lastFrame = performance.now();
function animate(now){
  if(!running || paused) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  // spawn powerups occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + difficultyNumeric()*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneInterval > 30) cloneInterval -= 1 + (difficultyNumeric()-1);
    if(Math.random() < 0.02 + (difficultyNumeric()-1)*0.03) spawnClone();
  }

  // update clones & collision
  for(let i=clones.length-1;i>=0;i--){ const c = clones[i]; c.update(); if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){ if(!(activePower && activePower.type === 'cloak' && Date.now() < activePower.until)){ running=false; if(SETTINGS.sfx && AUDIO.death) safePlay(AUDIO.death, SETTINGS.sfxVolume); else playSynth('death'); showToast('☠️ You Died'); spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66', 40); setTimeout(()=>{ onGameOver(); }, 800); return; } } }

  updateParticles();

  ctx.clearRect(0,0,canvas.width/pixelRatio, canvas.height/pixelRatio);
  drawBackground(now);
  drawMaze();
  drawPowerups(now);
  drawPortal(now);
  for(const c of clones) c.draw();

  const speed = 12 + (difficultyNumeric()-1)*6; const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i]; const alpha = (i - Math.max(0, movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha * 0.25; ctx.fillStyle = '#33ff77'; ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  drawPlayer();
  for(const p of particles){ ctx.globalAlpha = Math.max(0, p.life/70); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1;

  drawMinimap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* ---------------- LEVELS & LIFECYCLE ---------------- */
const LEVELS = [
  {name:'Novice Shadow', scale:1.0},
  {name:'Wandering Echo', scale:1.12},
  {name:'Night Stalker', scale:1.25},
  {name:'Spectral Onslaught', scale:1.45},
  {name:"Ninja's Dread", scale:1.75},
  {name:'Endless', scale:2.2}
];

function startLevel(index=0){
  currentLevel = clamp(index,0,LEVELS.length-1);
  setupCanvas();
  const L = LEVELS[currentLevel];
  cols = Math.max(11, Math.floor(19 * L.scale)); rows = Math.max(11, Math.floor(19 * L.scale));
  if(cols % 2 === 0) cols--; if(rows % 2 === 0) rows--;
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = []; clones = []; powerups = []; particles = [];
  frameCount = 0; cloneInterval = Math.max(40, 300 - Math.floor(difficultyNumeric()*80));
  running = true; paused=false; startTime = Date.now(); activePower = null;
  placePortal();
  if(preloader) preloader.classList.add('hidden');
  if(statusText) statusText.textContent = `Level: ${LEVELS[currentLevel].name}`;
  lastFrame = performance.now(); requestAnimationFrame(animate); tickLoop();
}

function transitionToNextLevel(){
  running = false;
  if(SETTINGS.sfx && AUDIO.portal) safePlay(AUDIO.portal, SETTINGS.sfxVolume); else playSynth('portal');
  let t=0, dur=36;
  function anim(){
    ctx.save();
    const s = 1 + 0.08 * Math.sin(Math.PI*(t/dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, -(s-1)*cx, -(s-1)*cy);
    drawBackground(performance.now()); drawMaze(); drawPortal(performance.now());
    ctx.restore();
    ctx.fillStyle = `rgba(0,0,0,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++; if(t <= dur) requestAnimationFrame(anim); else { startLevel(Math.min(LEVELS.length-1, currentLevel+1)); showToast(`Level Up: ${LEVELS[currentLevel].name}`); }
  }
  anim();
}

function onGameOver(){
  running=false;
  const elapsed = nowSec(); const prevBest = Number(localStorage.getItem(STORAGE_KEYS.BEST)) || 0;
  if(elapsed > prevBest){ localStorage.setItem(STORAGE_KEYS.BEST, elapsed); showToast('NEW RECORD!'); addToLeaderboard(elapsed); }
  if(gameOverEl) gameOverEl.classList.remove('hidden'); if(gameOverText) gameOverText.textContent = `You survived ${elapsed}s`;
}

/* ---------------- TICK LOOP ---------------- */
let lastTick = 0;
function tickLoop(){
  if(!running || paused) return;
  const now = performance.now();
  if(now - lastTick > 120){ if(activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer(); lastTick = now; }
  requestAnimationFrame(tickLoop);
}

/* ---------------- AUDIO SAFE PLAY ---------------- */
function safePlay(a, vol=1){ if(!a) return; try{ a.volume = vol; a.currentTime = 0; a.play().catch(()=>{}); }catch(e){} }

/* ---------------- LEADERBOARD ---------------- */
function addToLeaderboard(time){
  let list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADER) || '[]');
  let name = prompt('New high score! Enter your name (max 12 chars):','Player') || 'Player';
  name = name.slice(0,12);
  list.push({name,time}); list.sort((a,b)=> b.time - a.time); localStorage.setItem(STORAGE_KEYS.LEADER, JSON.stringify(list.slice(0,50)));
  updateLeaderboardUI();
}
function updateLeaderboardUI(){
  const list = JSON.parse(localStorage.getItem(STORAGE_KEYS.LEADER) || '[]'); if(!leaderboardList) return;
  leaderboardList.innerHTML = ''; list.slice(0,10).forEach(it=>{ const li=document.createElement('li'); li.textContent = `${it.name} — ${it.time}s`; leaderboardList.appendChild(li); });
}

/* ---------------- UI WIRING ---------------- */
function wireUI(){
  btnStart && btnStart.addEventListener('click', async ()=>{
    await preloadAll(true);
    if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume);
    mainMenu.style.display = 'none'; UI.classList.remove('hidden'); initInput(); initJoystick(); updateLeaderboardUI(); startLevel(0);
  });

  btnTutorial && btnTutorial.addEventListener('click', ()=>{ tutorialEl.classList.remove('hidden'); });
  closeTutorial && closeTutorial.addEventListener('click', ()=>{ tutorialEl.classList.add('hidden'); });

  btnSettings && btnSettings.addEventListener('click', ()=>{ settingsEl.classList.remove('hidden'); });
  closeSettings && closeSettings.addEventListener('click', ()=>{ settingsEl.classList.add('hidden');
    const m = $('musicToggle'), s = $('sfxToggle'), mv = $('musicVolume'), sv = $('sfxVolume'), d = $('difficulty');
    if(m) SETTINGS.music = m.checked; if(s) SETTINGS.sfx = s.checked; if(mv) SETTINGS.musicVolume = Number(mv.value); if(sv) SETTINGS.sfxVolume = Number(sv.value); if(d) SETTINGS.difficulty = d.value;
    saveSettings();
  });

  btnCredits && btnCredits.addEventListener('click', ()=>{ creditsEl.classList.remove('hidden'); });
  closeCredits && closeCredits.addEventListener('click', ()=>{ creditsEl.classList.add('hidden'); });

  btnLeaderboard && btnLeaderboard.addEventListener('click', ()=>{ leaderboardEl.classList.remove('hidden'); updateLeaderboardUI(); });
  clearLeaderboardBtn && clearLeaderboardBtn.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(STORAGE_KEYS.LEADER); updateLeaderboardUI(); }});
  closeLeaderboard && closeLeaderboard.addEventListener('click', ()=>{ leaderboardEl.classList.add('hidden'); });

  pauseBtn && pauseBtn.addEventListener('click', ()=>{ paused=true; running=false; menuOverlay.classList.remove('hidden'); if(AUDIO.bg) AUDIO.bg.pause(); })
  resumeBtn && resumeBtn.addEventListener('click', ()=>{ menuOverlay.classList.add('hidden'); paused=false; running=true; lastFrame = performance.now(); requestAnimationFrame(animate); tickLoop(); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume); });
  restartBtn && restartBtn.addEventListener('click', ()=>{ startLevel(0); menuOverlay.classList.add('hidden'); if(SETTINGS.music && AUDIO.bg) safePlay(AUDIO.bg, SETTINGS.musicVolume); });
  backMenuBtn && backMenuBtn.addEventListener('click', ()=>{ running=false; UI.classList.add('hidden'); menuOverlay.classList.add('hidden'); mainMenu.style.display='flex'; if(AUDIO.bg) AUDIO.bg.pause(); });

  retryBtn && retryBtn.addEventListener('click', ()=>{ gameOverEl.classList.add('hidden'); startLevel(0); });
  quitBtn && quitBtn.addEventListener('click', ()=>{ gameOverEl.classList.add('hidden'); UI.classList.add('hidden'); mainMenu.style.display='flex'; if(AUDIO.bg) AUDIO.bg.pause(); });
}

/* ---------------- HELPERS ---------------- */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const randInt = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
const shuffle = (a) => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a; };
const nowSec = () => Math.floor((Date.now() - startTime)/1000);
function saveSettings(){ try{ localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SETTINGS)); }catch(e){} }
function difficultyNumeric(){ switch(SETTINGS.difficulty){ case 'easy': return 0.8; case 'normal': return 1; case 'hard': return 1.5; case 'nightmare': return 2.2; default: return 1; } }

/* ---------------- BOOT ---------------- */
async function boot(){
  setupCanvas();
  wireUI();
  // populate settings UI
  const m = $('musicToggle'), s = $('sfxToggle'), mv = $('musicVolume'), sv = $('sfxVolume'), d = $('difficulty');
  if(m) m.checked = SETTINGS.music; if(s) s.checked = SETTINGS.sfx; if(mv) mv.value = SETTINGS.musicVolume; if(sv) sv.value = SETTINGS.sfxVolume; if(d) d.value = SETTINGS.difficulty;
  try{ await preloadAll(false); console.log('prefetch complete'); } catch(e){ console.warn('prefetch failed', e); }
  initJoystick();
  ctx.clearRect(0,0,canvas.width/pixelRatio, canvas.height/pixelRatio);
  ctx.fillStyle='#fff'; ctx.font='20px Inter, sans-serif'; ctx.fillText('Shadow Clone Escape — Press START', 20, 40);
  console.log('Boot complete. Assets: ', {IMG, AUDIO, SPR});
}
boot();

// expose for debugging
window.SCE = { startLevel, spawnPowerup, spawnClone, SETTINGS, IMG, AUDIO };
