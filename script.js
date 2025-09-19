const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("status");
const timerText = document.getElementById("timer");
const restartBtn = document.getElementById("restartBtn");
const startBtn = document.getElementById("startBtn");
const menu = document.getElementById("menu");
const ui = document.getElementById("ui");
const bestRecordText = document.getElementById("bestRecordText");

const bgMusic = document.getElementById("bgMusic");
const spawnSound = document.getElementById("spawnSound");
const loseSound = document.getElementById("loseSound");
const newRecordSound = document.getElementById("newRecordSound");

const tileSize = 30;
let cols = Math.floor(canvas.width / tileSize);
let rows = Math.floor(canvas.height / tileSize);
if (cols % 2 === 0) cols--;
if (rows % 2 === 0) rows--;

const STORAGE_KEY = "shadow_clone_best";

let maze = [];
let player, movesHistory, clones, frameCount, cloneInterval, running, startTime, bestTime;

function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

function generateMaze(cols, rows) {
  const grid = Array.from({length: rows}, () => Array(cols).fill(1));
  function carve(x, y) {
    grid[y][x] = 0;
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]]);
    for (const [dx,dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx > 0 && nx < cols-1 && ny > 0 && ny < rows-1 && grid[ny][nx] === 1) {
        grid[y + dy/2][x + dx/2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1,1);
  grid[1][1] = 0; grid[1][2] = 0; grid[2][1] = 0;
  return grid;
}

function resetGame() {
  maze = generateMaze(cols, rows);
  player = { x: 1, y: 1, color: "lime" };
  movesHistory = [];
  clones = [];
  frameCount = 0;
  cloneInterval = 300;
  running = true;
  startTime = Date.now();
  statusText.textContent = "Survive as long as you can!";
  restartBtn.style.display = "none";
  timerText.textContent = "Time: 0s";
  bestTime = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  bestRecordText.textContent = bestTime ? `Best: ${bestTime}s` : `Best: —`;
}

document.addEventListener("keydown", (e) => {
  if (!running) return;
  let newX = player.x;
  let newY = player.y;
  if (e.key === "ArrowUp" || e.key === "w") newY--;
  if (e.key === "ArrowDown" || e.key === "s") newY++;
  if (e.key === "ArrowLeft" || e.key === "a") newX--;
  if (e.key === "ArrowRight" || e.key === "d") newX++;
  if (newY>=0 && newY<rows && newX>=0 && newX<cols && maze[newY][newX] !== 1) {
    player.x = newX;
    player.y = newY;
    movesHistory.push({ x: newX, y: newY });
  }
});

class Clone {
  constructor(path) {
    this.path = [...path];
    this.index = 0;
    this.color = "red";
    this.x = path[0].x;
    this.y = path[0].y;
  }

  update() {
    if (this.index < this.path.length) {
      this.x = this.path[this.index].x;
      this.y = this.path[this.index].y;
      this.index++;
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x * tileSize, this.y * tileSize, tileSize, tileSize);
  }
}

function gameLoop() {
  if (!running) return;
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < maze.length; y++) {
    for (let x = 0; x < maze[y].length; x++) {
      if (maze[y][x] === 1) {
        ctx.fillStyle = "gray";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      } else {
        ctx.fillStyle = "#111";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
  }

  if (frameCount % cloneInterval === 0 && movesHistory.length > 0) {
    clones.push(new Clone(movesHistory));
    try{ spawnSound.currentTime = 0; spawnSound.play(); }catch(e){}
    if (cloneInterval > 100) cloneInterval -= 10;
  }

  for (let clone of clones) {
    clone.update();
    clone.draw();
    if (clone.x === player.x && clone.y === player.y) {
      gameOver();
      return;
    }
  }

  ctx.fillStyle = player.color;
  ctx.fillRect(player.x * tileSize, player.y * tileSize, tileSize, tileSize);

  let elapsed = Math.floor((Date.now() - startTime) / 1000);
  timerText.textContent = "Time: " + elapsed + "s";

  requestAnimationFrame(gameLoop);
}

function gameOver() {
  running = false;
  try{ bgMusic.pause(); }catch(e){}
  try{ loseSound.currentTime = 0; loseSound.play(); }catch(e){}
  let elapsed = Math.floor((Date.now() - startTime) / 1000);
  let prevBest = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  if (elapsed > prevBest) {
    localStorage.setItem(STORAGE_KEY, elapsed);
    bestTime = elapsed;
    bestRecordText.textContent = `Best: ${bestTime}s`;
    statusText.textContent = `☠️ You survived ${elapsed}s (NEW RECORD!)`;
    try{ newRecordSound.currentTime = 0; newRecordSound.play(); }catch(e){}
  } else {
    statusText.textContent = `☠️ You survived ${elapsed}s (Best: ${prevBest}s)`;
  }
  restartBtn.style.display = "inline-block";
  menuBtn.style.display = "inline-block";
}

restartBtn.addEventListener("click", () => {
  resetGame();
  try{ bgMusic.currentTime = 0; bgMusic.play(); }catch(e){}
  requestAnimationFrame(gameLoop);
});

startBtn.addEventListener("click", () => {
  menu.style.display = "none";
  canvas.style.display = "block";
  ui.style.display = "block";
  resetGame();
  try{ bgMusic.currentTime = 0; bgMusic.play(); }catch(e){}
  requestAnimationFrame(gameLoop);
});
