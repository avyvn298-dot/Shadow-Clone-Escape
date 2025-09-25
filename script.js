/* ==========================================================
   SHADOW CLONE ESCAPE - Script v3 (Refactored)
   ----------------------------------------------------------
   Full game logic in one file with structured organization.
   ========================================================== */

/* ---------- CONSTANTS ---------- */
const GRID_SIZE = 20;
const TICK_RATE = 1000 / 60;
const CLONE_INTERVAL = 5000;
const DIFFICULTY_SCALE = 0.995;
const MAX_LEADERBOARD = 5;

const THEMES = {
  light: { bg: "#f5f5f5", fg: "#222", player: "#3a7", clone: "#e33", maze: "#ccc" },
  dark: { bg: "#111", fg: "#eee", player: "#6f6", clone: "#f66", maze: "#444" }
};

/* ---------- GLOBAL STATE ---------- */
let canvas, ctx, minimapCanvas, minimapCtx;
let player, clones = [], particles = [], powerUps = [];
let maze = [], mazeCache = {};
let gameRunning = false, gamePaused = false, gameOver = false;
let score = 0, difficulty = 1, nextCloneTime = 0;
let lastTick = 0;

let theme = localStorage.getItem("sce_theme") || "dark";
let leaderboard = JSON.parse(localStorage.getItem("sce_leaderboard") || "[]");

let joystick = { active: false, x: 0, y: 0 };
let keys = {};

/* ---------- DOM SAFETY INIT ---------- */
function ensureDomElements() {
  canvas = document.getElementById("gameCanvas") || createElement("canvas", { id: "gameCanvas" }, document.body);
  ctx = canvas.getContext("2d");

  minimapCanvas = document.getElementById("minimap") || createElement("canvas", { id: "minimap" }, document.body);
  minimapCtx = minimapCanvas.getContext("2d");

  ["scoreDisplay","highScoreDisplay","leaderboard","pauseMenu","gameOverScreen","settingsMenu"]
    .forEach(id => { if (!document.getElementById(id)) createElement("div",{id},document.body); });
}
function createElement(tag, attrs, parent) {
  const el = document.createElement(tag);
  Object.assign(el, attrs);
  (parent||document.body).appendChild(el);
  return el;
}

/* ---------- UTILS ---------- */
const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const now = () => performance.now();

/* ---------- MAZE GENERATION ---------- */
function generateMaze(w,h){
  const key = `${w}x${h}`;
  if (mazeCache[key]) return mazeCache[key];
  let m = Array.from({length:h},()=>Array(w).fill(1));
  function carve(x,y){
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-0.5);
    m[y][x]=0;
    for(let [dx,dy] of dirs){
      const nx=x+dx*2, ny=y+dy*2;
      if(ny>=0&&ny<h&&nx>=0&&nx<w&&m[ny][nx]===1){
        m[y+dy][x+dx]=0;
        carve(nx,ny);
      }
    }
  }
  carve(1,1);
  mazeCache[key]=m;
  return m;
}

/* ---------- PLAYER & CLONES ---------- */
function resetPlayer(){
  player={x:1,y:1,dir:{x:0,y:0},trail:[]};
  clones=[]; score=0; difficulty=1;
}
function spawnClone(){
  if(!player.trail.length) return;
  clones.push({trail:[...player.trail],idx:0});
}
function movePlayer(){
  const nx=player.x+player.dir.x, ny=player.y+player.dir.y;
  if(maze[ny]&&maze[ny][nx]===0){
    player.x=nx; player.y=ny;
    player.trail.push({x:nx,y:ny});
  }
}
function moveClones(){
  clones.forEach(cl=>{
    if(cl.idx<cl.trail.length){ cl.x=cl.trail[cl.idx].x; cl.y=cl.trail[cl.idx].y; cl.idx++; }
    if(cl.x===player.x&&cl.y===player.y) triggerGameOver();
  });
}

/* ---------- POWERUPS ---------- */
function spawnPowerUp(){
  const empty=[];
  for(let y=0;y<maze.length;y++) for(let x=0;x<maze[0].length;x++)
    if(maze[y][x]===0) empty.push({x,y});
  if(empty.length){
    const {x,y}=empty[randInt(0,empty.length-1)];
    powerUps.push({x,y,type:"score"});
  }
}
function collectPowerUps(){
  powerUps=powerUps.filter(p=>{
    if(p.x===player.x&&p.y===player.y){ score+=100; return false; }
    return true;
  });
}

/* ---------- PARTICLES ---------- */
function spawnParticle(x,y,color){
  particles.push({x,y,dx:(Math.random()-.5)*2,dy:(Math.random()-.5)*2,life:30,color});
}
function updateParticles(){
  particles=particles.filter(p=>{p.x+=p.dx;p.y+=p.dy;p.life--;return p.life>0;});
}

/* ---------- GAME STATE ---------- */
function startGame(){
  maze=generateMaze(21,21);
  resetPlayer(); powerUps=[]; particles=[]; gameOver=false;
  gameRunning=true; nextCloneTime=now()+CLONE_INTERVAL;
  requestAnimationFrame(gameLoop);
}
function triggerGameOver(){
  gameOver=true; gameRunning=false;
  updateLeaderboard();
  document.getElementById("gameOverScreen").style.display="block";
}
function updateLeaderboard(){
  leaderboard.push({score,time:Date.now()});
  leaderboard.sort((a,b)=>b.score-a.score);
  leaderboard=leaderboard.slice(0,MAX_LEADERBOARD);
  localStorage.setItem("sce_leaderboard",JSON.stringify(leaderboard));
  renderLeaderboard();
}

/* ---------- RENDERING ---------- */
function render(){
  ctx.fillStyle=THEMES[theme].bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const cell=Math.min(canvas.width/maze[0].length, canvas.height/maze.length);
  // maze
  ctx.fillStyle=THEMES[theme].maze;
  maze.forEach((row,y)=>row.forEach((c,x)=>{if(c===1) ctx.fillRect(x*cell,y*cell,cell,cell);}));
  // player
  ctx.fillStyle=THEMES[theme].player;
  ctx.fillRect(player.x*cell,player.y*cell,cell,cell);
  // clones
  ctx.fillStyle=THEMES[theme].clone;
  clones.forEach(c=>ctx.fillRect(c.x*cell,c.y*cell,cell,cell));
  // powerUps
  ctx.fillStyle="gold";
  powerUps.forEach(p=>ctx.fillRect(p.x*cell,p.y*cell,cell,cell));
  // particles
  particles.forEach(p=>{ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,2,2);});
  // HUD
  document.getElementById("scoreDisplay").innerText="Score: "+score;
}

/* ---------- GAME LOOP ---------- */
function gameLoop(ts){
  if(!gameRunning) return;
  if(ts-lastTick>TICK_RATE){
    movePlayer(); moveClones(); collectPowerUps(); updateParticles();
    if(ts>nextCloneTime){ spawnClone(); nextCloneTime=ts+CLONE_INTERVAL*difficulty; difficulty*=DIFFICULTY_SCALE; }
    if(Math.random()<0.005) spawnPowerUp();
    score++;
    lastTick=ts;
  }
  render();
  requestAnimationFrame(gameLoop);
}

/* ---------- INPUT ---------- */
document.addEventListener("keydown",e=>{
  if(e.key==="ArrowUp") player.dir={x:0,y:-1};
  if(e.key==="ArrowDown") player.dir={x:0,y:1};
  if(e.key==="ArrowLeft") player.dir={x:-1,y:0};
  if(e.key==="ArrowRight") player.dir={x:1,y:0};
});
/* Joystick would be wired here if present */

/* ---------- UI ---------- */
function renderLeaderboard(){
  const el=document.getElementById("leaderboard");
  el.innerHTML=leaderboard.map(e=>`<div>${e.score}</div>`).join("");
}
function wireUI(){
  document.getElementById("startBtn")?.addEventListener("click",()=>startGame());
  document.getElementById("settingsBtn")?.addEventListener("click",()=>{
    document.getElementById("settingsMenu").style.display="block";
  });
}

/* ---------- INIT ---------- */
window.addEventListener("load",()=>{
  ensureDomElements();
  canvas.width=400; canvas.height=400;
  minimapCanvas.width=100; minimapCanvas.height=100;
  renderLeaderboard(); wireUI();
});
