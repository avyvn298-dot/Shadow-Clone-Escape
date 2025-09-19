/* Shadow Clone Escape — Level System + Powerups + Clone Types */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let TILE_SIZE = 40;
let rows, cols;
let maze = [];
let player, portal;
let clones = [];
let powerups = [];
let level = 1;
let gameOver = false;
let messages = []; // floating text

// Colors per level for variety
const levelColors = ["#2d2d2d", "#1e2a38", "#2a1e38", "#382a1e", "#1e3826"];

// --- Utility ---
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// Floating text popup
function addMessage(text, x, y, color = "white") {
  messages.push({ text, x, y, alpha: 1, color });
}

// --- Maze Generation (Recursive Division) ---
function generateMaze(r, c) {
  let grid = Array(r).fill().map(() => Array(c).fill(1)); // walls
  function carve(x, y) {
    const dirs = [
      [2, 0], [-2, 0], [0, 2], [0, -2]
    ].sort(() => Math.random() - 0.5);
    grid[y][x] = 0;
    for (let [dx, dy] of dirs) {
      let nx = x + dx, ny = y + dy;
      if (ny > 0 && ny < r && nx > 0 && nx < c && grid[ny][nx] === 1) {
        grid[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }
  carve(1, 1);
  return grid;
}

// --- Player ---
class Player {
  constructor() {
    this.x = TILE_SIZE;
    this.y = TILE_SIZE;
    this.size = TILE_SIZE * 0.6;
    this.speed = 3;
    this.activePower = null;
    this.powerTimer = 0;
  }
  move(dx, dy) {
    let nx = this.x + dx * this.speed;
    let ny = this.y + dy * this.speed;
    if (!collides(nx, ny, this.size)) {
      this.x = nx;
      this.y = ny;
    }
  }
  update() {
    if (this.activePower && this.powerTimer > 0) {
      this.powerTimer--;
      if (this.powerTimer <= 0) {
        this.activePower = null;
      }
    }
  }
  draw() {
    ctx.fillStyle = this.activePower === "cloak" ? "rgba(0,255,255,0.5)" : "lime";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    // HUD for powerup
    if (this.activePower) {
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`${this.activePower} (${Math.ceil(this.powerTimer / 60)}s)`, canvas.width - 150, 30);
    }
  }
}

// --- Portal ---
class Portal {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = TILE_SIZE * 0.8;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,200,255,0.7)";
    ctx.fill();
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

// --- Clones ---
class Clone {
  constructor(x, y, type = "normal") {
    this.x = x;
    this.y = y;
    this.size = TILE_SIZE * 0.6;
    this.type = type;
    this.speed = type === "fast" ? 3 : 2;
    this.lifetime = 60 * 20; // 20s
  }
  update() {
    this.lifetime--;
    if (this.lifetime <= 0) return false;
    let dx = player.x - this.x;
    let dy = player.y - this.y;
    let dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
    return true;
  }
  draw() {
    ctx.fillStyle =
      this.type === "fast" ? "red" :
      this.type === "ghost" ? "rgba(255,255,255,0.5)" :
      "purple";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Powerups ---
class Powerup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.size = TILE_SIZE * 0.6;
    this.type = type;
  }
  draw() {
    ctx.fillStyle = this.type === "speed" ? "yellow" :
                    this.type === "cloak" ? "cyan" : "orange";
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
  }
}

// --- Collision ---
function collides(x, y, size) {
  let row = Math.floor(y / TILE_SIZE);
  let col = Math.floor(x / TILE_SIZE);
  return maze[row]?.[col] === 1;
}

// --- Init ---
function initLevel() {
  rows = Math.floor(canvas.height / TILE_SIZE);
  cols = Math.floor(canvas.width / TILE_SIZE);
  maze = generateMaze(rows, cols);
  player = new Player();
  portal = new Portal((cols - 2) * TILE_SIZE, (rows - 2) * TILE_SIZE);
  clones = [];
  powerups = [];
  addMessage(`Level ${level} Start!`, canvas.width/2, 40, "yellow");
  // spawn a powerup
  if (Math.random() < 0.7) {
    let type = ["speed", "cloak", "shockwave"][randInt(0, 3)];
    powerups.push(new Powerup(randInt(2, cols-2) * TILE_SIZE, randInt(2, rows-2) * TILE_SIZE, type));
  }
}

// --- Game Loop ---
function update() {
  if (gameOver) return;
  player.update();
  // clones
  clones = clones.filter(c => c.update());
  // check collisions
  for (let clone of clones) {
    if (Math.hypot(player.x - clone.x, player.y - clone.y) < TILE_SIZE/2) {
      if (player.activePower !== "cloak") {
        gameOver = true;
        addMessage("Game Over!", canvas.width/2, canvas.height/2, "red");
      }
    }
  }
  // portal
  if (Math.hypot(player.x - portal.x, player.y - portal.y) < TILE_SIZE/2) {
    level++;
    initLevel();
  }
  // powerups
  for (let i=powerups.length-1; i>=0; i--) {
    let p = powerups[i];
    if (Math.hypot(player.x - p.x, player.y - p.y) < TILE_SIZE/2) {
      player.activePower = p.type;
      player.powerTimer = 60 * 5; // 5s
      addMessage(`${p.type} acquired!`, player.x, player.y, "cyan");
      powerups.splice(i,1);
    }
  }
  // spawn clones
  if (Math.random() < 0.01 * level) {
    let side = Math.random() < 0.5 ? 0 : canvas.width;
    let y = randInt(0, canvas.height);
    let type = ["normal","fast","ghost"][randInt(0,3)];
    clones.push(new Clone(side, y, type));
    addMessage(`${type} clone appeared!`, side, y, "orange");
  }
  // messages
  for (let i=messages.length-1; i>=0; i--) {
    messages[i].y -= 0.5;
    messages[i].alpha -= 0.01;
    if (messages[i].alpha <= 0) messages.splice(i,1);
  }
}

function draw() {
  ctx.fillStyle = levelColors[(level-1)%levelColors.length];
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // maze
  ctx.fillStyle = "black";
  for (let r=0; r<rows; r++) {
    for (let c=0; c<cols; c++) {
      if (maze[r][c] === 1) {
        ctx.fillRect(c*TILE_SIZE, r*TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  portal.draw();
  player.draw();
  clones.forEach(c => c.draw());
  powerups.forEach(p => p.draw());

  // floating messages
  for (let msg of messages) {
    ctx.globalAlpha = msg.alpha;
    ctx.fillStyle = msg.color;
    ctx.font = "20px Arial";
    ctx.fillText(msg.text, msg.x, msg.y);
    ctx.globalAlpha = 1;
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

initLevel();
loop();

// Controls
window.addEventListener("keydown", e => {
  if (gameOver) return;
  if (e.key === "ArrowUp") player.move(0,-1);
  if (e.key === "ArrowDown") player.move(0,1);
  if (e.key === "ArrowLeft") player.move(-1,0);
  if (e.key === "ArrowRight") player.move(1,0);
});
