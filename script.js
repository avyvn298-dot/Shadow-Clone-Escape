// Game State
let gameState = {
    isPlaying: false,
    score: 0,
    lives: 3,
    level: 1,
    settings: {
        musicVolume: 70,
        sfxVolume: 80
    }
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');

// Audio Context for sound effects
let audioContext;
let sounds = {};

// Game objects
let ninja = { x: 50, y: 50, vx: 0, vy: 0, speed: 3, width: 32, height: 32, cloaked: false, cloakTime: 0 };
let clones = [];
let maze = [];
let powerups = [];
let portal = { x: 0, y: 0, width: 40, height: 40, active: false };
let particles = [];

// Input handling
let keys = {};
let mobile = { joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 } };

// Initialize game
function init() {
    setupCanvas();
    setupAudio();
    setupMobileControls();
    generateMaze();
    
    // Hide loading screen after 2 seconds
    setTimeout(() => {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainMenu').style.opacity = '1';
    }, 2000);

    // Game loop
    gameLoop();
}

function setupCanvas() {
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        minimap.width = 200;
        minimap.height = 150;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function setupAudio() {
    // Create simple audio context for sound effects
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        createSounds();
    } catch (e) {
        console.log('Audio not supported');
    }
}

function createSounds() {
    // Create simple synthesized sounds
    sounds.portal = createSound(440, 0.2, 0.5);
    sounds.spawn = createSound(220, 0.1, 0.3);
    sounds.powerup = createSound(660, 0.1, 0.4);
    sounds.death = createSound(150, 0.3, 0.6);
}

function createSound(frequency, duration, volume) {
    return () => {
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume * gameState.settings.sfxVolume / 100, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
    };
}

function setupMobileControls() {
    const joystick = document.getElementById('joystick');
    const handle = document.getElementById('joystickHandle');
    const spawnBtn = document.getElementById('spawnBtn');
    const menuBtn = document.getElementById('menuBtn');

    // Joystick controls
    function handleJoystickStart(e) {
        e.preventDefault();
        mobile.joystick.active = true;
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        mobile.joystick.startX = centerX;
        mobile.joystick.startY = centerY;
    }

    function handleJoystickMove(e) {
        if (!mobile.joystick.active) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const dx = clientX - mobile.joystick.startX;
        const dy = clientY - mobile.joystick.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 35;
        
        if (distance <= maxDistance) {
            handle.style.transform = `translate(${dx}px, ${dy}px)`;
            mobile.joystick.currentX = dx / maxDistance;
            mobile.joystick.currentY = dy / maxDistance;
        } else {
            const angle = Math.atan2(dy, dx);
            const limitedX = Math.cos(angle) * maxDistance;
            const limitedY = Math.sin(angle) * maxDistance;
            handle.style.transform = `translate(${limitedX}px, ${limitedY}px)`;
            mobile.joystick.currentX = limitedX / maxDistance;
            mobile.joystick.currentY = limitedY / maxDistance;
        }
    }

    function handleJoystickEnd(e) {
        e.preventDefault();
        mobile.joystick.active = false;
        handle.style.transform = 'translate(0, 0)';
        mobile.joystick.currentX = 0;
        mobile.joystick.currentY = 0;
    }

    // Touch events
    joystick.addEventListener('touchstart', handleJoystickStart);
    document.addEventListener('touchmove', handleJoystickMove);
    document.addEventListener('touchend', handleJoystickEnd);

    // Mouse events for testing
    joystick.addEventListener('mousedown', handleJoystickStart);
    document.addEventListener('mousemove', handleJoystickMove);
    document.addEventListener('mouseup', handleJoystickEnd);

    // Action buttons
    spawnBtn.addEventListener('touchstart', () => spawnClone());
    spawnBtn.addEventListener('click', () => spawnClone());
    menuBtn.addEventListener('touchstart', () => pauseGame());
    menuBtn.addEventListener('click', () => pauseGame());
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        spawnClone();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function generateMaze() {
    maze = [];
    powerups = [];
    
    const width = Math.floor(canvas.width / 40);
    const height = Math.floor(canvas.height / 40);
    
    // Create maze walls
    for (let y = 0; y < height; y++) {
        maze[y] = [];
        for (let x = 0; x < width; x++) {
            // Create border walls and some internal structure
            if (x === 0 || x === width - 1 || y === 0 || y === height - 1 || 
                (x % 4 === 0 && y % 4 === 0 && Math.random() > 0.3)) {
                maze[y][x] = 1;
            } else {
                maze[y][x] = 0;
            }
        }
    }

    // Ensure starting position is clear
    maze[1][1] = 0;
    maze[1][2] = 0;
    maze[2][1] = 0;

    // Place portal at the end
    portal.x = (width - 3) * 40;
    portal.y = (height - 3) * 40;
    portal.active = true;
    maze[height - 3][width - 3] = 0;
    maze[height - 2][width - 3] = 0;
    maze[height - 3][width - 2] = 0;

    // Add powerups
    for (let i = 0; i < 5 + gameState.level; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (width - 2)) + 1;
            y = Math.floor(Math.random() * (height - 2)) + 1;
        } while (maze[y][x] === 1);

        const types = ['speed', 'cloak', 'clone'];
        powerups.push({
            x: x * 40 + 10,
            y: y * 40 + 10,
            width: 20,
            height: 20,
            type: types[Math.floor(Math.random() * types.length)],
            collected: false
        });
    }

    // Reset ninja position
    ninja.x = 50;
    ninja.y = 50;
    ninja.cloaked = false;
    ninja.cloakTime = 0;
}

function spawnClone() {
    if (!gameState.isPlaying) return;
    
    clones.push({
        x: ninja.x,
        y: ninja.y,
        vx: ninja.vx,
        vy: ninja.vy,
        width: 30,
        height: 30,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        life: 300 + Math.random() * 200
    });

    if (sounds.spawn) sounds.spawn();
    gameState.score += 10;
    updateHUD();
}

function updateNinja() {
    if (!gameState.isPlaying) return;

    // Handle input
    let dx = 0, dy = 0;

    // Keyboard input
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;

    // Mobile joystick input
    if (mobile.joystick.active) {
        dx += mobile.joystick.currentX;
        dy += mobile.joystick.currentY;
    }

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }

    ninja.vx = dx * ninja.speed;
    ninja.vy = dy * ninja.speed;

    // Update position
    const nextX = ninja.x + ninja.vx;
    const nextY = ninja.y + ninja.vy;

    // Collision detection with maze
    if (!checkMazeCollision(nextX, ninja.y, ninja.width, ninja.height)) {
        ninja.x = nextX;
    }
    if (!checkMazeCollision(ninja.x, nextY, ninja.width, ninja.height)) {
        ninja.y = nextY;
    }

    // Keep ninja in bounds
    ninja.x = Math.max(0, Math.min(canvas.width - ninja.width, ninja.x));
    ninja.y = Math.max(0, Math.min(canvas.height - ninja.height, ninja.y));

    // Handle cloaking
    if (ninja.cloaked) {
        ninja.cloakTime--;
        if (ninja.cloakTime <= 0) {
            ninja.cloaked = false;
        }
    }

    // Check powerup collection
    powerups.forEach(powerup => {
        if (!powerup.collected && checkCollision(ninja, powerup)) {
            collectPowerup(powerup);
        }
    });

    // Check portal collision
    if (portal.active && checkCollision(ninja, portal)) {
        nextLevel();
    }
}

function updateClones() {
    for (let i = clones.length - 1; i >= 0; i--) {
        const clone = clones[i];
        clone.life--;

        // Simple AI movement
        clone.vx += (Math.random() - 0.5) * 0.5;
        clone.vy += (Math.random() - 0.5) * 0.5;
        clone.vx *= 0.9;
        clone.vy *= 0.9;

        const nextX = clone.x + clone.vx;
        const nextY = clone.y + clone.vy;

        if (!checkMazeCollision(nextX, clone.y, clone.width, clone.height)) {
            clone.x = nextX;
        }
        if (!checkMazeCollision(clone.x, nextY, clone.width, clone.height)) {
            clone.y = nextY;
        }

        clone.x = Math.max(0, Math.min(canvas.width - clone.width, clone.x));
        clone.y = Math.max(0, Math.min(canvas.height - clone.height, clone.y));

        if (clone.life <= 0) {
            clones.splice(i, 1);
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        particle.alpha -= 0.02;

        if (particle.life <= 0 || particle.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

function checkMazeCollision(x, y, width, height) {
    const cellSize = 40;
    const left = Math.floor(x / cellSize);
    const right = Math.floor((x + width) / cellSize);
    const top = Math.floor(y / cellSize);
    const bottom = Math.floor((y + height) / cellSize);

    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            if (maze[row] && maze[row][col] === 1) {
                return true;
            }
        }
    }
    return false;
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function collectPowerup(powerup) {
    powerup.collected = true;
    if (sounds.powerup) sounds.powerup();
    
    switch (powerup.type) {
        case 'speed':
            ninja.speed = Math.min(6, ninja.speed + 1);
            createParticleEffect(powerup.x, powerup.y, '#00ff88');
            gameState.score += 100;
            break;
        case 'cloak':
            ninja.cloaked = true;
            ninja.cloakTime = 300;
            createParticleEffect(powerup.x, powerup.y, '#9d4edd');
            gameState.score += 150;
            break;
        case 'clone':
            for (let i = 0; i < 3; i++) {
                setTimeout(() => spawnClone(), i * 100);
            }
            createParticleEffect(powerup.x, powerup.y, '#00ccff');
            gameState.score += 200;
            break;
    }
    updateHUD();
}

function createParticleEffect(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x + 10,
            y: y + 10,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            color: color,
            life: 30 + Math.random() * 30,
            alpha: 1
        });
    }
}

function nextLevel() {
    if (sounds.portal) sounds.portal();
    gameState.level++;
    gameState.score += 500 * gameState.level;
    
    // Create portal particle effect
    createParticleEffect(portal.x + 20, portal.y + 20, '#ff6b6b');
    
    setTimeout(() => {
        generateMaze();
        clones = [];
        particles = [];
        updateHUD();
    }, 500);
}

function render() {
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameState.isPlaying) return;

    // Draw maze
    ctx.fillStyle = '#16537e';
    const cellSize = 40;
    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
            if (maze[y][x] === 1) {
                const posX = x * cellSize;
                const posY = y * cellSize;
                
                // Add gradient effect to walls
                const gradient = ctx.createLinearGradient(posX, posY, posX + cellSize, posY + cellSize);
                gradient.addColorStop(0, '#16537e');
                gradient.addColorStop(1, '#0f3460');
                ctx.fillStyle = gradient;
                
                ctx.fillRect(posX, posY, cellSize, cellSize);
                
                // Add border glow
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 1;
                ctx.strokeRect(posX, posY, cellSize, cellSize);
            }
        }
    }

    // Draw powerups
    powerups.forEach(powerup => {
        if (powerup.collected) return;
        
        const time = Date.now() * 0.005;
        const pulse = Math.sin(time + powerup.x + powerup.y) * 0.3 + 0.7;
        
        ctx.save();
        ctx.translate(powerup.x + powerup.width/2, powerup.y + powerup.height/2);
        ctx.rotate(time);
        ctx.scale(pulse, pulse);
        
        switch (powerup.type) {
            case 'speed':
                ctx.fillStyle = '#00ff88';
                ctx.fillRect(-10, -2, 20, 4);
                ctx.fillRect(-2, -10, 4, 20);
                break;
            case 'cloak':
                ctx.fillStyle = '#9d4edd';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
            case 'clone':
                ctx.fillStyle = '#00ccff';
                ctx.fillRect(-8, -8, 16, 16);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-6, -6, 12, 12);
                ctx.fillStyle = '#00ccff';
                ctx.fillRect(-4, -4, 8, 8);
                break;
        }
        ctx.restore();
    });

    // Draw portal
    if (portal.active) {
        const time = Date.now() * 0.01;
        const gradient = ctx.createRadialGradient(
            portal.x + portal.width/2, portal.y + portal.height/2, 0,
            portal.x + portal.width/2, portal.y + portal.height/2, portal.width
        );
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, '#feca57');
        gradient.addColorStop(1, 'rgba(255,107,107,0)');
        
        ctx.fillStyle = gradient;
        ctx.save();
        ctx.translate(portal.x + portal.width/2, portal.y + portal.height/2);
        ctx.rotate(time);
        ctx.fillRect(-portal.width/2, -portal.height/2, portal.width, portal.height);
        ctx.restore();
        
        // Portal glow effect
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(portal.x, portal.y, portal.width, portal.height);
        ctx.shadowBlur = 0;
    }

    // Draw particles
    particles.forEach(particle => {
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw clones
    clones.forEach((clone, index) => {
        const alpha = clone.life / 300;
        ctx.globalAlpha = alpha;
        
        // Clone body
        const gradient = ctx.createLinearGradient(clone.x, clone.y, clone.x + clone.width, clone.y + clone.height);
        gradient.addColorStop(0, clone.color);
        gradient.addColorStop(1, '#333');
        ctx.fillStyle = gradient;
        ctx.fillRect(clone.x, clone.y, clone.width, clone.height);
        
        // Clone eyes
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(clone.x + 5, clone.y + 8, 6, 6);
        ctx.fillRect(clone.x + 19, clone.y + 8, 6, 6);
        
        // Clone number
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(index + 1, clone.x + clone.width/2, clone.y + clone.height/2 + 4);
    });
    ctx.globalAlpha = 1;

    // Draw ninja
    if (ninja.cloaked) {
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.2;
    }
    
    // Ninja body
    const ninjaGradient = ctx.createLinearGradient(ninja.x, ninja.y, ninja.x + ninja.width, ninja.y + ninja.height);
    ninjaGradient.addColorStop(0, '#333');
    ninjaGradient.addColorStop(1, '#000');
    ctx.fillStyle = ninjaGradient;
    ctx.fillRect(ninja.x, ninja.y, ninja.width, ninja.height);
    
    // Ninja eyes
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(ninja.x + 6, ninja.y + 10, 8, 8);
    ctx.fillRect(ninja.x + 18, ninja.y + 10, 8, 8);
    
    // Movement trail
    if (ninja.vx !== 0 || ninja.vy !== 0) {
        ctx.strokeStyle = ninja.cloaked ? '#9d4edd' : '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ninja.x + ninja.width/2, ninja.y + ninja.height/2);
        ctx.lineTo(ninja.x + ninja.width/2 - ninja.vx * 3, ninja.y + ninja.height/2 - ninja.vy * 3);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;

    // Draw minimap
    drawMinimap();
}

function drawMinimap() {
    const minimapCtx = document.getElementById('minimap').getContext('2d');
    minimapCtx.fillStyle = '#000';
    minimapCtx.fillRect(0, 0, 200, 150);
    
    const scaleX = 200 / canvas.width;
    const scaleY = 150 / canvas.height;
    
    // Draw maze walls
    minimapCtx.fillStyle = '#16537e';
    const cellSize = 40;
    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
            if (maze[y][x] === 1) {
                minimapCtx.fillRect(x * cellSize * scaleX, y * cellSize * scaleY, cellSize * scaleX, cellSize * scaleY);
            }
        }
    }
    
    // Draw portal
    if (portal.active) {
        minimapCtx.fillStyle = '#ff6b6b';
        minimapCtx.fillRect(portal.x * scaleX, portal.y * scaleY, portal.width * scaleX, portal.height * scaleY);
    }
    
    // Draw powerups
    minimapCtx.fillStyle = '#feca57';
    powerups.forEach(powerup => {
        if (!powerup.collected) {
            minimapCtx.fillRect(powerup.x * scaleX, powerup.y * scaleY, 3, 3);
        }
    });
    
    // Draw clones
    minimapCtx.fillStyle = '#00ccff';
    clones.forEach(clone => {
        minimapCtx.fillRect(clone.x * scaleX, clone.y * scaleY, 2, 2);
    });
    
    // Draw ninja
    minimapCtx.fillStyle = '#00ff88';
    minimapCtx.fillRect(ninja.x * scaleX, ninja.y * scaleY, 3, 3);
}

function gameLoop() {
    updateNinja();
    updateClones();
    updateParticles();
    render();
    requestAnimationFrame(gameLoop);
}

function updateHUD() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('lives').textContent = gameState.lives;
    document.getElementById('level').textContent = gameState.level;
}

// Menu functions
function startGame() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('hud').style.display = 'block';
    document.getElementById('minimap').style.display = 'block';
    
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.level = 1;
    
    generateMaze();
    updateHUD();
}

function pauseGame() {
    gameState.isPlaying = false;
    document.getElementById('mainMenu').style.display = 'flex';
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('minimap').style.display = 'none';
}

function restartGame() {
    document.getElementById('gameOverScreen').style.display = 'none';
    startGame();
}

function backToMenu() {
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('mainMenu').style.display = 'flex';
    document.getElementById('gameCanvas').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('minimap').style.display = 'none';
    gameState.isPlaying = false;
}

function showSettings() {
    document.getElementById('settingsOverlay').style.display = 'flex';
}

function showLeaderboard() {
    // Update leaderboard with current score
    const currentScore = gameState.score;
    if (currentScore > 0) {
        const leaderboardList = document.getElementById('leaderboardList');
        const newEntry = document.createElement('div');
        newEntry.textContent = `★ You - ${currentScore}`;
        newEntry.style.color = '#00ff88';
        leaderboardList.insertBefore(newEntry, leaderboardList.firstChild);
    }
    document.getElementById('leaderboardOverlay').style.display = 'flex';
}

function showHowToPlay() {
    document.getElementById('howToPlayOverlay').style.display = 'flex';
}

function hideOverlay(overlayId) {
    document.getElementById(overlayId).style.display = 'none';
}

// Settings event listeners
document.getElementById('musicSlider').addEventListener('input', (e) => {
    gameState.settings.musicVolume = e.target.value;
});

document.getElementById('sfxSlider').addEventListener('input', (e) => {
    gameState.settings.sfxVolume = e.target.value;
});

// Close overlays when clicking outside
document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });
});

// Prevent context menu on canvas
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }
});

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
