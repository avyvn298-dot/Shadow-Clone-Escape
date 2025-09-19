/* Shadow Clone Escape — Polished v2
   Copy these 3 files into your repo root and enable GitHub Pages.
   Notes:
   - Audio will play only after Start (autoplay rules).
   - Replace audio <source> URLs in index.html with local files in repo if desired.
*/

/* -------------------- DOM elements -------------------- */
const gameCanvas = document.getElementById('gameCanvas');
const miniMap = document.getElementById('miniMap');
const ctx = gameCanvas.getContext('2d');
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
const musicToggleEl = document.getElementById('musicToggle');
const sfxToggleEl = document.getElementById('sfxToggle');
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

const titleOverlay = document.getElementById('titleOverlay');
const titleCardStart = document.getElementById('startBtnOverlay');

/* -------------------- audio elements -------------------- */
const bgMusic = document.getElementById('bgMusic');
const ambientSfx = document.getElementById('ambientSfx');
const footstep = document.getElementById('footstep');
const spawnSfx = document.getElementById('spawnSfx');
const pickupSfx = document.getElementById('pickupSfx');
const shockSfx = document.getElementById('shockSfx');
const deathSfx = document.getElementById('deathSfx');
const newRecordSfx = document.getElementById('newRecordSfx');

/* -------------------- canvas sizing & grid -------------------- */
function resizeCanvas() {
  const maxW = Math.min(window.innerWidth - 40, 980);
  const maxH = Math.min(window.innerHeight - 160, 720);
  const width = Math.min(maxW, maxH * (4/3));
  gameCanvas.style.width = width + 'px';
  const ratio = window.devicePixelRatio || 1;
  const logicalW = Math.floor(width);
  const logicalH = Math.floor(logicalW * (3/4));
  gameCanvas.width = Math.floor(logicalW * ratio);
  gameCanvas.height = Math.floor(logicalH * ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);

  miniMap.width = 280 * (window.devicePixelRatio || 1);
  miniMap.height = 180 * (window.devicePixelRatio || 1);
  miniMap.style.width = '140px';
  miniMap.style.height = '90px';
  miniCtx.setTransform(window.devicePixelRatio || 1,0,0,window.devicePixelRatio || 1,0,0);

  recomputeGrid();
}
window.addEventListener('resize', resizeCanvas);

/* grid parameters */
let tileSize = 30, cols = 19, rows = 19;
function recomputeGrid(){
  const cssW = gameCanvas.clientWidth || 600;
  const cssH = gameCanvas.clientHeight || 600;
  const preferred = window.innerWidth < 720 ? 26 : 30;
  cols = Math.max(11, Math.floor(cssW / preferred));
  rows = Math.max(11, Math.floor(cssH / preferred));
  if(cols % 2 === 0) cols--;
  if(rows % 2 === 0) rows--;
  tileSize = Math.floor(Math.min(cssW / cols, cssH / rows));
}

/* -------------------- storage keys -------------------- */
const STORAGE_KEY = 'shadow_clone_best';
const LEADER_KEY = 'shadow_clone_leaderboard';
const SETTINGS_KEY = 'shadow_clone_settings';

/* -------------------- state -------------------- */
let maze = [];
let player, clones = [], movesHistory = [], powerups = [], particlesArr = [];
let frameCount = 0, cloneInterval = 300, running = false, startTime = 0;
let SETTINGS = { music:true, sfx:true, difficulty:1 };
let bestTime = 0;

/* -------------------- utilities -------------------- */
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function nowSec(){ return Math.floor((Date.now() - startTime)/1000); }

/* -------------------- maze generator (recursive backtracker) -------------------- */
function generateMaze(c, r){
  const grid = Array.from({length:r}, ()=> Array(c).fill(1));
  function carve(x,y){
    grid[y][x]=0;
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
  // safe zone near start
  grid[1][1]=0; if(grid[1][2]!==undefined) grid[1][2]=0; if(grid[2]) grid[2][1]=0;
  return grid;
}

/* -------------------- settings & reset -------------------- */
function loadSettings(){
  try{ const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); if(s) SETTINGS = {...SETTINGS,...s}; }catch(e){}
  if(musicToggleEl) musicToggleEl.checked = SETTINGS.music;
  if(sfxToggleEl) sfxToggleEl.checked = SETTINGS.sfx;
  if(difficultyEl) difficultyEl.value = SETTINGS.difficulty;
}
function saveSettings(){ if(musicToggleEl) SETTINGS.music = musicToggleEl.checked; if(sfxToggleEl) SETTINGS.sfx = sfxToggleEl.checked; if(difficultyEl) SETTINGS.difficulty = Number(difficultyEl.value); localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); }

function resetGame(){
  saveSettings();
  resizeCanvas(); recomputeGrid();
  maze = generateMaze(cols, rows);
  player = { x:1, y:1, rx:1, ry:1, radius: Math.max(6, tileSize*0.36), color:'lime' };
  movesHistory = [];
  clones = [];
  powerups = [];
  particlesArr = [];
  frameCount = 0;
  cloneInterval = 300 - SETTINGS.difficulty * 80;
  if(cloneInterval < 50) cloneInterval = 50;
  running = true;
  startTime = Date.now();
  bestTime = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  bestRecordText.textContent = bestTime ? `Best: ${bestTime}s` : 'Best: —';
  statusText.textContent = 'Survive as long as you can';
  timerText.textContent = 'Time: 0s';
  restartBtn.style.display = 'none';
  menuBtn.style.display = 'none';
}

/* -------------------- power-ups -------------------- */
const POWER_TYPES = ['speed','cloak','shock'];
let activePower = null;
function spawnPowerup(){
  let attempts = 0;
  while(attempts++ < 200){
    const x = randInt(1, cols-2);
    const y = randInt(1, rows-2);
    if(maze[y][x] === 0 && !(x===player.x && y===player.y) && !powerups.some(p=>p.x===x&&p.y===y)){
      powerups.push({x,y,type:POWER_TYPES[randInt(0, POWER_TYPES.length-1)], spawned:Date.now()});
      break;
    }
  }
}
function applyPowerup(type){
  if(type==='speed'){
    activePower = { type:'speed', until: Date.now() + 4500 };
  } else if(type==='cloak'){
    activePower = { type:'cloak', until: Date.now() + 5000 };
  } else if(type==='shock'){
    // knock back nearby clones by decreasing their index
    const radius = 5;
    clones.forEach(c=>{
      const dx = Math.abs(c.x - player.x), dy = Math.abs(c.y - player.y);
      if(dx + dy <= radius) c.index = Math.max(0, c.index - 28);
    });
    if(SETTINGS.sfx) try{ shockSfx.currentTime = 0; shockSfx.play(); }catch(e){}
  }
  if(SETTINGS.sfx) try{ pickupSfx.currentTime = 0; pickupSfx.play(); }catch(e){}
}

/* -------------------- clones -------------------- */
class Clone {
  constructor(path, type='basic'){
    this.path = path.slice();
    this.index = 0;
    this.type = type;
    this.x = this.path[0]?.x ?? 1;
    this.y = this.path[0]?.y ?? 1;
    this.spawnFrame = frameCount;
    this.frozen = false;
    this.color = type==='wraith' ? 'magenta' : (type==='fast' ? 'orange' : 'crimson');
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
  draw(ctx){
    const age = frameCount - this.spawnFrame;
    const alpha = Math.max(0.35, Math.min(1, 0.6 + Math.sin(age/10) * 0.2));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x * tileSize + 1, this.y * tileSize + 1, tileSize-2, tileSize-2);
    ctx.globalAlpha = 1;
  }
}

/* -------------------- particles -------------------- */
function spawnParticles(px,py,color){
  for(let i=0;i<22;i++){
    particlesArr.push({
      x:px + (Math.random()-0.5)*tileSize,
      y:py + (Math.random()-0.5)*tileSize,
      vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:30 + Math.random()*40, color
    });
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
  for(const p of particlesArr){
    ctx.globalAlpha = Math.max(0, p.life/70);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3,3);
  }
  ctx.globalAlpha = 1;
}

/* -------------------- input & stepping -------------------- */
let activeDirs = { up:false, down:false, left:false, right:false };
let lastStepTime = 0;
let stepMsBase = 140;

document.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(e.key==='ArrowUp' || e.key==='w'){ activeDirs.up = true; stepPlayer(); playFootstep(); }
  if(e.key==='ArrowDown' || e.key==='s'){ activeDirs.down = true; stepPlayer(); playFootstep(); }
  if(e.key==='ArrowLeft' || e.key==='a'){ activeDirs.left = true; stepPlayer(); playFootstep(); }
  if(e.key==='ArrowRight' || e.key==='d'){ activeDirs.right = true; stepPlayer(); playFootstep(); }
});
document.addEventListener('keyup', (e)=>{
  if(e.key==='ArrowUp' || e.key==='w') activeDirs.up = false;
  if(e.key==='ArrowDown' || e.key==='s') activeDirs.down = false;
  if(e.key==='ArrowLeft' || e.key==='a') activeDirs.left = false;
  if(e.key==='ArrowRight' || e.key==='d') activeDirs.right = false;
});

function playFootstep(){ if(SETTINGS.sfx) try{ footstep.currentTime = 0; footstep.play(); }catch(e){} }

function stepPlayer(){
  const now = performance.now();
  const speedFactor = (activePower && activePower.type==='speed' && Date.now() < activePower.until) ? 0.55 : 1;
  const ms = Math.max(60, Math.floor(stepMsBase * speedFactor - SETTINGS.difficulty*10));
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
    // pickup
    for(let i=powerups.length-1;i>=0;i--){
      if(powerups[i].x===nx && powerups[i].y===ny){
        applyPowerup(powerups[i].type);
        powerups.splice(i,1);
      }
    }
  }
}

/* mobile dpad */
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

/* -------------------- clone spawn -------------------- */
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
  if(SETTINGS.sfx) try{ spawnSfx.currentTime=0; spawnSfx.play(); }catch(e){}
  spawnParticles(c.x*tileSize + tileSize/2, c.y*tileSize + tileSize/2, '#ff4466');
}

/* -------------------- game over & leaderboard -------------------- */
function gameOver(){
  running = false;
  try{ if(SETTINGS.music) { bgMusic.pause(); ambientSfx.pause(); } }catch(e){}
  if(SETTINGS.sfx) try{ deathSfx.currentTime=0; deathSfx.play(); }catch(e){}
  const elapsed = nowSec();
  const prevBest = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  if(elapsed > prevBest){
    localStorage.setItem(STORAGE_KEY, elapsed);
    if(SETTINGS.sfx) try{ newRecordSfx.currentTime=0; newRecordSfx.play(); }catch(e){}
    statusText.textContent = `☠️ You survived ${elapsed}s — NEW RECORD!`;
    addToLeaderboard(elapsed);
  } else {
    statusText.textContent = `☠️ You survived ${elapsed}s (Best: ${prevBest}s)`;
  }
  spawnParticles(player.rx*tileSize + tileSize/2, player.ry*tileSize + tileSize/2, '#ffcc66');
  restartBtn.style.display = 'inline-block';
  menuBtn.style.display = 'inline-block';
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

/* -------------------- draw helpers -------------------- */
function drawMaze(){
  for(let y=0;y<rows;y++){
    for(let x=0;x<cols;x++){
      if(maze[y][x] === 1){
        ctx.fillStyle = '#2e2e2e';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(x*tileSize+1, y*tileSize+1, tileSize-2, tileSize-2);
      } else {
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
      }
    }
  }
}

function drawPowerups(){
  for(const pu of powerups){
    const cx = pu.x*tileSize + tileSize/2, cy = pu.y*tileSize + tileSize/2;
    ctx.save();
    if(pu.type==='speed'){ ctx.fillStyle = '#4fd1ff'; ctx.beginPath(); ctx.arc(cx,cy,tileSize*0.26,0,Math.PI*2); ctx.fill(); }
    else if(pu.type==='cloak'){ ctx.fillStyle = '#9be7b0'; ctx.fillRect(pu.x*tileSize+4, pu.y*tileSize+4, tileSize-8, tileSize-8); }
    else if(pu.type==='shock'){ ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(cx,cy-tileSize*0.22); ctx.lineTo(cx+tileSize*0.16,cy); ctx.lineTo(cx-tileSize*0.16,cy); ctx.fill(); }
    ctx.restore();
  }
}

function drawMiniMap(){
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
    miniCtx.fillStyle = c.type === 'wraith' ? '#ff66ff' : c.type === 'fast' ? '#ffb86b' : '#ff6666';
    miniCtx.fillRect(c.x*cw, c.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  }
  miniCtx.fillStyle = '#66ff99';
  miniCtx.fillRect(player.x*cw, player.y*ch, Math.max(1,cw*0.9), Math.max(1,ch*0.9));
  for(const pu of powerups){
    miniCtx.fillStyle = pu.type==='speed' ? '#4fd1ff' : pu.type==='cloak' ? '#9be7b0' : '#bfe8ff';
    miniCtx.fillRect(pu.x*cw + cw*0.2, pu.y*ch + ch*0.2, cw*0.6, ch*0.6);
  }
}

/* -------------------- HUD & animation -------------------- */
function updateHUD(){
  timerText.textContent = `Time: ${nowSec()}s`;
  if(activePower && Date.now() < activePower.until){
    const rem = Math.ceil((activePower.until - Date.now())/1000);
    powerupBox.innerHTML = `<b>${activePower.type.toUpperCase()}</b> ${rem}s`;
  } else {
    powerupBox.innerHTML = '';
    if(activePower && Date.now() >= activePower.until) activePower = null;
  }
}

/* -------------------- main loop -------------------- */
let lastFrame = performance.now();
function animate(now){
  if(!running) return;
  const dt = (now - lastFrame)/1000; lastFrame = now; frameCount++;

  // spawn powerups occasionally
  if(frameCount % 900 === 0 && Math.random() < 0.88) spawnPowerup();

  // clone spawn pacing
  const intervalFrames = Math.max(8, Math.floor(cloneInterval / (1 + SETTINGS.difficulty*0.6)));
  if(frameCount % intervalFrames === 0 && movesHistory.length > 8){
    spawnClone();
    if(cloneInterval > 30) cloneInterval -= 1 + SETTINGS.difficulty;
    if(Math.random() < 0.02 + SETTINGS.difficulty*0.03) spawnClone();
  }

  // update clones
  for(let i=clones.length-1;i>=0;i--){
    const c = clones[i];
    c.update();
    if(Math.round(c.x) === player.x && Math.round(c.y) === player.y){
      if(!(activePower && activePower.type==='cloak' && Date.now() < activePower.until)){
        gameOver();
        return;
      }
    }
  }

  // particles
  updateParticles();

  // render
  ctx.clearRect(0,0,gameCanvas.width,gameCanvas.height);
  drawMaze();
  drawPowerups();
  for(const c of clones) c.draw(ctx);

  // smooth player rendering (lerp)
  const speed = 12 + SETTINGS.difficulty*6;
  const t = Math.min(1, dt * speed);
  player.rx = player.rx === undefined ? player.x : (player.rx + (player.x - player.rx) * t);
  player.ry = player.ry === undefined ? player.y : (player.ry + (player.y - player.ry) * t);

  // trail
  for(let i=Math.max(0, movesHistory.length-30); i<movesHistory.length; i++){
    const m = movesHistory[i];
    const alpha = (i - Math.max(0, movesHistory.length-30)) / 30;
    ctx.globalAlpha = 0.05 + alpha * 0.25;
    ctx.fillStyle = '#33ff77';
    ctx.fillRect(m.x*tileSize + tileSize*0.28, m.y*tileSize + tileSize*0.28, tileSize*0.44, tileSize*0.44);
  }
  ctx.globalAlpha = 1;

  // player glow pulse (simple)
  const pulse = 0.9 + Math.sin(Date.now()/420) * 0.08;
  ctx.save();
  const px = player.rx*tileSize + tileSize/2, py = player.ry*tileSize + tileSize/2;
  ctx.shadowBlur = 18 * pulse; ctx.shadowColor = 'rgba(50,255,150,0.12)';
  ctx.fillStyle = player.color;
  ctx.beginPath(); ctx.arc(px, py, player.radius, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0; ctx.restore();

  // particles
  drawParticles(ctx);

  // minimap & HUD
  drawMiniMap();
  updateHUD();

  requestAnimationFrame(animate);
}

/* -------------------- UI bindings -------------------- */
function safePlayAudio(audioEl){
  try{ audioEl.currentTime = 0; audioEl.play(); }catch(e){ /* ignore */ }
}

function startRun() {
  saveSettings();
  document.getElementById('menu').style.display = 'none';
  tutorialBox.style.display = 'none';
  settingsBox.style.display = 'none';
  document.getElementById('ui').classList.remove('panel-hidden');
  titleOverlay.style.display = 'none';
  resizeCanvas(); recomputeGrid(); resetGame();
  if(SETTINGS.music){ safePlayAudio(bgMusic); safePlayAudio(ambientSfx); }
  if(window.innerWidth <= 720) mobileControls.classList.remove('hidden');
  lastFrame = performance.now();
  requestAnimationFrame(animate);
}
startBtn.addEventListener('click', startRun);
startBtnOverlay.addEventListener('click', startRun);

tutorialBtn.addEventListener('click', ()=>{ tutorialBox.style.display = tutorialBox.style.display === 'none' ? 'block' : 'none'; });
settingsBtn.addEventListener('click', ()=>{ settingsBox.style.display = settingsBox.style.display === 'none' ? 'block' : 'none'; });

restartBtn.addEventListener('click', ()=>{ resetGame(); if(SETTINGS.music){ safePlayAudio(bgMusic); safePlayAudio(ambientSfx); } lastFrame = performance.now(); requestAnimationFrame(animate); });
menuBtn.addEventListener('click', ()=>{ running = false; document.getElementById('menu').style.display = 'block'; document.getElementById('ui').classList.add('panel-hidden'); mobileControls.classList.add('hidden'); try{ bgMusic.pause(); ambientSfx.pause(); }catch(e){} });
menuBtnHeader.addEventListener('click', ()=>{ document.getElementById('menu').style.display = 'block'; });

musicToggleEl?.addEventListener('change', ()=>{ saveSettings(); if(!musicToggleEl.checked) try{ bgMusic.pause(); ambientSfx.pause(); }catch(e){} });
sfxToggleEl?.addEventListener('change', ()=>{ saveSettings(); });
difficultyEl?.addEventListener('input', ()=>{ saveSettings(); });
clearLeaderboardBtn?.addEventListener('click', ()=>{ if(confirm('Clear local leaderboard?')){ localStorage.removeItem(LEADER_KEY); updateLeaderboardUI(); } });

/* tick loop for holding directions */
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
tickLoop();

/* -------------------- init on load -------------------- */
resizeCanvas(); recomputeGrid(); loadSettings(); updateLeaderboardUI();
