/* Shadow Clone Escape — Ninja (script.js)
   - Replace the previous script.js with this file
   - Requires the assets listed below in /assets/
   Assets needed (place into assets/ folder):
     ninja.png (player sprite, ideally 1 frame or small sheet),
     clone.png (shadow-clone sprite),
     portal.png (portal icon),
     bg_music.mp3, spawn.wav, powerup.wav, portal.wav, death.wav
*/

/* -------------------- DOM -------------------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniMap = document.getElementById('miniMap');
const startBtn = document.getElementById('startBtn');
const startBtnOverlay = document.getElementById('startBtnOverlay');
const tutorialBtn = document.getElementById('tutorialBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtnHeader = document.getElementById('menuBtnHeader');
const menuOverlay = document.getElementById('menuOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const goMenuBtn = document.getElementById('goMenuBtn');

const statusText = document.getElementById('status');
const timerText = document.getElementById('timer');
const powerupBox = document.getElementById('powerupBox');
const levelBox = document.getElementById('levelBox');
const notifArea = document.getElementById('notifArea');
const titleOverlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const mobileControls = document.getElementById('mobileControls');
const dpad = document.getElementById('dpad');
const btnPower = document.getElementById('btnPower');

const bgMusic = document.getElementById('bgMusic');
const sfxSpawn = document.getElementById('sfxSpawn');
const sfxPickup = document.getElementById('sfxPickup');
const sfxPortal = document.getElementById('sfxPortal');
const sfxDeath = document.getElementById('sfxDeath');

/* -------------------- canvas sizing & grid -------------------- */
let tileSize = 32;
function fitCanvas(){
  const maxW = Math.min(window.innerWidth - 40, 980);
  const maxH = Math.min(window.innerHeight - 160, 760);
  const width = Math.min(maxW, maxH);
  canvas.style.width = width + 'px';
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor((width * 0.9) * ratio);
  // logical pixels for game grid
  const gw = Math.floor(canvas.width / ratio);
  const gh = Math.floor(canvas.height / ratio);
  cols = Math.max(11, Math.floor(gw / tileSize));
  rows = Math.max(11, Math.floor(gh / tileSize));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(gw / cols, gh / rows));
  ctx.setTransform(ratio,0,0,ratio,0,0);
  // miniMap update pixel transform
  miniMap.width = 280 * (window.devicePixelRatio || 1);
  miniMap.height = 160 * (window.devicePixelRatio || 1);
  miniMap.style.width = '140px';
  miniMap.style.height = '80px';
  miniCtx.setTransform(window.devicePixelRatio || 1,0,0,window.devicePixelRatio || 1,0,0);
}
const miniCtx = miniMap.getContext('2d');
window.addEventListener('resize', ()=>{ fitCanvas(); cacheMaze(); });

/* -------------------- state -------------------- */
let cols = 19, rows = 19;
let maze = [];
let player = null;
let movesHistory = [];
let clones = [];
let powerups = [];
let particles = [];
let messages = [];
let frameCount = 0;
let running = false;
let startTime = 0;
let LEVEL = 1;
let PORTAL = null;
const CLONE_LIFESPAN = 60 * 40; // frames (~40s)
let cloneInterval = 300; // frames between spawns (adjusted per level)

/* -------------------- assets (images) -------------------- */
const IMG = {
  ninja: new Image(),
  clone: new Image(),
  portal: new Image()
};
IMG.ninja.src = 'assets/ninja.png';
IMG.clone.src = 'assets/clone.png';
IMG.portal.src = 'assets/portal.png';

/* preload audio volumes */
bgMusic.volume = 0.45;
sfxSpawn.volume = 0.9;
sfxPickup.volume = 0.9;
sfxPortal.volume = 0.9;
sfxDeath.volume = 0.9;

/* -------------------- utilities -------------------- */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now() - startTime)/1000); }
function addMessage(text,x,y,color='#fff'){
  messages.push({text,x,y,alpha:1,color,vy:-0.3});
}

/* -------------------- maze generation (recursive backtracker) -------------------- */
function generateMaze(){
  maze = Array.from({length:rows}, ()=> Array(cols).fill(1));
  function carve(cx,cy){
    maze[cy][cx] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for(const [dx,dy] of dirs){
      const nx = cx + dx, ny = cy + dy;
      if(nx>0 && ny>0 && nx<cols-1 && ny<rows-1 && maze[ny][nx]===1){
        maze[cy + dy/2][cx + dx/2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1,1);
  // safe zone
  maze[1][1]=0; if(maze[1][2]!==undefined) maze[1][2]=0; if(maze[2]) maze[2][1]=0;
}

/* -------------------- cached maze drawing (offscreen) -------------------- */
let mazeCache = null;
function cacheMaze(){
  // draw maze once into offscreen canvas to optimize per-frame paints
  if(!cols || !rows) return;
  mazeCache = document.createElement('canvas');
  mazeCache.width = cols * tileSize;
  mazeCache.height = rows * tileSize;
  const mctx = mazeCache.getContext('2d');
  mctx.fillStyle = '#0f0f0f';
  mctx.fillRect(0,0,mazeCache.width,mazeCache.height);
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
        mctx.fillStyle = '#222';
        mctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

/* -------------------- player, clones, powerups -------------------- */
function resetLevelState(){
  movesHistory = [];
  clones = [];
  powerups = [];
  particles = [];
  messages = [];
}

function resetGame(){
  generateMaze();
  fitCanvas();
  cacheMaze();
  player = { x:1, y:1, rx:1, ry:1, radius: tileSize*0.42, power:null };
  resetLevelState();
  cloneInterval = Math.max(120, 300 - (LEVEL-1)*30);
  startTime = Date.now();
  frameCount = 0;
  spawnPortal();
  levelBox.textContent = `Level: ${LEVEL}`;
  updateHUD();
}

/* -------------------- PORTAL -------------------- */
function spawnPortal(){
  PORTAL = null;
  // choose farthest walkable tile from start (simple scan for now)
  let best = null; let bestDist = -1;
  for(let y=rows-2;y>=1;y--){
    for(let x=cols-2;x>=1;x--){
      if(maze[y][x]===0 && !(x===player.x && y===player.y)){
        const d = Math.abs(x-1)+Math.abs(y-1);
        if(d>bestDist){ bestDist = d; best = {x,y}; }
      }
    }
  }
  PORTAL = best;
}

/* -------------------- powerups -------------------- */
const POWER_TYPES = ['speed','cloak','shock'];
function spawnPowerup(){
  let attempts = 0;
  while(attempts++ < 200){
    const x = randInt(1, cols-2), y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      const type = POWER_TYPES[randInt(0, POWER_TYPES.length-1)];
      powerups.push({x,y,type,spawned:Date.now(),bob:Math.random()*Math.PI*2});
      return;
    }
  }
}
function applyPowerup(type){
  if(type === 'speed'){
    player.power = { type:'speed', until: Date.now() + 4000 };
    showNotif('SPEED BOOST!', '#ffd86b');
  } else if(type === 'cloak'){
    player.power = { type:'cloak', until: Date.now() + 5000 };
    showNotif('CLOAK!', '#7af');
  } else if(type === 'shock'){
    // knockback clones: push their index back (if path-based) or random offset
    clones.forEach(c => {
      if(c.index !== undefined) c.index = Math.max(0, c.index - 40);
      c.x += randInt(-1,1);
      c.y += randInt(-1,1);
    });
    showNotif('SHOCKWAVE!', '#9be7b0');
  }
  if(sfxPickup) try{ sfxPickup.currentTime = 0; sfxPickup.play(); }catch(e){}
}

/* -------------------- movement & input -------------------- */
let activeDirs = {up:false,down:false,left:false,right:false};
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', e => {
  if(!running) return;
  if(e.key==='ArrowUp'||e.key==='w'){ activeDirs.up=true; attemptStep(); }
  if(e.key==='ArrowDown'||e.key==='s'){ activeDirs.down=true; attemptStep(); }
  if(e.key==='ArrowLeft'||e.key==='a'){ activeDirs.left=true; attemptStep(); }
  if(e.key==='ArrowRight'||e.key==='d'){ activeDirs.right=true; attemptStep(); }
});
document.addEventListener('keyup', e => {
  if(e.key==='ArrowUp'||e.key==='w') activeDirs.up=false;
  if(e.key==='ArrowDown'||e.key==='s') activeDirs.down=false;
  if(e.key==='ArrowLeft'||e.key==='a') activeDirs.left=false;
  if(e.key==='ArrowRight'||e.key==='d') activeDirs.right=false;
});
/* mobile dpad */
dpad?.addEventListener('pointerdown', ev => {
  const b = ev.target.closest('button[data-dir]');
  if(b){ pressDir(b.dataset.dir); b.setPointerCapture(ev.pointerId); }
});
dpad?.addEventListener('pointerup', ev => {
  const b = ev.target.closest('button[data-dir]');
  if(b) releaseDir(b.dataset.dir);
});
function pressDir(dir){ activeDirs[dir]=true; attemptStep(); }
function releaseDir(dir){ activeDirs[dir]=false; }

function attemptStep(){
  const now = performance.now();
  const speedFactor = (player.power && player.power.type==='speed' && Date.now() < player.power.until) ? 0.55 : 1;
  const ms = Math.max(50, Math.floor(stepMsBase * speedFactor));
  if(now - lastStepTime < ms) return;
  lastStepTime = now;
  let nx = player.x, ny = player.y;
  if(activeDirs.up) ny--;
  else if(activeDirs.down) ny++;
  else if(activeDirs.left) nx--;
  else if(activeDirs.right) nx++;
  if(nx>=0 && nx<cols && ny>=0 && ny<rows && maze[ny][nx] === 0){
    player.x = nx; player.y = ny;
    movesHistory.push({x:nx,y:ny});
    // check for powerup pickup
    for(let i=powerups.length-1;i>=0;i--){
      if(powerups[i].x===nx && powerups[i].y===ny){
        applyPowerup(powerups[i].type);
        powerups.splice(i,1);
        break;
      }
    }
  }
}

/* -------------------- clones -------------------- */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.spawnFrame = frameCount;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
    this.color = type==='wraith' ? '#bb66ff' : (type==='fast' ? '#ff9666' : '#ff6666');
  }
  update(){
    this.index++;
    if(this.index < this.path.length){
      this.x = this.path[this.index].x;
      this.y = this.path[this.index].y;
    }
  }
  draw(ctx){
    ctx.globalAlpha = 0.75;
    ctx.drawImage(IMG.clone, this.x * tileSize, this.y * tileSize, tileSize, tileSize);
    ctx.globalAlpha = 1;
  }
}

/* spawn clone based on recent path */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random();
  let type = 'basic';
  if(p < 0.08) type = 'wraith';
  else if(p < 0.22) type = 'fast';
  const c = new Clone(snap, type);
  c.spawnFrame = frameCount;
  clones.push(c);
  // audio + particles
  try{ sfxSpawn.currentTime = 0; sfxSpawn.play(); }catch(e){}
  spawnParticles((c.x||player.x)*tileSize + tileSize/2, (c.y||player.y)*tileSize + tileSize/2, '#ff4466');
  showNotif(`${type.toUpperCase()} CLONE!`, '#ffa500');
}

/* -------------------- particles -------------------- */
function spawnParticles(px,py,color){
  for(let i=0;i<18;i++){
    particles.push({
      x:px + (Math.random()-0.5)*tileSize,
      y:py + (Math.random()-0.5)*tileSize,
      vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3,
      life:20 + Math.random()*30, color
    });
  }
}
function updateParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05;
    p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
}
function drawParticles(ctx){
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life/50);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/* -------------------- messages (floating notifications) -------------------- */
function showNotif(text,color='#fff'){
  const el = document.createElement('div');
  el.className = 'notif';
  el.style.background = 'linear-gradient(90deg,#161616,#0f0f0f)';
  el.style.color = color;
  el.innerText = text;
  notifArea.appendChild(el);
  // fade out + remove
  setTimeout(()=>{ el.style.transition='transform 0.45s ease, opacity 0.45s'; el.style.opacity='0'; el.style.transform='translateY(-18px)'; setTimeout(()=>el.remove(),460); }, 1400);
}

/* -------------------- HUD update -------------------- */
function updateHUD(){
  timerText.textContent = `Time: ${nowSec()}s`;
  levelBox.textContent = `Level: ${LEVEL}`;
  // show active power in powerupBox
  if(player.power && Date.now() < player.power.until){
    const rem = Math.ceil((player.power.until - Date.now()) / 1000);
    powerupBox.innerHTML = `<b>${player.power.type.toUpperCase()}</b> ${rem}s`;
  } else {
    powerupBox.innerHTML = '';
    player.power = null;
  }
}

/* -------------------- draw helpers -------------------- */
function drawMaze(){
  if(mazeCache) ctx.drawImage(mazeCache, 0, 0);
  else {
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        if(maze[y][x] === 1){
          ctx.fillStyle = '#222';
          ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        }
      }
    }
  }
}
function drawPortal(){
  if(!PORTAL) return;
  const cx = PORTAL.x * tileSize + tileSize/2;
  const cy = PORTAL.y * tileSize + tileSize/2;
  const pulse = 1 + Math.sin(frameCount / 8) * 0.08;
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.fillStyle = '#66ccff';
  ctx.arc(cx, cy, tileSize * 0.8 * pulse, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.drawImage(IMG.portal, PORTAL.x*tileSize, PORTAL.y*tileSize, tileSize, tileSize);
  ctx.restore();
}
function drawPowerups(){
  for(const p of powerups){
    const bob = Math.sin((frameCount + p.bob*60)/18) * 3;
    const px = p.x*tileSize + tileSize/2, py = p.y*tileSize + tileSize/2 + bob;
    ctx.save();
    if(p.type==='speed'){ ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.arc(px,py,tileSize*0.22,0,Math.PI*2); ctx.fill(); }
    else if(p.type==='cloak'){ ctx.fillStyle = '#7af'; ctx.fillRect(px - tileSize*0.22, py - tileSize*0.22, tileSize*0.44, tileSize*0.44); }
    else { ctx.fillStyle = '#9be7b0'; ctx.beginPath(); ctx.moveTo(px,py-tileSize*0.22); ctx.lineTo(px+tileSize*0.16,py); ctx.lineTo(px-tileSize*0.16,py); ctx.fill(); }
    ctx.restore();
  }
}
function drawMiniMap(){
  const mmW = miniMap.width / (window.devicePixelRatio || 1);
  const mmH = miniMap.height / (window.devicePixelRatio || 1);
  miniCtx.clearRect(0,0,mmW,mmH);
  const cw = mmW / cols, ch = mmH / rows;
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      miniCtx.fillStyle = maze[y][x] === 1 ? '#222' : '#070707';
      miniCtx.fillRect(x*cw, y*ch, cw, ch);
    }
  }
  miniCtx.fillStyle = '#66ff99';
  miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const c of clones){
    miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
    miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  }
  for(const pu of powerups){
    miniCtx.fillStyle = pu.type==='speed' ? '#ffd86b' : pu.type==='cloak' ? '#7af' : '#9be7b0';
    miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
  }
}

/* -------------------- transition animation (Geometry Dash style) -------------------- */
function transitionToNextLevel(){
  running = false;
  // quick white flash + zoom-in effect
  let t = 0;
  const dur = 24; // frames
  function anim(){
    ctx.save();
    // scale center zoom effect
    const s = 1 + 0.05 * Math.sin(Math.PI * (t / dur));
    const cx = (cols*tileSize)/2, cy = (rows*tileSize)/2;
    ctx.setTransform(s,0,0,s, - (s-1)*cx, - (s-1)*cy);
    drawMaze(); drawPortal(); for(const c of clones) c.draw(ctx); // visual before-full
    ctx.restore();
    // overlay white flash builds
    ctx.fillStyle = `rgba(255,255,255,${t/dur * 0.95})`;
    ctx.fillRect(0,0,cols*tileSize, rows*tileSize);
    t++;
    if(t <= dur) requestAnimationFrame(anim);
    else {
      LEVEL++; resetGame(); // resets maze and state and spawns portal
      running = true;
      requestAnimationFrame(loop);
    }
  }
  anim();
}

/* -------------------- main loop -------------------- */
let lastFrame = performance.now();
function animate(now){
  if(!running) return;
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;
  frameCount++;

  // powerups spawn occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing (ramp with level)
  const intervalFrames = Math.max(10, Math.floor(cloneInterval / (1 + (LEVEL-1)*0.25)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneInterval > 30) cloneInterval -= 1; // gentle ramp
    if(Math.random() < 0.02 + (LEVEL-1)*0.01) spawnClone();
  }

  // cleanup clones by lifespan
  clones = clones.filter(c => (frameCount - (c.spawnFrame || 0)) < CLONE_LIFESPAN);

  // update clones & collisions
  for(const c of clones){
    c.update();
    if(c.x === player.x && c.y === player.y){
      // if cloak active, ignore
      if(!(player.power && player.power.type === 'cloak' && Date.now() < player.power.until)){
        // death sequence
        running = false;
        try{ sfxDeath.currentTime = 0; sfxDeath.play(); }catch(e){}
        showNotif('YOU DIED', '#ff6666');
        setTimeout(() => { LEVEL = 1; resetGame(); running = true; requestAnimationFrame(loop); }, 900);
        return;
      }
    }
  }

  // portal reached?
  if(PORTAL && player.x === PORTAL.x && player.y === PORTAL.y){
    try{ sfxPortal.currentTime = 0; sfxPortal.play(); }catch(e){}
    transitionToNextLevel();
    return;
  }

  updateParticles();
  // render
  ctx.clearRect(0,0, cols*tileSize, rows*tileSize);
  drawMaze();
  drawPowerups();
  drawPortal();
  // draw clones
  for(const c of clones) c.draw(ctx);
  // draw trail
  const trailStart = Math.max(0, movesHistory.length - 28);
  for(let i = trailStart; i < movesHistory.length; i++){
    const m = movesHistory[i];
    const alpha = (i - trailStart)/28;
    ctx.globalAlpha = 0.06 + alpha * 0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // draw player (ninja sprite) with cloak overlay if active
  const px = player.x * tileSize, py = player.y * tileSize;
  if(player.power && player.power.type === 'cloak' && Date.now() < player.power.until){
    ctx.globalAlpha = 0.45;
    ctx.drawImage(IMG.ninja, px, py, tileSize, tileSize);
    ctx.globalAlpha = 1;
  } else {
    ctx.drawImage(IMG.ninja, px, py, tileSize, tileSize);
  }

  // particles + messages + minimap
  drawParticles(ctx);
  // messages: simple canvas-floating ones
  for(let i = messages.length-1; i>=0; i--){
    const m = messages[i];
    m.y += m.vy;
    m.alpha -= 0.009;
    if(m.alpha <= 0) messages.splice(i,1);
    else {
      ctx.globalAlpha = m.alpha;
      ctx.fillStyle = m.color;
      ctx.font = '16px Inter, Arial';
      ctx.fillText(m.text, m.x, m.y);
      ctx.globalAlpha = 1;
    }
  }
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}
function loop(ts){ lastFrame = ts; requestAnimationFrame(animate); }

/* -------------------- helper UI & flow -------------------- */
function showMenu(){
  menuOverlay.classList.remove('hidden');
}
function hideMenu(){
  menuOverlay.classList.add('hidden');
}

/* -------------------- spawn clone helper (added audio + notif) -------------------- */
function spawnClone(){
  if(movesHistory.length < 6) return;
  const len = Math.min(900, movesHistory.length);
  const snap = movesHistory.slice(Math.max(0, movesHistory.length - len));
  const p = Math.random();
  let type = 'basic';
  if(p < 0.08) type = 'wraith';
  else if(p < 0.22) type = 'fast';
  const c = new Clone(snap, type);
  c.spawnFrame = frameCount;
  clones.push(c);
  try{ sfxSpawn.currentTime=0; sfxSpawn.play(); }catch(e){}
  spawnParticles((c.x||player.x)*tileSize + tileSize/2, (c.y||player.y)*tileSize + tileSize/2, '#ff4466');
  showNotif(`${type.toUpperCase()} CLONE!`, '#ffa500');
}

/* -------------------- event binding -------------------- */
startBtn.addEventListener('click', ()=>startRun());
startBtnOverlay.addEventListener('click', ()=>startRun());
restartBtn.addEventListener('click', ()=>{ LEVEL = 1; resetGame(); if(!running){ running=true; requestAnimationFrame(loop);} });
menuBtnHeader.addEventListener('click', ()=>{ showMenu(); });
resumeBtn?.addEventListener('click', ()=>{ hideMenu(); });
goMenuBtn?.addEventListener('click', ()=>{ hideMenu(); titleOverlay.style.display = 'flex'; hud.classList.add('panel-hidden'); running = false; });

btnPower?.addEventListener('click', ()=>{ applyPowerup('shock'); });

/* -------------------- initial boot & pre-calc -------------------- */
fitCanvas();
generateMaze();
cacheMaze();
resetGame();
titleOverlay.style.display = 'flex';
hud.classList.add('panel-hidden');

// start runner
function startRun(){
  LEVEL = 1;
  titleOverlay.style.display = 'none';
  hud.classList.remove('panel-hidden');
  resetGame();
  try{ bgMusic.currentTime = 0; bgMusic.play(); }catch(e){}
  running = true;
  requestAnimationFrame(loop);
}

/* -------------------- initial mobile controls mapping (touch) -------------------- */
window.addEventListener('touchstart', e => {
  if(e.touches.length === 1 && window.innerWidth <= 720) mobileControls.classList.remove('hidden');
});

/* -------------------- debug/testing helpers (optional) -------------------- */
window.__GAME = { resetGame, spawnPowerup, spawnClone };

/* -------------------- Done -------------------- */
