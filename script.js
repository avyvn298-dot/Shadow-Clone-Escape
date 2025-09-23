/* script.js — Shadow Clone Escape (AAA polished) 
   Place in repo root; assets expected in /assets/ (but loader will tolerate missing optional files).
   Uses the sprite sizes you provided for ninja/clone/portal.
*/

/* ---------------- ASSET NAMES ---------------- */
const ASSET = {
  ninja: "assets/ninja_spritesheet.png",      // 1536x534 -> 4 frames (384x534)
  clone: "assets/clones_spritesheet.png",     // 1060x433 -> 3 frames (~353x433)
  portal: "assets/portal.png",                // 361x316 single
  bgMusic: "assets/bg_music_loop.wav",
  spawnSfx: "assets/spawn.wav",
  powerSfx: "assets/powerup.wav",
  portalSfx: "assets/portal.wav",
  deathSfx: "assets/death.wav"
};

/* ---------------- DOM ---------------- */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const miniMap = document.getElementById("miniMap");
const miniCtx = miniMap?.getContext("2d");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn") || document.getElementById("menuBtnHeader");
const settingsBtn = document.getElementById("settingsBtn");
const tutorialBtn = document.getElementById("tutorialBtn");
const powerupBox = document.getElementById("powerupBox");
const timerText = document.getElementById("timer");
const statusText = document.getElementById("status");
const bestRecordText = document.getElementById("bestRecordText");
const notifArea = document.getElementById("notifArea");
const mobileControls = document.getElementById("mobileControls");
const dpad = document.getElementById("dpad");
const btnPower = document.getElementById("btnPower");

/* ---------------- SETTINGS & STATE ---------------- */
let SETTINGS = { music:true, sfx:true, difficulty:1 };
let STORAGE_KEY = "shadow_clone_best";
let LEADER_KEY = "shadow_clone_leaderboard";

let cols = 19, rows = 19, tileSize = 30;
let maze = [], mazeCache = null;
let player = null, movesHistory = [], clones = [], powerups = [], particles = [];
let frameCount = 0, lastFrame = performance.now();
let running = false, startTime = 0, cloneInterval = 300;
let activePower = null;

/* ---------------- ASSET HOLDER ---------------- */
const IMG = { ninja:null, clone:null, portal:null };
const SFX = { bg:null, spawn:null, powerup:null, portal:null, death:null };

/* ---------------- SPRITE INFO (from user) ---------------- */
const SPRITE_INFO = {
  ninja: { frameW:384, frameH:534, frames:4 },
  clone: { frameW:353, frameH:433, frames:3 },
  portal: { frameW:361, frameH:316, frames:1 }
};

/* ---------------- UTIL ---------------- */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now()-startTime)/1000); }
function safePlay(audio){ if(!audio) return; try{ audio.currentTime = 0; audio.play().catch(()=>{}); }catch(e){} }

/* ---------------- LOADER ---------------- */
function loadImage(src){
  return new Promise(res=>{
    const img = new Image(); img.src = src;
    img.onload = ()=> res(img);
    img.onerror = ()=> res(null);
  });
}
function loadAudio(src){
  return new Promise(res=>{
    try{
      const a = new Audio(); a.src = src;
      a.addEventListener('canplaythrough', ()=> res(a), {once:true});
      a.addEventListener('error', ()=> res(null), {once:true});
    }catch(e){ res(null); }
  });
}

async function preloadAll(){
  IMG.ninja = await loadImage(ASSET.ninja);
  if(!IMG.ninja) console.warn("Missing ninja:", ASSET.ninja);
  IMG.clone = await loadImage(ASSET.clone);
  if(!IMG.clone) console.warn("Missing clone:", ASSET.clone);
  IMG.portal = await loadImage(ASSET.portal);
  if(!IMG.portal) console.warn("Missing portal (will draw block):", ASSET.portal);

  SFX.bg = await loadAudio(ASSET.bgMusic);
  SFX.spawn = await loadAudio(ASSET.spawnSfx);
  SFX.powerup = await loadAudio(ASSET.powerSfx);
  SFX.portal = await loadAudio(ASSET.portalSfx);
  SFX.death = await loadAudio(ASSET.deathSfx);

  if(SFX.bg) { SFX.bg.loop = true; SFX.bg.volume = 0.45; }
  console.log("Assets loaded summary:", { ninja: !!IMG.ninja, clone: !!IMG.clone, portal: !!IMG.portal, bg: !!SFX.bg });
}

/* ---------------- CANVAS SIZING ---------------- */
function resizeCanvas(){
  const maxW = Math.min(window.innerWidth - 40, 980);
  const width = Math.min(maxW, 960);
  canvas.style.width = width + "px";
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * 0.66);
  canvas.width = Math.floor(logicalW * ratio);
  canvas.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);

  const cssW = canvas.clientWidth || logicalW;
  const cssH = canvas.clientHeight || logicalH;
  const preferred = window.innerWidth < 720 ? 26 : 30;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(cssH / preferred));
  if(cols%2===0) cols--;
  if(rows%2===0) rows--;
  tileSize = Math.floor(Math.min(cssW/cols, cssH/rows));

  if(miniMap){
    miniMap.width = 280 * (window.devicePixelRatio || 1);
    miniMap.height = 160 * (window.devicePixelRatio || 1);
    miniMap.style.width = "140px";
    miniMap.style.height = "80px";
    miniCtx.setTransform(window.devicePixelRatio || 1,0,0,window.devicePixelRatio || 1,0,0);
  }
}
window.addEventListener('resize', resizeCanvas);

/* ---------------- MAZE GEN ---------------- */
function generateMaze(c,r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = x+dx, ny = y+dy;
      if(nx>0 && nx<c-1 && ny>0 && ny<r-1 && grid[ny][nx]===1){
        grid[y+dy/2][x+dx/2] = 0;
        carve(nx,ny);
      }
    }
  }
  carve(1,1);
  grid[1][1]=0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}

function cacheMaze(){
  if(!maze) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const m = mazeCache.getContext('2d');
  m.fillStyle = '#070707'; m.fillRect(0,0,mazeCache.width,mazeCache.height);
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x]===1){
        m.fillStyle = '#222'; m.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
        m.fillStyle = 'rgba(0,0,0,0.06)'; m.fillRect(x*tileSize+1,y*tileSize+1,tileSize-2,tileSize-2);
      } else {
        m.fillStyle = '#0b0b0b'; m.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
      }
    }
  }
}

/* ---------------- PLAYER/POWERUPS/CLONES ---------------- */
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

function resetGame(){
  resizeCanvas();
  maze = generateMaze(cols, rows);
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'#66ff99' };
  movesHistory = []; clones = []; powerups = []; particles = [];
  frameCount = 0; cloneInterval = Math.max(50, 300 - (SETTINGS.difficulty-1)*80);
  running = true; startTime = Date.now(); spawnPortal();
  bestRecordText && (bestRecordText.textContent = (Number(localStorage.getItem(STORAGE_KEY)) || 0) ? `Best: ${Number(localStorage.getItem(STORAGE_KEY))}s` : 'Best: —');
  statusText && (statusText.textContent = 'Survive as long as you can'); timerText && (timerText.textContent = 'Time: 0s');
  restartBtn && (restartBtn.style.display = 'none');
}

/* powerups */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let attempts=0;
  while(attempts++<200){
    const x = randInt(1, cols-2), y = randInt(1, rows-2);
    if(maze[y][x]===0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      powerups.push({x,y,type:POWER_TYPES[randInt(0,POWER_TYPES.length-1)],spawned:Date.now(),bob:Math.random()*Math.PI*2});
      return;
    }
  }
}
function applyPowerup(type){
  if(type==='speed') activePower = { type:'speed', until: Date.now() + 4500 };
  else if(type==='cloak') activePower = { type:'cloak', until: Date.now() + 5000 };
  else if(type==='shock') clones.forEach(c=> c.index = Math.max(0, (c.index||0) - 28));
  if(SETTINGS.sfx && SFX.powerup) safePlay(SFX.powerup);
  showNotif(`${type.toUpperCase()}!`);
}

/* particles */
function spawnParticles(px,py,color){
  for(let i=0;i<18;i++) particles.push({ x:px + (Math.random()-0.5)*tileSize, y:py + (Math.random()-0.5)*tileSize, vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, life:20 + Math.random()*30, color});
}
function updateParticles(){ for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.04; p.life--; if(p.life<=0) particles.splice(i,1); } }

/* Clone class */
class Clone{
  constructor(path,type='basic'){ this.path = path.slice(); this.index=0; this.type=type; this.spawnFrame=frameCount; this.x=this.path[0]?.x||1; this.y=this.path[0]?.y||1; }
  update(){ if(this.type==='fast') this.index += 1 + (Math.random()<0.45?1:0); else if(this.type==='wraith'){ if(Math.random() < 0.01 + Math.min(0.05, frameCount/60000)){ const jump = Math.min(50, Math.floor(Math.random()*Math.min(200,this.path.length))); this.index = Math.min(this.path.length-1, this.index + jump); } else this.index++; } else this.index++; if(this.index < this.path.length){ this.x = this.path[this.index].x; this.y = this.path[this.index].y; } }
  draw(){
    if(IMG.clone){
      const info = SPRITE_INFO.clone;
      const colsFrames = Math.max(1, Math.floor(IMG.clone.naturalWidth / info.frameW));
      const col = Math.floor((frameCount/8) % colsFrames);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(IMG.clone, col*info.frameW, 0, info.frameW, info.frameH, this.x*tileSize, this.y*tileSize, tileSize, tileSize);
      ctx.globalAlpha = 1;
    } else { ctx.fillStyle = '#c33'; ctx.fillRect(this.x*tileSize+1,this.y*tileSize+1,tileSize-2,tileSize-2); }
  }
}

/* ---------------- INPUT & STEP ---------------- */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown',(e)=>{
  if(!running) return;
  if(e.key==='ArrowUp' || e.key==='w'){ activeDirs.up=true; stepPlayer(); if(SETTINGS.sfx && SFX.spawn) safePlay(SFX.spawn); }
  if(e.key==='ArrowDown' || e.key==='s'){ activeDirs.down=true; stepPlayer(); }
  if(e.key==='ArrowLeft' || e.key==='a'){ activeDirs.left=true; stepPlayer(); }
  if(e.key==='ArrowRight' || e.key==='d'){ activeDirs.right=true; stepPlayer(); }
});
document.addEventListener('keyup',(e)=>{
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
  lastStepTime = now; if(!running) return;
  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--; else if(activeDirs.down) ny++; else if(activeDirs.left) nx--; else if(activeDirs.right) nx++;
  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny][nx]===0){ player.x = nx; player.y = ny; movesHistory.push({x:nx,y:ny});
    for(let i=powerups.length-1;i>=0;i--){ if(powerups[i].x===nx && powerups[i].y===ny){ applyPowerup(powerups[i].type); powerups.splice(i,1); break; } }
  }
}

/* mobile D-pad */
dpad?.addEventListener('pointerdown',(ev)=>{ const btn = ev.target.closest('button[data-dir]'); if(btn){ const dir = btn.dataset.dir; pressDir(dir); btn.setPointerCapture(ev.pointerId); } });
dpad?.addEventListener('pointerup',(ev)=>{ const btn = ev.target.closest('button[data-dir]'); if(btn) releaseDir(btn.dataset.dir); });
function pressDir(dir){ if(dir==='up') activeDirs.up=true; if(dir==='down') activeDirs.down=true; if(dir==='left') activeDirs.left=true; if(dir==='right') activeDirs.right=true; stepPlayer(); }
function releaseDir(dir){ if(dir==='up') activeDirs.up=false; if(dir==='down') activeDirs.down=false; if(dir==='left') activeDirs.left=false; if(dir==='right') activeDirs.right=false; }
btnPower?.addEventListener('click', ()=> applyPowerup('shock') );

/* ---------------- SPAWN CLONES ---------------- */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0,movesHistory.length - len));
  const p = Math.random();
  let type='basic'; if(p<0.08) type='wraith'; else if(p<0.22) type='fast';
  const c = new Clone(snap,type); clones.push(c);
  if(SETTINGS.sfx && SFX.spawn) safePlay(SFX.spawn); spawnParticles((c.x||player.x)*tileSize + tileSize/2,(c.y||player.y)*tileSize + tileSize/2,'#ff4466');
}

/* ---------------- DRAW HELPERS ---------------- */
function drawMaze(){ if(!maze) return; if(mazeCache) ctx.drawImage(mazeCache,0,0); else { for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ ctx.fillStyle = maze[y][x]===1 ? '#222' : '#070707'; ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize); } } }
function drawPowerups(){ for(const pu of powerups){ const bob = Math.sin((frameCount + pu.bob*60)/18)*3; const px = pu.x*tileSize + tileSize/2, py = pu.y*tileSize + tileSize/2 + bob; if(IMG.power_speed) ctx.drawImage(IMG.power_speed, px - tileSize*0.32, py - tileSize*0.32, tileSize*0.64, tileSize*0.64); else { ctx.fillStyle = (pu.type==='speed')? '#ffd86b' : (pu.type==='cloak')? '#7af' : '#9be7b0'; ctx.fillRect(pu.x*tileSize + tileSize*0.2, pu.y*tileSize + tileSize*0.2, tileSize*0.6, tileSize*0.6); } } }
function drawPortal(){ if(!PORTAL) return; if(IMG.portal){ const info = SPRITE_INFO.portal; ctx.drawImage(IMG.portal, 0, 0, info.frameW, info.frameH, PORTAL.x*tileSize, PORTAL.y*tileSize, tileSize, tileSize); } else { ctx.fillStyle='#66ffcc'; ctx.fillRect(PORTAL.x*tileSize+1,PORTAL.y*tileSize+1,tileSize-2,tileSize-2); } }
function drawMiniMap(){ if(!miniMap || !maze) return; const mmW = miniMap.width / (window.devicePixelRatio || 1), mmH = miniMap.height / (window.devicePixelRatio || 1); miniCtx.clearRect(0,0,mmW,mmH); const cw = mmW/cols, ch = mmH/rows; for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){ miniCtx.fillStyle = maze[y][x]===1 ? '#222' : '#070707'; miniCtx.fillRect(x*cw, y*ch, cw, ch); } for(const c of clones){ miniCtx.fillStyle = c.type==='wraith' ? '#ff66ff' : c.type==='fast' ? '#ffb86b' : '#ff6666'; miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9)); } miniCtx.fillStyle = '#66ff99'; miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9)); for(const pu of powerups){ miniCtx.fillStyle = pu.type==='speed' ? '#ffd86b' : pu.type==='cloak' ? '#7af' : '#9be7b0'; miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6); } }

/* ---------------- HUD ---------------- */
function updateHUD(){ timerText && (timerText.textContent = `Time: ${nowSec()}s`); if(activePower && Date.now() < activePower.until){ const rem = Math.ceil((activePower.until - Date.now())/1000); powerupBox && (powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`); } else if(powerupBox) powerupBox.innerHTML = ''; if(activePower && Date.now() >= activePower.until) activePower = null; }
function showNotif(text){ if(!notifArea) return; const el = document.createElement('div'); el.className='notif'; el.textContent = text; notifArea.appendChild(el); setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); },1400); }

/* ---------------- MAIN LOOP ---------------- */
function animate(now){
  if(!running) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + (SETTINGS.difficulty-1)*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){ spawnClone(); if(Math.random() < 0.02 + (SETTINGS.difficulty-1)*0.03) spawnClone(); if(cloneInterval > 30) cloneInterval = Math.max(30, cloneInterval - 1 - (SETTINGS.difficulty-1)); }

  for(let i=clones.length-1;i>=0;i--){ const c=clones[i]; c.update(); if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){ if(!(activePower && activePower.type==='cloak' && Date.now() < activePower.until)){ running = false; if(SETTINGS.sfx && SFX.death) safePlay(SFX.death); showNotif("YOU DIED"); restartBtn && (restartBtn.style.display = "inline-block"); setTimeout(()=>resetGame(),900); return; } } }

  updateParticles();

  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawMaze(); drawPowerups(); drawPortal(); for(const c of clones) c.draw();

  const speed = 12 + (SETTINGS.difficulty-1)*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  for(let i=Math.max(0,movesHistory.length-30); i<movesHistory.length; i++){ const m = movesHistory[i]; const alpha = (i - Math.max(0,movesHistory.length-30))/30; ctx.globalAlpha = 0.05 + alpha*0.25; ctx.fillStyle = '#33ff77'; ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44); }
  ctx.globalAlpha = 1;

  if(IMG.ninja){ try{ const info = SPRITE_INFO.ninja; const colsFrames = Math.max(1, Math.floor(IMG.ninja.naturalWidth / info.frameW)); const animCol = Math.floor((frameCount/6) % colsFrames); const animRow = 0; ctx.drawImage(IMG.ninja, animCol*info.frameW, animRow*info.frameH, info.frameW, info.frameH, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize); } catch(e){ ctx.drawImage(IMG.ninja, player.rx*tileSize, player.ry*tileSize, tileSize, tileSize); } } else { const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2; ctx.save(); const pulse = 0.9 + Math.sin(Date.now()/420)*0.08; ctx.shadowBlur = 18*pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)'; ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  drawParticles(); drawMiniMap(); updateHUD();

  requestAnimationFrame(animate);
}

/* ---------------- LEVEL TRANSITION (GD-style) ---------------- */
function transitionToNextLevel(){
  running = false; let t=0, dur=26;
  function step(){ ctx.save(); const s = 1 + 0.06 * Math.sin(Math.PI*(t/dur)); const cx=(cols*tileSize)/2; ctx.setTransform(s,0,0,s, - (s-1)*cx, - (s-1)*cx); drawMaze(); drawPortal(); for(const c of clones) c.draw(); ctx.restore(); ctx.fillStyle = `rgba(255,255,255,${t/dur * 0.96})`; ctx.fillRect(0,0,cols*tileSize, rows*tileSize); t++; if(t<=dur) requestAnimationFrame(step); else { resetGame(); running=true; lastFrame = performance.now(); requestAnimationFrame(animate); } } step();
}

/* ---------------- TICK LOOP FOR HELD KEYS ---------------- */
let lastTick = 0;
function tickLoop(){ if(!running) return; const now=performance.now(); if(now - lastTick > 120){ if(activeDirs.up || activeDirs.down || activeDirs.left || activeDirs.right) stepPlayer(); lastTick = now; } requestAnimationFrame(tickLoop); }

/* ---------------- UI BINDINGS ---------------- */
startBtn?.addEventListener('click',()=>{
  if(SFX.bg && SETTINGS.music) try{ SFX.bg.play().catch(()=>{}); }catch(e){}
  resetGame(); lastFrame = performance.now(); running = true; requestAnimationFrame(animate);
});
restartBtn?.addEventListener('click', ()=>{ resetGame(); if(SFX.bg && SETTINGS.music) safePlay(SFX.bg); lastFrame = performance.now(); requestAnimationFrame(animate); restartBtn.style.display = "none"; });
menuBtn?.addEventListener('click', ()=>{ running = false; });
settingsBtn?.addEventListener('click', ()=> alert("Settings are in the top-right (demo)."));
tutorialBtn?.addEventListener('click', ()=> alert("Use arrow keys or WASD to move. Collect powerups. Avoid clones."));

/* ---------------- BOOT & TEST PREVIEW ---------------- */
async function boot(){
  resizeCanvas();
  await preloadAll();
  resetGame();
  // static preview so you know assets exist
  previewAssets();
}
function previewAssets(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#050505'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const cx = canvas.width/2, cy = canvas.height/2;
  // ninja frame
  if(IMG.ninja){ const info = SPRITE_INFO.ninja; ctx.drawImage(IMG.ninja, 0, 0, info.frameW, info.frameH, cx-220, cy - Math.round(tileSize/2), tileSize, tileSize); }
  else ctx.fillStyle='#66ff99', ctx.fillRect(cx-220, cy - Math.round(tileSize/2), tileSize, tileSize);
  // clone
  if(IMG.clone){ const info = SPRITE_INFO.clone; ctx.drawImage(IMG.clone, 0, 0, info.frameW, info.frameH, cx-32, cy - Math.round(tileSize/2), tileSize, tileSize); }
  else ctx.fillStyle='#ff6666', ctx.fillRect(cx-32, cy - Math.round(tileSize/2), tileSize, tileSize);
  // portal
  if(IMG.portal){ const info=SPRITE_INFO.portal; ctx.drawImage(IMG.portal, 0, 0, info.frameW, info.frameH, cx+160, cy - Math.round(tileSize/2), tileSize, tileSize); }
  else ctx.fillStyle='#66ccff', ctx.fillRect(cx+160, cy - Math.round(tileSize/2), tileSize, tileSize);
}

/* ---------------- notif & debug helpers ---------------- */
function showNotif(text){ if(!notifArea) return; const el = document.createElement('div'); el.className='notif'; el.textContent=text; notifArea.appendChild(el); setTimeout(()=>{ el.style.transition='opacity .45s, transform .45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),480); },1200); }

/* ---------------- start boot ---------------- */
boot();

/* Expose for debug in console */
window.__SHADOWCLONE = { IMG, SFX, resetGame, spawnPowerup, spawnClone };
