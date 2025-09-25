// Shadow Clone Escape - Complete Game Implementation
class ShadowCloneEscape {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.gameState = 'loading';
        this.loadingProgress = 0;
        this.assets = {};
        this.audio = {};
        
        // Game settings
        this.settings = {
            musicVolume: 0.5,
            sfxVolume: 0.5,
            graphicsQuality: 'high'
        };
        
        // Game variables
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameTime = 0;
        this.isPaused = false;
        
        // Player
        this.player = {
            x: 0, y: 0,
            width: 96, height: 67,
            speed: 3,
            frame: 0,
            direction: 0,
            moving: false,
            cloaked: false,
            cloakTime: 0,
            speedBoost: false,
            speedBoostTime: 0,
            trail: []
        };
        
        // Clones
        this.clones = [];
        this.cloneSpawnTimer = 0;
        
        // Maze
        this.maze = [];
        this.mazeWidth = 21;
        this.mazeHeight = 21;
        this.cellSize = 30;
        
        // Portal
        this.portal = { x: 0, y: 0, frame: 0 };
        
        // Powerups
        this.powerups = [];
        
        // Input
        this.keys = {};
        this.joystick = {
            active: false,
            centerX: 0,
            centerY: 0,
            knobX: 0,
            knobY: 0,
            angle: 0,
            distance: 0
        };
        
        // Mobile detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Particles
        this.particles = [];
        
        // Performance detection
        this.performanceLevel = this.detectPerformance();
        
        this.init();
    }
    
    detectPerformance() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'low';
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            if (renderer.includes('Intel') || renderer.includes('Mali') || renderer.includes('Adreno')) {
                return 'low';
            }
        }
        
        return window.devicePixelRatio > 1 ? 'high' : 'low';
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupMobileControls();
        this.loadAssets();
        this.loadSettings();
        this.gameLoop();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Smooth pixel rendering
        this.ctx.imageSmoothingEnabled = false;
        this.canvas.style.imageRendering = 'pixelated';
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update mobile controls position if needed
        if (this.isMobile) {
            document.querySelector('.mobile-controls').style.display = 'block';
        }
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Keyboard input
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Menu buttons
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('leaderboardBtn').addEventListener('click', () => this.showLeaderboard());
        document.getElementById('howToPlayBtn').addEventListener('click', () => this.showHowToPlay());
        
        // Settings
        document.getElementById('musicVolume').addEventListener('input', (e) => this.updateMusicVolume(e.target.value));
        document.getElementById('sfxVolume').addEventListener('input', (e) => this.updateSfxVolume(e.target.value));
        document.getElementById('graphicsQuality').addEventListener('change', (e) => this.updateGraphicsQuality(e.target.value));
        
        // Close buttons
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.hideAllMenus());
        document.getElementById('closeLeaderboardBtn').addEventListener('click', () => this.hideAllMenus());
        document.getElementById('closeHowToPlayBtn').addEventListener('click', () => this.hideAllMenus());
        
        // Pause menu
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('pauseSettingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('mainMenuBtn').addEventListener('click', () => this.returnToMainMenu());
        
        // Game over menu
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('gameOverMainMenuBtn').addEventListener('click', () => this.returnToMainMenu());
        
        // Level complete menu
        document.getElementById('nextLevelBtn').addEventListener('click', () => this.nextLevel());
        document.getElementById('levelMainMenuBtn').addEventListener('click', () => this.returnToMainMenu());
    }
    
    setupMobileControls() {
        if (!this.isMobile) return;
        
        const joystick = document.getElementById('joystick');
        const joystickBase = joystick.querySelector('.joystick-base');
        const joystickKnob = joystick.querySelector('.joystick-knob');
        
        const rect = joystickBase.getBoundingClientRect();
        this.joystick.centerX = rect.left + rect.width / 2;
        this.joystick.centerY = rect.top + rect.height / 2;
        
        // Touch events
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.joystick.active = true;
            this.updateJoystick(e.touches[0]);
        });
        
        joystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.joystick.active) {
                this.updateJoystick(e.touches[0]);
            }
        });
        
        joystick.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.joystick.active = false;
            this.joystick.knobX = 0;
            this.joystick.knobY = 0;
            this.joystick.distance = 0;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
        });
        
        // Mouse events for testing
        joystick.addEventListener('mousedown', (e) => {
            this.joystick.active = true;
            this.updateJoystick(e);
        });
        
        joystick.addEventListener('mousemove', (e) => {
            if (this.joystick.active) {
                this.updateJoystick(e);
            }
        });
        
        joystick.addEventListener('mouseup', () => {
            this.joystick.active = false;
            this.joystick.knobX = 0;
            this.joystick.knobY = 0;
            this.joystick.distance = 0;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
        });
    }
    
    updateJoystick(pointer) {
        const rect = document.getElementById('joystick').getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const deltaX = pointer.clientX - centerX;
        const deltaY = pointer.clientY - centerY;
        const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), 35);
        
        this.joystick.angle = Math.atan2(deltaY, deltaX);
        this.joystick.distance = distance / 35;
        
        const knobX = Math.cos(this.joystick.angle) * distance;
        const knobY = Math.sin(this.joystick.angle) * distance;
        
        const joystickKnob = document.querySelector('.joystick-knob');
        joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        
        this.joystick.knobX = knobX;
        this.joystick.knobY = knobY;
    }
    
    loadAssets() {
        const assetsToLoad = [
            { type: 'image', key: 'ninjas', src: 'assets/ninjas.png' },
            { type: 'image', key: 'clones', src: 'assets/clones.png' },
            { type: 'image', key: 'portal', src: 'assets/portal.png' },
            { type: 'image', key: 'powerup_speed', src: 'assets/powerup_speed.png' },
            { type: 'image', key: 'powerup_cloak', src: 'assets/powerup_cloak.png' },
            { type: 'image', key: 'powerup_life', src: 'assets/powerup_life.png' },
            { type: 'audio', key: 'music', src: 'assets/music.mp3' },
            { type: 'audio', key: 'spawn', src: 'assets/sfx/spawn.wav' },
            { type: 'audio', key: 'portal', src: 'assets/sfx/portal.wav' },
            { type: 'audio', key: 'powerup', src: 'assets/sfx/powerup.wav' },
            { type: 'audio', key: 'death', src: 'assets/sfx/death.wav' }
        ];
        
        let loaded = 0;
        const total = assetsToLoad.length;
        
        assetsToLoad.forEach(asset => {
            if (asset.type === 'image') {
                const img = new Image();
                img.onload = () => {
                    this.assets[asset.key] = img;
                    loaded++;
                    this.updateLoadingProgress(loaded / total);
                };
                img.onerror = () => {
                    console.warn(`Failed to load image: ${asset.src}`);
                    loaded++;
                    this.updateLoadingProgress(loaded / total);
                };
                img.src = asset.src;
            } else if (asset.type === 'audio') {
                const audio = new Audio();
                audio.oncanplaythrough = () => {
                    this.audio[asset.key] = audio;
                    if (asset.key === 'music') {
                        audio.loop = true;
                        audio.volume = this.settings.musicVolume;
                    } else {
                        audio.volume = this.settings.sfxVolume;
                    }
                    loaded++;
                    this.updateLoadingProgress(loaded / total);
                };
                audio.onerror = () => {
                    console.warn(`Failed to load audio: ${asset.src}`);
                    loaded++;
                    this.updateLoadingProgress(loaded / total);
                };
                audio.src = asset.src;
            }
        });
    }
    
    updateLoadingProgress(progress) {
        this.loadingProgress = progress;
        const bar = document.querySelector('.loading-bar');
        const status = document.querySelector('.loading-status');
        
        bar.style.width = `${progress * 100}%`;
        
        if (progress < 1) {
            status.textContent = `Loading... ${Math.round(progress * 100)}%`;
        } else {
            status.textContent = 'Complete!';
            setTimeout(() => this.showMainMenu(), 500);
        }
    }
    
    showMainMenu() {
        this.gameState = 'menu';
        document.getElementById('loadingScreen').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
        
        if (this.audio.music && this.audio.music.paused) {
            this.audio.music.play().catch(() => {});
        }
    }
    
    hideAllMenus() {
        const menus = [
            'mainMenu', 'pauseMenu', 'gameOverMenu', 'levelCompleteMenu',
            'settingsMenu', 'leaderboardMenu', 'howToPlayMenu'
        ];
        menus.forEach(id => document.getElementById(id).classList.add('hidden'));
        
        if (this.gameState === 'playing' && this.isPaused) {
            this.isPaused = false;
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameTime = 0;
        this.isPaused = false;
        
        this.hideAllMenus();
        document.getElementById('gameScreen').classList.remove('hidden');
        
        this.initializeLevel();
        this.updateHUD();
    }
    
    initializeLevel() {
        this.generateMaze();
        this.spawnPlayer();
        this.spawnPortal();
        this.clones = [];
        this.powerups = [];
        this.particles = [];
        this.cloneSpawnTimer = 0;
        
        // Spawn some powerups
        this.spawnPowerups();
        
        // Update level display
        document.getElementById('completedLevel').textContent = this.level;
    }
    
    generateMaze() {
        // Create maze grid
        this.maze = Array(this.mazeHeight).fill().map(() => Array(this.mazeWidth).fill(1));
        
        // Generate maze using recursive backtracking
        const stack = [];
        const startX = 1;
        const startY = 1;
        
        this.maze[startY][startX] = 0;
        stack.push([startX, startY]);
        
        const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];
        
        while (stack.length > 0) {
            const [x, y] = stack[stack.length - 1];
            const neighbors = [];
            
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx > 0 && nx < this.mazeWidth - 1 && ny > 0 && ny < this.mazeHeight - 1 && this.maze[ny][nx] === 1) {
                    neighbors.push([nx, ny, x + dx/2, y + dy/2]);
                }
            }
            
            if (neighbors.length > 0) {
                const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.maze[ny][nx] = 0;
                this.maze[wy][wx] = 0;
                stack.push([nx, ny]);
            } else {
                stack.pop();
            }
        }
        
        // Ensure path to exit
        for (let i = this.mazeWidth - 3; i < this.mazeWidth - 1; i++) {
            this.maze[this.mazeHeight - 2][i] = 0;
        }
    }
    
    spawnPlayer() {
        // Find starting position
        for (let y = 1; y < this.mazeHeight; y++) {
            for (let x = 1; x < this.mazeWidth; x++) {
                if (this.maze[y][x] === 0) {
                    this.player.x = x * this.cellSize + this.cellSize / 2;
                    this.player.y = y * this.cellSize + this.cellSize / 2;
                    this.player.trail = [{x: this.player.x, y: this.player.y}];
                    return;
                }
            }
        }
    }
    
    spawnPortal() {
        // Place portal at the end of the maze
        for (let y = this.mazeHeight - 2; y > 0; y--) {
            for (let x = this.mazeWidth - 2; x > 0; x--) {
                if (this.maze[y][x] === 0) {
                    this.portal.x = x * this.cellSize + this.cellSize / 2;
                    this.portal.y = y * this.cellSize + this.cellSize / 2;
                    this.portal.frame = 0;
                    return;
                }
            }
        }
    }
    
    spawnPowerups() {
        const powerupTypes = ['speed', 'cloak', 'life'];
        const numPowerups = Math.min(3 + this.level, 8);
        
        for (let i = 0; i < numPowerups; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * this.mazeWidth);
                y = Math.floor(Math.random() * this.mazeHeight);
            } while (this.maze[y][x] !== 0);
            
            const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
            this.powerups.push({
                x: x * this.cellSize + this.cellSize / 2,
                y: y * this.cellSize + this.cellSize / 2,
                type: type,
                collected: false,
                bobOffset: Math.random() * Math.PI * 2
            });
        }
    }
    
    handleKeyDown(e) {
        this.keys[e.code] = true;
        
        if (e.code === 'Escape') {
            if (this.gameState === 'playing') {
                this.togglePause();
            }
            e.preventDefault();
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.code] = false;
    }
    
    updatePlayer(deltaTime) {
        if (this.isPaused) return;
        
        let dx = 0, dy = 0;
        let moving = false;
        
        // Handle keyboard input
        if (this.keys['KeyW'] || this.keys['ArrowUp']) { dy = -1; moving = true; }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) { dy = 1; moving = true; }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) { dx = -1; moving = true; }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) { dx = 1; moving = true; }
        
        // Handle mobile joystick input
        if (this.joystick.active && this.joystick.distance > 0.2) {
            dx = Math.cos(this.joystick.angle) * this.joystick.distance;
            dy = Math.sin(this.joystick.angle) * this.joystick.distance;
            moving = true;
        }
        
        this.player.moving = moving;
        
        if (moving) {
            // Normalize diagonal movement
            if (dx !== 0 && dy !== 0) {
                dx *= 0.707;
                dy *= 0.707;
            }
            
            let speed = this.player.speed;
            if (this.player.speedBoost) {
                speed *= 2;
                this.player.speedBoostTime -= deltaTime;
                if (this.player.speedBoostTime <= 0) {
                    this.player.speedBoost = false;
                }
            }
            
            const newX = this.player.x + dx * speed;
            const newY = this.player.y + dy * speed;
            
            // Collision detection
            if (!this.checkWallCollision(newX, this.player.y)) {
                this.player.x = newX;
            }
            if (!this.checkWallCollision(this.player.x, newY)) {
                this.player.y = newY;
            }
            
            // Update trail
            this.player.trail.push({x: this.player.x, y: this.player.y});
            if (this.player.trail.length > 200) {
                this.player.trail.shift();
            }
            
            // Update animation
            this.player.frame += deltaTime * 12;
            if (this.player.frame >= 8) this.player.frame = 0;
        }
        
        // Update cloak
        if (this.player.cloaked) {
            this.player.cloakTime -= deltaTime;
            if (this.player.cloakTime <= 0) {
                this.player.cloaked = false;
            }
        }
        
        // Check portal collision
        this.checkPortalCollision();
        
        // Check powerup collisions
        this.checkPowerupCollisions();
    }
    
    checkWallCollision(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        
        if (cellX < 0 || cellX >= this.mazeWidth || cellY < 0 || cellY >= this.mazeHeight) {
            return true;
        }
        
        return this.maze[cellY][cellX] === 1;
    }
    
    checkPortalCollision() {
        const dx = this.player.x - this.portal.x;
        const dy = this.player.y - this.portal.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) {
            this.playSound('portal');
            this.addParticles(this.portal.x, this.portal.y, 'sparkle', 20);
            this.completeLevel();
        }
    }
    
    checkPowerupCollisions() {
        this.powerups.forEach(powerup => {
            if (!powerup.collected) {
                const dx = this.player.x - powerup.x;
                const dy = this.player.y - powerup.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 20) {
                    powerup.collected = true;
                    this.collectPowerup(powerup.type);
                    this.playSound('powerup');
                    this.addParticles(powerup.x, powerup.y, 'sparkle', 10);
                }
            }
        });
    }
    
    collectPowerup(type) {
        switch(type) {
            case 'speed':
                this.player.speedBoost = true;
                this.player.speedBoostTime = 5000;
                break;
            case 'cloak':
                this.player.cloaked = true;
                this.player.cloakTime = 8000;
                break;
            case 'life':
                this.lives++;
                this.updateHUD();
                break;
        }
        
        this.score += 50;
        this.updateHUD();
    }
    
    updateClones(deltaTime) {
        if (this.isPaused) return;
        
        // Spawn clones
        this.cloneSpawnTimer += deltaTime;
        const spawnInterval = Math.max(3000 - this.level * 200, 1000);
        
        if (this.cloneSpawnTimer >= spawnInterval && this.clones.length < this.level + 2) {
            this.spawnClone();
            this.cloneSpawnTimer = 0;
        }
        
        // Update existing clones
        this.clones.forEach(clone => {
            this.updateClone(clone, deltaTime);
        });
        
        // Remove dead clones
        this.clones = this.clones.filter(clone => !clone.dead);
    }
    
    spawnClone() {
        const types = ['idle', 'wraith', 'ghost'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Find spawn position away from player
        let x, y;
        do {
            x = Math.floor(Math.random() * this.mazeWidth);
            y = Math.floor(Math.random() * this.mazeHeight);
        } while (this.maze[y][x] !== 0 || this.getDistance(x * this.cellSize, y * this.cellSize, this.player.x, this.player.y) < 100);
        
        const clone = {
            x: x * this.cellSize + this.cellSize / 2,
            y: y * this.cellSize + this.cellSize / 2,
            type: type,
            trailIndex: Math.max(0, this.player.trail.length - 50),
            speed: type === 'wraith' ? 2 : type === 'ghost' ? 1.5 : 1,
            frame: 0,
            teleportTimer: 0,
            dead: false
        };
        
        this.clones.push(clone);
        this.playSound('spawn');
        this.addParticles(clone.x, clone.y, 'smoke', 15);
    }
    
    updateClone(clone, deltaTime) {
        if (this.player.cloaked) return;
        
        clone.frame += deltaTime * 8;
        if (clone.frame >= 10) clone.frame = 0;
        
        if (clone.type === 'ghost') {
            clone.teleportTimer += deltaTime;
            if (clone.teleportTimer >= 2000) {
                // Teleport closer to player
                const angle = Math.atan2(this.player.y - clone.y, this.player.x - clone.x);
                const teleportDistance = 80;
                const newX = clone.x + Math.cos(angle) * teleportDistance;
                const newY = clone.y + Math.sin(angle) * teleportDistance;
                
                if (!this.checkWallCollision(newX, newY)) {
                    this.addParticles(clone.x, clone.y, 'smoke', 8);
                    clone.x = newX;
                    clone.y = newY;
                    this.addParticles(clone.x, clone.y, 'smoke', 8);
                }
                
                clone.teleportTimer = 0;
            }
        }
        
        // Follow player trail
        if (clone.trailIndex < this.player.trail.length - 1) {
            const target = this.player.trail[clone.trailIndex];
            const dx = target.x - clone.x;
            const dy = target.y - clone.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
                clone.trailIndex++;
            } else {
                const moveDistance = clone.speed * deltaTime / 16.67;
                clone.x += (dx / distance) * moveDistance;
                clone.y += (dy / distance) * moveDistance;
            }
        } else {
            // Move directly toward player if caught up
            const dx = this.player.x - clone.x;
            const dy = this.player.y - clone.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const moveDistance = clone.speed * deltaTime / 16.67;
                clone.x += (dx / distance) * moveDistance;
                clone.y += (dy / distance) * moveDistance;
            }
        }
        
        // Check collision with player
        const playerDistance = this.getDistance(clone.x, clone.y, this.player.x, this.player.y);
        if (playerDistance < 25) {
            this.playerHit();
        }
    }
    
    playerHit() {
        if (this.player.cloaked) return;
        
        this.lives--;
        this.updateHUD();
        this.playSound('death');
        this.addParticles(this.player.x, this.player.y, 'smoke', 20);
        
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            // Reset player position
            this.spawnPlayer();
            // Remove some clones
            this.clones.splice(0, Math.floor(this.clones.length / 2));
        }
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.saveScore();
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverMenu').classList.remove('hidden');
        
        if (this.audio.music) {
            this.audio.music.pause();
        }
    }
    
    completeLevel() {
        this.score += 100 + this.level * 50;
        this.updateHUD();
        document.getElementById('levelScore').textContent = this.score;
        document.getElementById('levelCompleteMenu').classList.remove('hidden');
        this.gameState = 'levelComplete';
    }
    
    nextLevel() {
        this.level++;
        this.hideAllMenus();
        this.initializeLevel();
        this.gameState = 'playing';
    }
    
    updateParticles(deltaTime) {
        this.particles.forEach(particle => {
            particle.x += particle.vx * deltaTime / 16.67;
            particle.y += particle.vy * deltaTime / 16.67;
            particle.life -= deltaTime;
            particle.alpha = Math.max(0, particle.life / particle.maxLife);
        });
        
        this.particles = this.particles.filter(particle => particle.life > 0);
    }
    
    addParticles(x, y, type, count) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                type: type,
                life: 1000 + Math.random() * 1000,
                maxLife: 1000 + Math.random() * 1000,
                alpha: 1,
                size: Math.random() * 4 + 2
            });
        }
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.gameState === 'playing' || this.gameState === 'levelComplete') {
            this.renderGame();
        }
    }
    
    renderGame() {
        // Center camera on player
        const cameraX = this.canvas.width / 2 - this.player.x;
        const cameraY = this.canvas.height / 2 - this.player.y;
        
        this.ctx.save();
        this.ctx.translate(cameraX, cameraY);
        
        // Render maze
        this.renderMaze();
        
        // Render player trail (ghostly effect)
        this.renderPlayerTrail();
        
        // Render powerups
        this.renderPowerups();
        
        // Render portal
        this.renderPortal();
        
        // Render clones
        this.renderClones();
        
        // Render player
        this.renderPlayer();
        
        // Render particles
        this.renderParticles();
        
        this.ctx.restore();
        
        // Render minimap
        this.renderMinimap();
    }
    
    renderMaze() {
        for (let y = 0; y < this.mazeHeight; y++) {
            for (let x = 0; x < this.mazeWidth; x++) {
                if (this.maze[y][x] === 1) {
                    const cellX = x * this.cellSize;
                    const cellY = y * this.cellSize;
                    
                    if (this.settings.graphicsQuality === 'high') {
                        // High quality walls with glow
                        this.ctx.fillStyle = '#2c3e50';
                        this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                        
                        this.ctx.shadowColor = '#4a90e2';
                        this.ctx.shadowBlur = 10;
                        this.ctx.strokeStyle = '#4a90e2';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeRect(cellX + 1, cellY + 1, this.cellSize - 2, this.cellSize - 2);
                        this.ctx.shadowBlur = 0;
                    } else {
                        // Low quality simple walls
                        this.ctx.fillStyle = '#34495e';
                        this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                        this.ctx.strokeStyle = '#2c3e50';
                        this.ctx.lineWidth = 1;
                        this.ctx.strokeRect(cellX, cellY, this.cellSize, this.cellSize);
                    }
                }
            }
        }
    }
    
    renderPlayerTrail() {
        if (this.settings.graphicsQuality === 'high' && this.player.trail.length > 10) {
            this.ctx.globalAlpha = 0.3;
            this.ctx.strokeStyle = '#50c878';
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            
            this.ctx.beginPath();
            for (let i = Math.max(0, this.player.trail.length - 50); i < this.player.trail.length; i++) {
                const point = this.player.trail[i];
                if (i === Math.max(0, this.player.trail.length - 50)) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            }
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
        }
    }
    
    renderPlayer() {
        if (!this.assets.ninjas) return;
        
        const frameWidth = this.assets.ninjas.width / 8;
        const frameHeight = this.assets.ninjas.height / 4;
        const frame = Math.floor(this.player.frame);
        
        this.ctx.save();
        
        if (this.player.cloaked) {
            this.ctx.globalAlpha = 0.3;
        }
        
        this.ctx.drawImage(
            this.assets.ninjas,
            frame * frameWidth, 0,
            frameWidth, frameHeight,
            this.player.x - this.player.width / 2,
            this.player.y - this.player.height / 2,
            this.player.width, this.player.height
        );
        
        this.ctx.restore();
    }
    
    renderClones() {
        if (!this.assets.clones) return;
        
        const frameWidth = this.assets.clones.width / 10;
        const frameHeight = this.assets.clones.height / 3;
        
        this.clones.forEach(clone => {
            const row = clone.type === 'idle' ? 0 : clone.type === 'wraith' ? 1 : 2;
            const frame = Math.floor(clone.frame);
            
            this.ctx.save();
            
            if (this.settings.graphicsQuality === 'high') {
                // Add shadow/glow effect
                this.ctx.shadowColor = clone.type === 'wraith' ? '#e74c3c' : clone.type === 'ghost' ? '#9b59b6' : '#f39c12';
                this.ctx.shadowBlur = 15;
            }
            
            this.ctx.drawImage(
                this.assets.clones,
                frame * frameWidth, row * frameHeight,
                frameWidth, frameHeight,
                clone.x - frameWidth / 2,
                clone.y - frameHeight / 2,
                frameWidth, frameHeight
            );
            
            this.ctx.restore();
        });
    }
    
    renderPortal() {
        if (!this.assets.portal) return;
        
        this.portal.frame += 0.2;
        if (this.portal.frame >= 8) this.portal.frame = 0;
        
        this.ctx.save();
        
        if (this.settings.graphicsQuality === 'high') {
            this.ctx.shadowColor = '#4a90e2';
            this.ctx.shadowBlur = 20;
        }
        
        const size = 60;
        this.ctx.drawImage(
            this.assets.portal,
            0, 0,
            this.assets.portal.width, this.assets.portal.height,
            this.portal.x - size / 2,
            this.portal.y - size / 2,
            size, size
        );
        
        this.ctx.restore();
    }
    
    renderPowerups() {
        this.powerups.forEach(powerup => {
            if (powerup.collected) return;
            
            powerup.bobOffset += 0.1;
            const bobY = Math.sin(powerup.bobOffset) * 5;
            
            let asset;
            switch(powerup.type) {
                case 'speed': asset = this.assets.powerup_speed; break;
                case 'cloak': asset = this.assets.powerup_cloak; break;
                case 'life': asset = this.assets.powerup_life; break;
            }
            
            if (!asset) return;
            
            this.ctx.save();
            
            if (this.settings.graphicsQuality === 'high') {
                this.ctx.shadowColor = powerup.type === 'speed' ? '#f1c40f' : powerup.type === 'cloak' ? '#9b59b6' : '#e74c3c';
                this.ctx.shadowBlur = 10;
            }
            
            const size = 32;
            this.ctx.drawImage(
                asset,
                0, 0,
                asset.width, asset.height,
                powerup.x - size / 2,
                powerup.y - size / 2 + bobY,
                size, size
            );
            
            this.ctx.restore();
        });
    }
    
    renderParticles() {
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            
            if (particle.type === 'smoke') {
                this.ctx.fillStyle = '#bdc3c7';
            } else if (particle.type === 'sparkle') {
                this.ctx.fillStyle = '#4a90e2';
                if (this.settings.graphicsQuality === 'high') {
                    this.ctx.shadowColor = '#4a90e2';
                    this.ctx.shadowBlur = 5;
                }
            }
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    renderMinimap() {
        const minimap = document.getElementById('miniMap');
        const rect = minimap.getBoundingClientRect();
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(rect.right - 170, rect.bottom - 170, 150, 150);
        this.ctx.strokeStyle = '#4a90e2';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(rect.right - 170, rect.bottom - 170, 150, 150);
        
        const scale = 150 / (this.mazeWidth * this.cellSize);
        const offsetX = rect.right - 170 + 5;
        const offsetY = rect.bottom - 170 + 5;
        
        // Draw maze walls
        this.ctx.fillStyle = '#34495e';
        for (let y = 0; y < this.mazeHeight; y++) {
            for (let x = 0; x < this.mazeWidth; x++) {
                if (this.maze[y][x] === 1) {
                    this.ctx.fillRect(
                        offsetX + x * this.cellSize * scale,
                        offsetY + y * this.cellSize * scale,
                        this.cellSize * scale,
                        this.cellSize * scale
                    );
                }
            }
        }
        
        // Draw portal
        this.ctx.fillStyle = '#4a90e2';
        this.ctx.beginPath();
        this.ctx.arc(
            offsetX + this.portal.x * scale,
            offsetY + this.portal.y * scale,
            3, 0, Math.PI * 2
        );
        this.ctx.fill();
        
        // Draw clones
        this.ctx.fillStyle = '#e74c3c';
        this.clones.forEach(clone => {
            this.ctx.beginPath();
            this.ctx.arc(
                offsetX + clone.x * scale,
                offsetY + clone.y * scale,
                2, 0, Math.PI * 2
            );
            this.ctx.fill();
        });
        
        // Draw player
        this.ctx.fillStyle = '#50c878';
        this.ctx.beginPath();
        this.ctx.arc(
            offsetX + this.player.x * scale,
            offsetY + this.player.y * scale,
            3, 0, Math.PI * 2
        );
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    updateHUD() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('livesValue').textContent = this.lives;
    }
    
    togglePause() {
        if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
        
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this.gameState = 'paused';
            document.getElementById('pauseMenu').classList.remove('hidden');
        } else {
            this.gameState = 'playing';
            document.getElementById('pauseMenu').classList.add('hidden');
        }
    }
    
    restartGame() {
        this.hideAllMenus();
        this.startGame();
    }
    
    returnToMainMenu() {
        this.gameState = 'menu';
        this.hideAllMenus();
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
        
        if (this.audio.music && this.audio.music.paused) {
            this.audio.music.play().catch(() => {});
        }
    }
    
    showSettings() {
        document.getElementById('settingsMenu').classList.remove('hidden');
        this.loadSettingsUI();
    }
    
    showLeaderboard() {
        document.getElementById('leaderboardMenu').classList.remove('hidden');
        this.loadLeaderboard();
    }
    
    showHowToPlay() {
        document.getElementById('howToPlayMenu').classList.remove('hidden');
    }
    
    loadSettingsUI() {
        document.getElementById('musicVolume').value = Math.round(this.settings.musicVolume * 100);
        document.getElementById('musicVolumeValue').textContent = Math.round(this.settings.musicVolume * 100);
        document.getElementById('sfxVolume').value = Math.round(this.settings.sfxVolume * 100);
        document.getElementById('sfxVolumeValue').textContent = Math.round(this.settings.sfxVolume * 100);
        document.getElementById('graphicsQuality').value = this.settings.graphicsQuality;
    }
    
    updateMusicVolume(value) {
        this.settings.musicVolume = value / 100;
        document.getElementById('musicVolumeValue').textContent = value;
        if (this.audio.music) {
            this.audio.music.volume = this.settings.musicVolume;
        }
        this.saveSettings();
    }
    
    updateSfxVolume(value) {
        this.settings.sfxVolume = value / 100;
        document.getElementById('sfxVolumeValue').textContent = value;
        Object.keys(this.audio).forEach(key => {
            if (key !== 'music' && this.audio[key]) {
                this.audio[key].volume = this.settings.sfxVolume;
            }
        });
        this.saveSettings();
    }
    
    updateGraphicsQuality(value) {
        this.settings.graphicsQuality = value;
        this.saveSettings();
    }
    
    loadSettings() {
        const saved = localStorage.getItem('shadowCloneSettings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    }
    
    saveSettings() {
        localStorage.setItem('shadowCloneSettings', JSON.stringify(this.settings));
    }
    
    loadLeaderboard() {
        const scores = JSON.parse(localStorage.getItem('shadowCloneScores') || '[]');
        const leaderboardList = document.getElementById('leaderboardList');
        
        if (scores.length === 0) {
            leaderboardList.innerHTML = '<div class="leaderboard-item"><span class="name">No scores yet!</span></div>';
            return;
        }
        
        scores.sort((a, b) => b.score - a.score);
        scores.splice(10); // Keep only top 10
        
        leaderboardList.innerHTML = scores.map((score, index) => `
            <div class="leaderboard-item">
                <span class="rank">${index + 1}.</span>
                <span class="name">Player</span>
                <span class="score">${score.score}</span>
            </div>
        `).join('');
    }
    
    saveScore() {
        const scores = JSON.parse(localStorage.getItem('shadowCloneScores') || '[]');
        scores.push({
            score: this.score,
            level: this.level,
            date: new Date().toISOString()
        });
        localStorage.setItem('shadowCloneScores', JSON.stringify(scores));
    }
    
    playSound(soundName) {
        if (this.audio[soundName] && this.settings.sfxVolume > 0) {
            const sound = this.audio[soundName].cloneNode();
            sound.volume = this.settings.sfxVolume;
            sound.play().catch(() => {});
        }
    }
    
    getDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    gameLoop() {
        const currentTime = performance.now();
        const deltaTime = currentTime - (this.lastTime || currentTime);
        this.lastTime = currentTime;
        
        if (this.gameState === 'playing') {
            this.gameTime += deltaTime;
            this.score += Math.floor(deltaTime / 100);
            this.updateHUD();
            
            this.updatePlayer(deltaTime);
            this.updateClones(deltaTime);
            this.updateParticles(deltaTime);
        }
        
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ShadowCloneEscape();
});

// Prevent context menu on mobile
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Prevent scrolling on mobile
document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.mobile-controls, .overlay-menu')) return;
    e.preventDefault();
}, { passive: false });

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.game && window.game.gameState === 'playing') {
        window.game.togglePause();
    }
});

// Export game instance for debugging
window.addEventListener('load', () => {
    window.game = document.game;
});
