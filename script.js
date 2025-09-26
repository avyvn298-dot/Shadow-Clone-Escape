const clone = {
            type: type,
            path: [...clonePath],
            pathIndex: 0,
            x: clonePath[0].x,
            y: clonePath[0].y,
            pixelX: 0,
            pixelY: 0,
            stepTimer: 0,
            stepDelay: 180, // Base delay for clones
            frame: Math.floor(Math.random() * 3),
            dead: false
        };
        
        // Adjust clone behavior based on type
        switch (type) {
            case 'fast':
                clone.stepDelay = 120; // Faster movement
                break;
            case 'wraith':
                clone.stepDelay = 160; // Normal speed but can jump
                break;
            default: // basic
                clone.stepDelay = 180;
        }
        
        clone.pixelX = clone.x * this.cellSize + this.cellSize / 2;
        clone.pixelY = clone.y * this.cellSize + this.cellSize / 2;
        
        this.clones.push(clone);
        this.playSound('spawn');
        
        // Add spawn particles
        if (this.settings.particlesEnabled) {
            this.addParticles(clone.pixelX, clone.pixelY, 'smoke', 15);
        }
        
        console.log(`👥 Spawned ${type} clone at (${clone.x}, ${clone.y})`);
    }
    
    updateClone(clone, deltaTime) {
        clone.stepTimer += deltaTime;
        
        // Move clone along its path
        if (clone.stepTimer >= clone.stepDelay && clone.pathIndex < clone.path.length - 1) {
            // Special behavior for different clone types
            if (clone.type === 'fast' && Math.random() < 0.3) {
                // Fast clone sometimes double-steps
                clone.pathIndex = Math.min(clone.pathIndex + 2, clone.path.length - 1);
            } else if (clone.type === 'wraith' && Math.random() < 0.15) {
                // Wraith clone randomly jumps forward
                const jumpDistance = Math.min(28, clone.path.length - clone.pathIndex - 1);
                if (jumpDistance > 0) {
                    clone.pathIndex = Math.min(clone.pathIndex + jumpDistance, clone.path.length - 1);
                    if (this.settings.particlesEnabled) {
                        this.addParticles(clone.pixelX, clone.pixelY, 'smoke', 8);
                    }
                }
            } else {
                // Normal step
                clone.pathIndex++;
            }
            
            // Update clone position
            if (clone.pathIndex < clone.path.length) {
                const pathPoint = clone.path[clone.pathIndex];
                clone.x = pathPoint.x;
                clone.y = pathPoint.y;
                clone.pixelX = clone.x * this.cellSize + this.cellSize / 2;
                clone.pixelY = clone.y * this.cellSize + this.cellSize / 2;
            }
            
            clone.stepTimer = 0;
        }
        
        // Update animation
        clone.frame += deltaTime / 200;
        if (clone.frame >= 3) clone.frame = 0;
    }
    
    updatePowerups(deltaTime) {
        this.powerups.forEach(powerup => {
            if (!powerup.collected) {
                // Bob animation
                powerup.bobTimer += deltaTime / 1000;
            }
        });
        
        // Update active powerup timer
        if (this.activePowerup) {
            this.powerupTimer -= deltaTime;
            
            if (this.powerupTimer <= 0) {
                this.activePowerup = null;
                this.updatePowerupDisplay();
            }
        }
    }
    
    updatePortal(deltaTime) {
        this.portal.animTimer += deltaTime;
        if (this.portal.animTimer >= 100) {
            this.portal.frame = (this.portal.frame + 1) % 8;
            this.portal.animTimer = 0;
        }
    }
    
    updateParticles(deltaTime) {
        if (!this.settings.particlesEnabled) {
            this.particles = [];
            return;
        }
        
        this.particles.forEach(particle => {
            particle.x += particle.vx * deltaTime / 16.67;
            particle.y += particle.vy * deltaTime / 16.67;
            particle.life -= deltaTime;
            particle.alpha = Math.max(0, particle.life / particle.maxLife);
            particle.size *= 0.998; // Gradually shrink
        });
        
        // Remove dead particles
        this.particles = this.particles.filter(p => p.life > 0);
        
        // Limit particle count
        if (this.particles.length > this.maxParticles) {
            this.particles.splice(0, this.particles.length - this.maxParticles);
        }
    }
    
    // Collision Detection
    checkPowerupCollision() {
        this.powerups.forEach(powerup => {
            if (!powerup.collected && powerup.x === this.player.x && powerup.y === this.player.y) {
                powerup.collected = true;
                this.collectPowerup(powerup.type);
                this.playSound('powerup');
                
                if (this.settings.particlesEnabled) {
                    this.addParticles(
                        this.player.pixelX, 
                        this.player.pixelY, 
                        'sparkle', 
                        12
                    );
                }
            }
        });
    }
    
    checkPortalCollision() {
        if (this.player.x === this.portal.x && this.player.y === this.portal.y) {
            this.levelComplete();
            
            if (this.settings.particlesEnabled) {
                this.addParticles(
                    this.player.pixelX, 
                    this.player.pixelY, 
                    'sparkle', 
                    20
                );
            }
        }
    }
    
    checkCloneCollisions() {
        if (this.player.cloaked) return; // Invulnerable when cloaked
        
        this.clones.forEach(clone => {
            if (clone.x === this.player.x && clone.y === this.player.y) {
                this.gameOver();
                
                if (this.settings.particlesEnabled) {
                    this.addParticles(
                        this.player.pixelX, 
                        this.player.pixelY, 
                        'fire', 
                        25
                    );
                }
            }
        });
    }
    
    // Powerup System
    collectPowerup(type) {
        switch (type) {
            case 'speed':
                this.player.speedBoost = true;
                this.player.speedBoostTimer = 4500; // 4.5 seconds
                this.activePowerup = { type: 'speed', timer: 4500 };
                console.log('⚡ Speed boost activated!');
                break;
                
            case 'cloak':
                this.player.cloaked = true;
                this.player.cloakTimer = 5000; // 5 seconds
                this.activePowerup = { type: 'cloak', timer: 5000 };
                console.log('👻 Cloak activated!');
                break;
                
            case 'shock':
                // Knock all clones back by 28 steps (minimum 0)
                this.clones.forEach(clone => {
                    clone.pathIndex = Math.max(0, clone.pathIndex - 28);
                    if (clone.pathIndex < clone.path.length) {
                        const pathPoint = clone.path[clone.pathIndex];
                        clone.x = pathPoint.x;
                        clone.y = pathPoint.y;
                        clone.pixelX = clone.x * this.cellSize + this.cellSize / 2;
                        clone.pixelY = clone.y * this.cellSize + this.cellSize / 2;
                    }
                });
                
                // Add visual effect
                if (this.settings.particlesEnabled) {
                    this.clones.forEach(clone => {
                        this.addParticles(clone.pixelX, clone.pixelY, 'sparkle', 8);
                    });
                }
                
                console.log('💥 Shock wave activated! Knocked back all clones');
                break;
        }
        
        this.powerupTimer = this.activePowerup ? this.activePowerup.timer : 0;
        this.updatePowerupDisplay();
    }
    
    updatePowerupDisplay() {
        const powerupBox = document.getElementById('powerupBox');
        const powerupIcon = document.getElementById('powerupIcon');
        const powerupTimer = document.getElementById('powerupTimer');
        
        if (!powerupBox || !powerupIcon || !powerupTimer) return;
        
        if (this.activePowerup) {
            powerupBox.classList.add('active');
            powerupIcon.className = `powerup-icon ${this.activePowerup.type}`;
            
            const secondsLeft = Math.ceil(this.powerupTimer / 1000);
            powerupTimer.textContent = `${secondsLeft}s`;
        } else {
            powerupBox.classList.remove('active');
            powerupIcon.className = 'powerup-icon';
            powerupTimer.textContent = '';
        }
    }
    
    // Particle System
    addParticles(x, y, type, count) {
        if (!this.settings.particlesEnabled) return;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 1;
            const life = 1000 + Math.random() * 1500;
            
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1, // Slight upward bias
                type: type,
                life: life,
                maxLife: life,
                alpha: 1,
                size: Math.random() * 4 + 2,
                color: this.getParticleColor(type)
            });
        }
    }
    
    getParticleColor(type) {
        switch (type) {
            case 'smoke': return '#888888';
            case 'sparkle': return '#00ff88';
            case 'fire': return '#ff4444';
            default: return '#ffffff';
        }
    }
    
    // Rendering System
    render() {
        if (!this.ctx || !this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        if (this.gameState === 'playing' || this.gameState === 'paused' || this.gameState === 'levelComplete') {
            this.renderGame();
            this.renderMinimap();
        }
    }
    
    renderGame() {
        const rect = this.canvas.getBoundingClientRect();
        
        // Calculate camera position (center on player)
        const cameraX = rect.width / 2 / devicePixelRatio - this.player.pixelX;
        const cameraY = rect.height / 2 / devicePixelRatio - this.player.pixelY;
        
        this.ctx.save();
        this.ctx.translate(cameraX, cameraY);
        
        // Render maze
        this.renderMaze();
        
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
        
        // Render pause overlay if paused
        if (this.isPaused) {
            this.renderPauseOverlay();
        }
    }
    
    renderMaze() {
        // Use cached maze if available
        if (this.mazeCache) {
            this.ctx.drawImage(this.mazeCache, 0, 0);
            return;
        }
        
        // Render maze directly
        for (let y = 0; y < this.mazeHeight; y++) {
            for (let x = 0; x < this.mazeWidth; x++) {
                if (!this.maze[y]) continue;
                
                const cellX = x * this.cellSize;
                const cellY = y * this.cellSize;
                
                if (this.maze[y][x] === 1) {
                    // Wall
                    this.ctx.fillStyle = '#2c3e50';
                    this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                    
                    this.ctx.strokeStyle = '#34495e';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(cellX, cellY, this.cellSize, this.cellSize);
                } else {
                    // Floor
                    this.ctx.fillStyle = '#1a1a1a';
                    this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                }
            }
        }
    }
    
    cacheMazeRendering() {
        if (!document.createElement) return;
        
        this.mazeCache = document.createElement('canvas');
        this.mazeCache.width = this.mazeWidth * this.cellSize;
        this.mazeCache.height = this.mazeHeight * this.cellSize;
        
        const cacheCtx = this.mazeCache.getContext('2d');
        cacheCtx.imageSmoothingEnabled = false;
        
        // Render maze to cache
        for (let y = 0; y < this.mazeHeight; y++) {
            for (let x = 0; x < this.mazeWidth; x++) {
                if (!this.maze[y]) continue;
                
                const cellX = x * this.cellSize;
                const cellY = y * this.cellSize;
                
                if (this.maze[y][x] === 1) {
                    // Wall
                    cacheCtx.fillStyle = '#2c3e50';
                    cacheCtx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                    
                    cacheCtx.strokeStyle = '#34495e';
                    cacheCtx.lineWidth = 1;
                    cacheCtx.strokeRect(cellX, cellY, this.cellSize, this.cellSize);
                } else {
                    // Floor
                    cacheCtx.fillStyle = '#1a1a1a';
                    cacheCtx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                }
            }
        }
        
        console.log('🖼️ Maze rendering cached');
    }
    
    renderPlayer() {
        if (!this.images.ninja) {
            // Fallback rendering
            this.ctx.fillStyle = this.player.cloaked ? '#ff00ff80' : '#00ff88';
            this.ctx.fillRect(
                this.player.pixelX - 15, 
                this.player.pixelY - 15, 
                30, 30
            );
            return;
        }
        
        const frameWidth = 384; // 1536 / 4 frames
        const frameHeight = 534;
        const frame = Math.floor(this.player.facing) % 4;
        
        this.ctx.save();
        
        if (this.player.cloaked) {
            this.ctx.globalAlpha = 0.4;
            this.ctx.filter = 'hue-rotate(270deg)'; // Purple tint when cloaked
        }
        
        this.ctx.drawImage(
            this.images.ninja,
            frame * frameWidth, 0,
            frameWidth, frameHeight,
            this.player.pixelX - 25,
            this.player.pixelY - 35,
            50, 70
        );
        
        this.ctx.restore();
        
        // Update facing direction for animation
        if (this.player.moving) {
            this.player.facing += 0.2;
        }
    }
    
    renderClones() {
        if (!this.images.clones) {
            // Fallback rendering
            this.clones.forEach((clone, index) => {
                const colors = ['#ff4444', '#ff8800', '#8800ff'];
                this.ctx.fillStyle = colors[index % colors.length];
                this.ctx.fillRect(
                    clone.pixelX - 12, 
                    clone.pixelY - 12, 
                    24, 24
                );
            });
            return;
        }
        
        const frameWidth = 353; // 1060 / 3 frames (should be floor(1060/3))
        const frameHeight = 433;
        
        this.clones.forEach(clone => {
            let row = 0;
            switch (clone.type) {
                case 'fast': row = 1; break;
                case 'wraith': row = 2; break;
                default: row = 0; // basic
            }
            
            const frame = Math.floor(clone.frame);
            
            this.ctx.save();
            
            // Add glow effect based on clone type
            if (clone.type === 'wraith') {
                this.ctx.shadowColor = '#8800ff';
                this.ctx.shadowBlur = 10;
            } else if (clone.type === 'fast') {
                this.ctx.shadowColor = '#ff8800';
                this.ctx.shadowBlur = 8;
            } else {
                this.ctx.shadowColor = '#ff4444';
                this.ctx.shadowBlur = 6;
            }
            
            this.ctx.drawImage(
                this.images.clones,
                0, row * frameHeight, // Use first frame for now (static)
                frameWidth, frameHeight,
                clone.pixelX - 25,
                clone.pixelY - 35,
                50, 70
            );
            
            this.ctx.restore();
        });
    }
    
    renderPowerups() {
        this.powerups.forEach(powerup => {
            if (powerup.collected) return;
            
            const bobOffset = Math.sin(powerup.bobTimer) * 3;
            const x = powerup.x * this.cellSize + this.cellSize / 2;
            const y = powerup.y * this.cellSize + this.cellSize / 2 + bobOffset;
            
            const imageKey = `powerup${powerup.type.charAt(0).toUpperCase() + powerup.type.slice(1)}`;
            
            if (this.images[imageKey]) {
                this.ctx.save();
                
                // Add glow effect
                this.ctx.shadowColor = this.getPowerupColor(powerup.type);
                this.ctx.shadowBlur = 15;
                
                this.ctx.drawImage(
                    this.images[imageKey],
                    0, 0,
                    64, 64,
                    x - 16,
                    y - 16,
                    32, 32
                );
                
                this.ctx.restore();
            } else {
                // Fallback rendering
                this.ctx.fillStyle = this.getPowerupColor(powerup.type);
                this.ctx.fillRect(x - 8, y - 8, 16, 16);
            }
        });
    }
    
    getPowerupColor(type) {
        switch (type) {
            case 'speed': return '#ffaa00';
            case 'cloak': return '#ff0088';
            case 'shock': return '#0088ff';
            default: return '#ffffff';
        }
    }
    
    renderPortal() {
        const x = this.portal.x * this.cellSize + this.cellSize / 2;
        const y = this.portal.y * this.cellSize + this.cellSize / 2;
        
        if (this.images.portal) {
            this.ctx.save();
            
            // Add pulsing glow
            this.ctx.shadowColor = '#00ff88';
            this.ctx.shadowBlur = 20 + Math.sin(Date.now() / 200) * 10;
            
            this.ctx.drawImage(
                this.images.portal,
                0, 0,
                361, 316,
                x - 30,
                y - 25,
                60, 50
            );
            
            this.ctx.restore();
        } else {
            // Fallback rendering
            this.ctx.save();
            this.ctx.fillStyle = '#00ff88';
            this.ctx.shadowColor = '#00ff88';
            this.ctx.shadowBlur = 20;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 15, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }
    
    renderParticles() {
        if (!this.settings.particlesEnabled) return;
        
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            
            if (particle.type === 'sparkle') {
                this.ctx.shadowColor = particle.color;
                this.ctx.shadowBlur = 5;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
    
    renderPauseOverlay() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, rect.width / devicePixelRatio, rect.height / devicePixelRatio);
        
        this.ctx.fillStyle = '#00ff88';
        this.ctx.font = 'bold 48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('PAUSED', rect.width / 2 / devicePixelRatio, rect.height / 2 / devicePixelRatio);
    }
    
    renderMinimap() {
        if (!this.miniMapCtx || !this.miniMapCanvas) return;
        
        const mapWidth = this.miniMapCanvas.width;
        const mapHeight = this.miniMapCanvas.height;
        
        this.miniMapCtx.clearRect(0, 0, mapWidth, mapHeight);
        
        // Calculate scale
        const scaleX = mapWidth / (this.mazeWidth * this.cellSize);
        const scaleY = mapHeight / (this.mazeHeight * this.cellSize);
        const scale = Math.min(scaleX, scaleY);
        
        const offsetX = (mapWidth - this.mazeWidth * this.cellSize * scale) / 2;
        const offsetY = (mapHeight - this.mazeHeight * this.cellSize * scale) / 2;
        
        // Render maze walls
        this.miniMapCtx.fillStyle = '#444';
        for (let y = 0; y < this.mazeHeight; y++) {
            for (let x = 0; x < this.mazeWidth; x++) {
                if (this.maze[y] && this.maze[y][x] === 1) {
                    this.miniMapCtx.fillRect(
                        offsetX + x * this.cellSize * scale,
                        offsetY + y * this.cellSize * scale,
                        this.cellSize * scale,
                        this.cellSize * scale
                    );
                }
            }
        }
        
        // Render portal
        this.miniMapCtx.fillStyle = '#00ff88';
        this.miniMapCtx.fillRect(
            offsetX + this.portal.x * this.cellSize * scale - 2,
            offsetY + this.portal.y * this.cellSize * scale - 2,
            4, 4
        );
        
        // Render powerups
        this.miniMapCtx.fillStyle = '#ffaa00';
        this.powerups.forEach(powerup => {
            if (!powerup.collected) {
                this.miniMapCtx.fillRect(
                    offsetX + powerup.x * this.cellSize * scale - 1,
                    offsetY + powerup.y * this.cellSize * scale - 1,
                    2, 2
                );
            }
        });
        
        // Render clones
        this.miniMapCtx.fillStyle = '#ff4444';
        this.clones.forEach(clone => {
            this.miniMapCtx.fillRect(
                offsetX + clone.x * this.cellSize * scale - 1,
                offsetY + clone.y * this.cellSize * scale - 1,
                2, 2
            );
        });
        
        // Render player
        this.miniMapCtx.fillStyle = this.player.cloaked ? '#ff00ff' : '#ffffff';
        this.miniMapCtx.fillRect(
            offsetX + this.player.x * this.cellSize * scale - 2,
            offsetY + this.player.y * this.cellSize * scale - 2,
            4, 4
        );
    }
    
    // UI Updates
    updateHUD() {
        // Update timer
        const timerEl = document.getElementById('timer');
        if (timerEl) {
            timerEl.textContent = this.formatTime(this.gameTime);
        }
        
        // Update best time
        const bestTimeEl = document.getElementById('bestTime');
        if (bestTimeEl) {
            bestTimeEl.textContent = this.bestTime === Infinity ? '--:--' : this.formatTime(this.bestTime);
        }
        
        // Update status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = `LEVEL ${this.currentLevel}`;
        }
        
        // Update powerup display
        this.updatePowerupDisplay();
    }
    
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Audio System
    startMusic() {
        if (!this.settings.musicEnabled || !this.sounds.bgMusic) return;
        
        this.sounds.bgMusic.volume = this.settings.musicVolume;
        this.sounds.bgMusic.play().catch(() => {
            console.log('🔇 Music autoplay blocked by browser');
        });
    }
    
    stopMusic() {
        if (this.sounds.bgMusic) {
            this.sounds.bgMusic.pause();
            this.sounds.bgMusic.currentTime = 0;
        }
    }
    
    updateMusicState() {
        if (!this.sounds.bgMusic) return;
        
        this.sounds.bgMusic.volume = this.settings.musicVolume;
        
        if (this.settings.musicEnabled && this.gameState === 'menu') {
            this.startMusic();
        } else if (!this.settings.musicEnabled) {
            this.stopMusic();
        }
    }
    
    playSound(soundName) {
        if (!this.settings.sfxEnabled || !this.sounds[soundName]) return;
        
        const sound = this.sounds[soundName];
        if (sound.play) {
            sound.volume = this.settings.sfxVolume;
            sound.currentTime = 0;
            sound.play().catch(() => {});
        }
    }
    
    // Settings System
    loadSettings() {
        const saved = localStorage.getItem('shadowCloneSettings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
                console.log('⚙️ Settings loaded from localStorage');
            } catch (e) {
                console.warn('⚠️ Failed to parse saved settings');
            }
        }
    }
    
    saveSettings() {
        localStorage.setItem('shadowCloneSettings', JSON.stringify(this.settings));
        console.log('💾 Settings saved to localStorage');
    }
    
    resetSettings() {
        this.settings = {
            musicEnabled: true,
            musicVolume: 0.7,
            sfxEnabled: true,
            sfxVolume: 0.8,
            difficulty: 'normal',
            particlesEnabled: true,
            joystickSensitivity: 1.0
        };
        this.saveSettings();
        
        // Reload settings UI
        this.setupSettingsListeners();
        console.log('🔄 Settings reset to defaults');
    }
    
    // Difficulty System
    getDifficultyMultiplier() {
        switch (this.settings.difficulty) {
            case 'easy': return 0.7;
            case 'hard': return 1.3;
            case 'nightmare': return 1.6;
            default: return 1.0; // normal
        }
    }
    
    // High Score System
    isNewHighScore(time, level) {
        const scores = this.getHighScores();
        
        if (scores.length < 10) return true;
        
        // Check if this time/level combination beats any existing score
        const score = { time, level, totalScore: level * 1000 + (300000 - time) };
        return scores.some(s => score.totalScore > s.totalScore);
    }
    
    getHighScores() {
        const saved = localStorage.getItem('shadowCloneScores');
        try {
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }
    
    saveHighScore(name, time, level) {
        const scores = this.getHighScores();
        const newScore = {
            name: name || 'NINJA',
            time,
            level,
            totalScore: level * 1000 + (300000 - time),
            date: Date.now()
        };
        
        scores.push(newScore);
        scores.sort((a, b) => b.totalScore - a.totalScore);
        scores.splice(10); // Keep only top 10
        
        localStorage.setItem('shadowCloneScores', JSON.stringify(scores));
        
        // Update best time if this is better
        if (time < this.bestTime) {
            this.bestTime = time;
            localStorage.setItem('shadowCloneBestTime', time.toString());
        }
        
        console.log(`🏆 High score saved: ${name} - Level ${level} in ${this.formatTime(time)}`);
    }
    
    submitHighScore() {
        const nameInput = document.getElementById('playerNameInput');
        const name = nameInput ? nameInput.value.trim() || 'NINJA' : 'NINJA';
        
        this.saveHighScore(name, this.gameTime, this.currentLevel);
        
        // Hide name input
        const nameInputContainer = document.getElementById('nameInputContainer');
        if (nameInputContainer) nameInputContainer.style.display = 'none';
        
        // Update leaderboard display
        this.showLeaderboard();
        
        console.log(`📝 High score submitted for ${name}`);
    }
    
    // Menu Systems
    showSettings() {
        this.showModal('settingsMenu');
        this.loadSettingsUI();
    }
    
    loadSettingsUI() {
        // Load current settings into UI elements
        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle) musicToggle.checked = this.settings.musicEnabled;
        
        const musicVolume = document.getElementById('musicVolume');
        const musicVolumeValue = document.getElementById('musicVolumeValue');
        if (musicVolume && musicVolumeValue) {
            musicVolume.value = this.settings.musicVolume * 100;
            musicVolumeValue.textContent = Math.round(this.settings.musicVolume * 100) + '%';
        }
        
        const sfxToggle = document.getElementById('sfxToggle');
        if (sfxToggle) sfxToggle.checked = this.settings.sfxEnabled;
        
        const sfxVolume = document.getElementById('sfxVolume');
        const sfxVolumeValue = document.getElementById('sfxVolumeValue');
        if (sfxVolume && sfxVolumeValue) {
            sfxVolume.value = this.settings.sfxVolume * 100;
            sfxVolumeValue.textContent = Math.round(this.settings.sfxVolume * 100) + '%';
        }
        
        const difficultySelect = document.getElementById('difficultySelect');
        if (difficultySelect) difficultySelect.value = this.settings.difficulty;
        
        const particlesToggle = document.getElementById('particlesToggle');
        if (particlesToggle) particlesToggle.checked = this.settings.particlesEnabled;
        
        const joystickSensitivity = document.getElementById('joystickSensitivity');
        const joystickSensitivityValue = document.getElementById('joystickSensitivityValue');
        if (joystickSensitivity && joystickSensitivityValue) {
            joystickSensitivity.value = this.settings.joystickSensitivity;
            joystickSensitivityValue.textContent = this.settings.joystickSensitivity.toFixed(1) + 'x';
        }
    }
    
    showLeaderboard() {
        this.showModal('leaderboardMenu');
        this.loadLeaderboardData();
    }
    
    loadLeaderboardData() {
        const scores = this.getHighScores();
        const leaderboardList = document.getElementById('leaderboardList');
        
        if (!leaderboardList) return;
        
        if (scores.length === 0) {
            leaderboardList.innerHTML = `
                <div class="leaderboard-entry">
                    <div class="entry-rank">-</div>
                    <div class="entry-name">No scores yet!</div>
                    <div class="entry-time">--:--</div>
                    <div class="entry-level">-</div>
                </div>
            `;
            return;
        }
        
        leaderboardList.innerHTML = scores.map((score, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            return `
                <div class="leaderboard-entry">
                    <div class="entry-rank ${rankClass}">${index + 1}</div>
                    <div class="entry-name">${score.name}</div>
                    <div class="entry-time">${this.formatTime(score.time)}</div>
                    <div class="entry-level">${score.level}</div>
                </div>
            `;
        }).join('');
    }
    
    showHowToPlay() {
        this.showModal('howToPlayMenu');
    }
    
    // Main Game Loop
    gameLoop() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / (deltaTime || 16.67));
        }
        
        // Update game systems
        this.update(deltaTime);
        
        // Render game
        this.render();
        
        // Continue game loop
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM loaded - Starting Shadow Clone Escape');
    
    // Prevent touch scroll on mobile
    document.addEventListener('touchmove', (e) => {
        if (e.target.closest('.mobile-controls') || e.target.closest('.overlay-menu')) {
            return; // Allow scrolling in controls and menus
        }
        e.preventDefault();
    }, { passive: false });
    
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = new Date().getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Initialize the game
    window.shadowCloneGame = new ShadowCloneEscape();
    
    console.log('🎮 Shadow Clone Escape initialized successfully');
});

// Handle page visibility changes (auto-pause)
document.addEventListener('visibilitychange', () => {
    if (window.shadowCloneGame && document.hidden && window.shadowCloneGame.gameState === 'playing') {
        window.shadowCloneGame.pauseGame();
    }
});

// Handle browser back button
window.addEventListener('popstate', (e) => {
    if (window.shadowCloneGame && window.shadowCloneGame.gameState !== 'menu') {
        e.preventDefault();
        if (window.shadowCloneGame.gameState === 'playing') {
            window.shadowCloneGame.pauseGame();
        } else {
            window.shadowCloneGame.returnToMainMenu();
        }
    }
});

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShadowCloneEscape;
}

console.log('📜 Shadow Clone Escape script loaded successfully');
        // Difficulty select
        const difficultySelect = document.getElementById('difficultySelect');
        if (difficultySelect) {
            difficultySelect.value = this.settings.difficulty;
            difficultySelect.addEventListener('change', (e) => {
                this.settings.difficulty = e.target.value;
                this.saveSettings();
            });
        }
        
        // Particles toggle
        const particlesToggle = document.getElementById('particlesToggle');
        if (particlesToggle) {
            particlesToggle.checked = this.settings.particlesEnabled;
            particlesToggle.addEventListener('change', (e) => {
                this.settings.particlesEnabled = e.target.checked;
                this.saveSettings();
            });
        }
        
        // Joystick sensitivity
        const joystickSensitivity = document.getElementById('joystickSensitivity');
        const joystickSensitivityValue = document.getElementById('joystickSensitivityValue');
        if (joystickSensitivity && joystickSensitivityValue) {
            joystickSensitivity.value = this.settings.joystickSensitivity;
            joystickSensitivityValue.textContent = this.settings.joystickSensitivity.toFixed(1) + 'x';
            joystickSensitivity.addEventListener('input', (e) => {
                this.settings.joystickSensitivity = parseFloat(e.target.value);
                joystickSensitivityValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
                this.saveSettings();
            });
        }
        
        // Reset settings
        const resetSettingsBtn = document.getElementById('resetSettingsBtn');
        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => {
                if (confirm('Reset all settings to default?')) {
                    this.resetSettings();
                }
            });
        }
    }
    
    setupMobileControls() {
        if (!this.isMobile) return;
        
        const joystick = document.getElementById('joystick');
        const joystickKnob = document.getElementById('joystickKnob');
        
        if (!joystick || !joystickKnob) return;
        
        const updateJoystick = (clientX, clientY) => {
            const rect = joystick.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const deltaX = clientX - centerX;
            const deltaY = clientY - centerY;
            const distance = Math.min(Math.sqrt(deltaX * deltaX + deltaY * deltaY), 40);
            
            this.joystick.angle = Math.atan2(deltaY, deltaX);
            this.joystick.distance = distance / 40;
            
            const knobX = Math.cos(this.joystick.angle) * distance;
            const knobY = Math.sin(this.joystick.angle) * distance;
            
            joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
        };
        
        const resetJoystick = () => {
            this.joystick.active = false;
            this.joystick.distance = 0;
            joystickKnob.style.transform = 'translate(-50%, -50%)';
        };
        
        // Touch events
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.joystick.active = true;
            const touch = e.touches[0];
            updateJoystick(touch.clientX, touch.clientY);
        });
        
        joystick.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.joystick.active) {
                const touch = e.touches[0];
                updateJoystick(touch.clientX, touch.clientY);
            }
        });
        
        joystick.addEventListener('touchend', (e) => {
            e.preventDefault();
            resetJoystick();
        });
        
        // Mouse events (for testing on desktop)
        joystick.addEventListener('mousedown', (e) => {
            this.joystick.active = true;
            updateJoystick(e.clientX, e.clientY);
        });
        
        joystick.addEventListener('mousemove', (e) => {
            if (this.joystick.active) {
                updateJoystick(e.clientX, e.clientY);
            }
        });
        
        joystick.addEventListener('mouseup', resetJoystick);
        document.addEventListener('mouseup', resetJoystick);
        
        console.log('📱 Mobile controls setup complete');
    }
    
    loadAssets() {
        const assetList = [
            // Images
            { type: 'image', key: 'ninja', src: 'assets/ninja_spritesheet.png' },
            { type: 'image', key: 'clones', src: 'assets/clones_spritesheet.png' },
            { type: 'image', key: 'portal', src: 'assets/portal.png' },
            { type: 'image', key: 'background', src: 'background.png' },
            { type: 'image', key: 'mazeBg', src: 'maze_bg.png' },
            { type: 'image', key: 'powerupSpeed', src: 'assets/powerup_speed.png' },
            { type: 'image', key: 'powerupCloak', src: 'assets/powerup_cloak.png' },
            { type: 'image', key: 'powerupClone', src: 'assets/powerup_clone.png' },
            
            // Audio
            { type: 'audio', key: 'bgMusic', src: 'assets/bg_music_loop.wav', loop: true },
            { type: 'audio', key: 'spawn', src: 'assets/spawn.wav' },
            { type: 'audio', key: 'powerup', src: 'assets/powerup.wav' },
            { type: 'audio', key: 'portal', src: 'assets/portal.wav' },
            { type: 'audio', key: 'death', src: 'assets/death.wav' },
            { type: 'audio', key: 'newRecord', src: 'assets/newrecord.wav' },
            { type: 'audio', key: 'footstep', src: 'assets/footstep.wav' }
        ];
        
        this.totalAssets = assetList.length;
        this.assetsLoaded = 0;
        
        console.log(`📦 Loading ${this.totalAssets} assets...`);
        
        assetList.forEach(asset => {
            if (asset.type === 'image') {
                this.loadImage(asset);
            } else if (asset.type === 'audio') {
                this.loadAudio(asset);
            }
        });
    }
    
    loadImage(asset) {
        const img = new Image();
        
        img.onload = () => {
            this.images[asset.key] = img;
            this.onAssetLoaded(asset.key);
        };
        
        img.onerror = () => {
            console.warn(`⚠️ Failed to load image: ${asset.src}`);
            // Create fallback colored rectangle
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ff00ff'; // Magenta for missing images
            ctx.fillRect(0, 0, 64, 64);
            this.images[asset.key] = canvas;
            this.onAssetLoaded(asset.key);
        };
        
        img.src = asset.src;
    }
    
    loadAudio(asset) {
        const audio = new Audio();
        
        audio.oncanplaythrough = () => {
            if (asset.loop) audio.loop = true;
            this.sounds[asset.key] = audio;
            this.onAssetLoaded(asset.key);
        };
        
        audio.onerror = () => {
            console.warn(`⚠️ Failed to load audio: ${asset.src}`);
            // Create fallback audio context for beeps
            this.sounds[asset.key] = { 
                play: () => this.playFallbackSound(),
                pause: () => {},
                volume: 1,
                loop: false
            };
            this.onAssetLoaded(asset.key);
        };
        
        audio.preload = 'auto';
        audio.src = asset.src;
    }
    
    playFallbackSound() {
        // Create a simple beep using Web Audio API
        if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
            const audioContext = new (AudioContext || webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 440;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    }
    
    onAssetLoaded(assetKey) {
        this.assetsLoaded++;
        this.loadingProgress = this.assetsLoaded / this.totalAssets;
        
        console.log(`✅ Loaded asset: ${assetKey} (${this.assetsLoaded}/${this.totalAssets})`);
        
        this.updateLoadingUI();
        
        if (this.assetsLoaded >= this.totalAssets) {
            setTimeout(() => this.onLoadingComplete(), 500);
        }
    }
    
    updateLoadingUI() {
        const loadingBar = document.getElementById('loadingBar');
        const loadingProgress = document.getElementById('loadingProgress');
        const loadingText = document.getElementById('loadingText');
        
        if (loadingBar) {
            loadingBar.style.width = `${this.loadingProgress * 100}%`;
        }
        
        if (loadingProgress) {
            loadingProgress.textContent = `${Math.round(this.loadingProgress * 100)}%`;
        }
        
        if (loadingText) {
            if (this.loadingProgress < 1) {
                loadingText.textContent = `Loading assets... (${this.assetsLoaded}/${this.totalAssets})`;
            } else {
                loadingText.textContent = 'Complete!';
            }
        }
    }
    
    onLoadingComplete() {
        console.log('🎉 All assets loaded successfully');
        this.showMainMenu();
    }
    
    // Game State Management
    showMainMenu() {
        this.gameState = 'menu';
        this.hideAllScreens();
        this.showScreen('mainMenu');
        this.startMusic();
    }
    
    showScreen(screenId) {
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.remove('hidden');
            screen.classList.add('fade-in');
        }
    }
    
    hideScreen(screenId) {
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('hidden');
            screen.classList.remove('fade-in');
        }
    }
    
    hideAllScreens() {
        const screens = ['loadingScreen', 'mainMenu', 'gameScreen'];
        screens.forEach(id => this.hideScreen(id));
    }
    
    hideAllModals() {
        const modals = [
            'pauseMenu', 'gameOverMenu', 'levelCompleteMenu', 
            'settingsMenu', 'leaderboardMenu', 'howToPlayMenu'
        ];
        modals.forEach(id => this.hideModal(id));
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('fade-in');
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('fade-in');
        }
    }
    
    // Game Controls
    startGame() {
        console.log('🚀 Starting new game');
        this.initializeGame();
        this.gameState = 'playing';
        this.hideAllScreens();
        this.hideAllModals();
        this.showScreen('gameScreen');
        this.startMusic();
    }
    
    pauseGame() {
        if (this.gameState !== 'playing') return;
        this.gameState = 'paused';
        this.isPaused = true;
        this.showModal('pauseMenu');
        console.log('⏸️ Game paused');
    }
    
    resumeGame() {
        if (this.gameState !== 'paused') return;
        this.gameState = 'playing';
        this.isPaused = false;
        this.hideModal('pauseMenu');
        console.log('▶️ Game resumed');
    }
    
    restartGame() {
        console.log('🔄 Restarting game');
        this.hideAllModals();
        this.initializeGame();
        this.gameState = 'playing';
    }
    
    returnToMainMenu() {
        console.log('🏠 Returning to main menu');
        this.stopMusic();
        this.gameState = 'menu';
        this.hideAllScreens();
        this.hideAllModals();
        this.showMainMenu();
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.isGameOver = true;
        this.stopMusic();
        this.playSound('death');
        
        const finalTime = this.gameTime;
        const finalLevel = this.currentLevel;
        
        // Update UI
        const finalTimeEl = document.getElementById('finalTime');
        const finalLevelEl = document.getElementById('finalLevel');
        
        if (finalTimeEl) finalTimeEl.textContent = this.formatTime(finalTime);
        if (finalLevelEl) finalLevelEl.textContent = finalLevel;
        
        // Check for new record
        const isNewRecord = this.isNewHighScore(finalTime, finalLevel);
        const newRecordIndicator = document.getElementById('newRecordIndicator');
        const nameInputContainer = document.getElementById('nameInputContainer');
        
        if (isNewRecord) {
            this.playSound('newRecord');
            if (newRecordIndicator) newRecordIndicator.style.display = 'block';
            if (nameInputContainer) nameInputContainer.style.display = 'block';
        } else {
            if (newRecordIndicator) newRecordIndicator.style.display = 'none';
            if (nameInputContainer) nameInputContainer.style.display = 'none';
        }
        
        this.showModal('gameOverMenu');
        
        console.log(`💀 Game over - Level: ${finalLevel}, Time: ${this.formatTime(finalTime)}`);
    }
    
    levelComplete() {
        this.gameState = 'levelComplete';
        this.playSound('portal');
        
        // Update UI
        const completedLevelNum = document.getElementById('completedLevelNum');
        const levelTime = document.getElementById('levelTime');
        
        if (completedLevelNum) completedLevelNum.textContent = this.currentLevel;
        if (levelTime) levelTime.textContent = this.formatTime(this.gameTime);
        
        this.showModal('levelCompleteMenu');
        
        console.log(`🎯 Level ${this.currentLevel} completed in ${this.formatTime(this.gameTime)}`);
    }
    
    nextLevel() {
        this.currentLevel++;
        this.hideModal('levelCompleteMenu');
        
        // Check if we have more levels
        if (this.currentLevel > this.LEVELS.length) {
            // Game completed!
            alert('Congratulations! You completed all levels!');
            this.returnToMainMenu();
            return;
        }
        
        this.initializeLevel();
        this.gameState = 'playing';
        
        console.log(`➡️ Advanced to level ${this.currentLevel}`);
    }
    
    // Game Initialization
    initializeGame() {
        this.currentLevel = 1;
        this.gameStartTime = Date.now();
        this.gameTime = 0;
        this.isPaused = false;
        this.isGameOver = false;
        
        // Load best time
        const savedBestTime = localStorage.getItem('shadowCloneBestTime');
        this.bestTime = savedBestTime ? parseInt(savedBestTime) : Infinity;
        
        this.initializeLevel();
        
        console.log('🎮 Game initialized');
    }
    
    initializeLevel() {
        const levelConfig = this.LEVELS[this.currentLevel - 1];
        this.mazeWidth = levelConfig.cols;
        this.mazeHeight = levelConfig.rows;
        
        // Generate maze
        this.generateMaze();
        
        // Position player at safe starting location
        this.spawnPlayer();
        
        // Position portal at farthest location
        this.spawnPortal();
        
        // Clear previous state
        this.clones = [];
        this.powerups = [];
        this.particles = [];
        this.movesHistory = [];
        this.activePowerup = null;
        
        // Reset player state
        this.player.moving = false;
        this.player.stepTimer = 0;
        this.player.speedBoost = false;
        this.player.speedBoostTimer = 0;
        this.player.cloaked = false;
        this.player.cloakTimer = 0;
        
        // Set clone spawn interval based on difficulty
        const difficultyMultiplier = this.getDifficultyMultiplier();
        this.cloneSpawnInterval = Math.max(50, 300 - levelConfig.difficulty * 80 * difficultyMultiplier);
        this.cloneSpawnTimer = 0;
        
        // Spawn initial powerups
        this.spawnPowerups();
        
        // Update UI
        this.updateHUD();
        
        // Cache maze rendering
        this.cacheMazeRendering();
        
        console.log(`📋 Level ${this.currentLevel} initialized - ${this.mazeWidth}x${this.mazeHeight}, difficulty: ${levelConfig.difficulty}`);
    }
    
    generateMaze() {
        // Initialize maze with all walls
        this.maze = Array(this.mazeHeight).fill().map(() => Array(this.mazeWidth).fill(1));
        
        // Recursive backtracker algorithm
        const stack = [];
        const startX = 1;
        const startY = 1;
        
        // Mark starting cell as walkable
        this.maze[startY][startX] = 0;
        stack.push([startX, startY]);
        
        const directions = [
            [0, -2], // Up
            [2, 0],  // Right
            [0, 2],  // Down
            [-2, 0]  // Left
        ];
        
        while (stack.length > 0) {
            const [currentX, currentY] = stack[stack.length - 1];
            const neighbors = [];
            
            // Check all directions for valid unvisited cells
            for (const [dx, dy] of directions) {
                const newX = currentX + dx;
                const newY = currentY + dy;
                
                if (newX > 0 && newX < this.mazeWidth - 1 && 
                    newY > 0 && newY < this.mazeHeight - 1 && 
                    this.maze[newY] && this.maze[newY][newX] === 1) {
                    neighbors.push([newX, newY, currentX + dx/2, currentY + dy/2]);
                }
            }
            
            if (neighbors.length > 0) {
                // Choose random neighbor
                const [nextX, nextY, wallX, wallY] = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // Remove wall between current and next cell
                if (this.maze[wallY]) this.maze[wallY][wallX] = 0;
                if (this.maze[nextY]) this.maze[nextY][nextX] = 0;
                
                stack.push([nextX, nextY]);
            } else {
                stack.pop();
            }
        }
        
        // Ensure safe starting area (3x3 around start)
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                if (this.maze[y] && this.maze[y][x] !== undefined) {
                    this.maze[y][x] = 0;
                }
            }
        }
    }
    
    spawnPlayer() {
        // Always start at (1,1) - guaranteed safe position
        this.player.x = 1;
        this.player.y = 1;
        this.updatePlayerPixelPosition();
        
        // Add starting position to moves history
        this.movesHistory = [{ x: this.player.x, y: this.player.y }];
    }
    
    spawnPortal() {
        // Find the walkable cell farthest from player using Manhattan distance
        let maxDistance = 0;
        let bestX = this.mazeWidth - 2;
        let bestY = this.mazeHeight - 2;
        
        for (let y = 1; y < this.mazeHeight - 1; y++) {
            for (let x = 1; x < this.mazeWidth - 1; x++) {
                if (this.maze[y] && this.maze[y][x] === 0) {
                    const distance = Math.abs(x - this.player.x) + Math.abs(y - this.player.y);
                    if (distance > maxDistance) {
                        maxDistance = distance;
                        bestX = x;
                        bestY = y;
                    }
                }
            }
        }
        
        this.portal.x = bestX;
        this.portal.y = bestY;
        this.portal.frame = 0;
        this.portal.animTimer = 0;
    }
    
    spawnPowerups() {
        const numPowerups = Math.min(3 + Math.floor(this.currentLevel / 2), 8);
        const powerupTypes = ['speed', 'cloak', 'shock'];
        
        for (let i = 0; i < numPowerups; i++) {
            let x, y;
            let attempts = 0;
            
            do {
                x = 1 + Math.floor(Math.random() * (this.mazeWidth - 2));
                y = 1 + Math.floor(Math.random() * (this.mazeHeight - 2));
                attempts++;
            } while ((
                !this.maze[y] || this.maze[y][x] !== 0 || 
                (x === this.player.x && y === this.player.y) ||
                (x === this.portal.x && y === this.portal.y) ||
                this.powerups.some(p => p.x === x && p.y === y)
            ) && attempts < 100);
            
            if (attempts < 100) {
                const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
                this.powerups.push({
                    x, y, type,
                    collected: false,
                    bobTimer: Math.random() * Math.PI * 2
                });
            }
        }
    }
    
    // Input Handling
    handleKeyDown(e) {
        this.keys[e.code] = true;
        
        // Handle pause
        if (e.code === 'Escape') {
            if (this.gameState === 'playing') {
                this.pauseGame();
            } else if (this.gameState === 'paused') {
                this.resumeGame();
            }
            e.preventDefault();
        }
        
        // Handle movement in playing state
        if (this.gameState === 'playing' && !this.player.moving) {
            this.handleMovementInput();
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.code] = false;
    }
    
    handleMovementInput() {
        if (this.player.moving || this.isPaused) return;
        
        let dx = 0, dy = 0;
        
        // Keyboard input
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy = -1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy = 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx = -1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx = 1;
        
        // Joystick input (mobile)
        if (this.joystick.active && this.joystick.distance > 0.3) {
            const sensitivity = this.settings.joystickSensitivity;
            const threshold = 0.3 / sensitivity;
            
            if (this.joystick.distance > threshold) {
                const angle = this.joystick.angle;
                
                // Convert angle to cardinal directions
                if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
                    dx = Math.cos(angle) > 0 ? 1 : -1;
                } else {
                    dy = Math.sin(angle) > 0 ? 1 : -1;
                }
            }
        }
        
        // Attempt to move
        if (dx !== 0 || dy !== 0) {
            this.attemptMove(dx, dy);
        }
    }
    
    attemptMove(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;
        
        // Check bounds and walls
        if (newX < 0 || newX >= this.mazeWidth || newY < 0 || newY >= this.mazeHeight) return;
        if (!this.maze[newY] || this.maze[newY][newX] !== 0) return;
        
        // Move player
        this.player.x = newX;
        this.player.y = newY;
        this.player.moving = true;
        this.player.stepTimer = 0;
        
        // Calculate step delay with speed boost
        this.player.currentStepDelay = this.player.baseStepDelay;
        if (this.player.speedBoost) {
            this.player.currentStepDelay *= 0.55; // Speed factor
        }
        
        // Add to moves history
        this.movesHistory.push({ x: this.player.x, y: this.player.y });
        
        // Limit history length
        if (this.movesHistory.length > this.maxHistoryLength) {
            this.movesHistory.shift();
            // Update clone indices
            this.clones.forEach(clone => {
                if (clone.pathIndex > 0) clone.pathIndex--;
            });
        }
        
        // Play footstep sound
        this.playSound('footstep');
        
        // Check collisions
        this.checkPowerupCollision();
        this.checkPortalCollision();
        this.checkCloneCollisions();
    }
    
    // Update Systems
    update(deltaTime) {
        if (this.gameState !== 'playing' || this.isPaused) return;
        
        // Update game time
        this.gameTime = Date.now() - this.gameStartTime;
        
        // Update player
        this.updatePlayer(deltaTime);
        
        // Update clones
        this.updateClones(deltaTime);
        
        // Update powerups
        this.updatePowerups(deltaTime);
        
        // Update portal animation
        this.updatePortal(deltaTime);
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Handle input for continuous movement
        this.handleMovementInput();
        
        // Update HUD
        this.updateHUD();
    }
    
    updatePlayer(deltaTime) {
        // Update step timer
        if (this.player.moving) {
            this.player.stepTimer += deltaTime;
            
            if (this.player.stepTimer >= this.player.currentStepDelay) {
                this.player.moving = false;
                this.player.stepTimer = 0;
            }
        }
        
        // Update powerup timers
        if (this.player.speedBoost) {
            this.player.speedBoostTimer -= deltaTime;
            if (this.player.speedBoostTimer <= 0) {
                this.player.speedBoost = false;
                console.log('⚡ Speed boost ended');
            }
        }
        
        if (this.player.cloaked) {
            this.player.cloakTimer -= deltaTime;
            if (this.player.cloakTimer <= 0) {
                this.player.cloaked = false;
                console.log('👻 Cloak ended');
            }
        }
        
        // Update pixel position for smooth rendering
        this.updatePlayerPixelPosition();
    }
    
    updatePlayerPixelPosition() {
        this.player.pixelX = this.player.x * this.cellSize + this.cellSize / 2;
        this.player.pixelY = this.player.y * this.cellSize + this.cellSize / 2;
    }
    
    updateClones(deltaTime) {
        // Spawn new clones
        if (this.movesHistory.length >= 6) {
            this.cloneSpawnTimer += deltaTime;
            
            if (this.cloneSpawnTimer >= this.cloneSpawnInterval) {
                this.spawnClone();
                this.cloneSpawnTimer = 0;
            }
        }
        
        // Update existing clones
        this.clones.forEach(clone => {
            this.updateClone(clone, deltaTime);
        });
        
        // Remove dead clones
        this.clones = this.clones.filter(clone => !clone.dead);
    }
    
    spawnClone() {
        if (this.movesHistory.length < 6) return;
        
        const cloneTypes = ['basic', 'fast', 'wraith'];
        const type = cloneTypes[Math.floor(Math.random() * cloneTypes.length)];
        
        // Clone starts from a snapshot of recent moves
        const pathLength = Math.min(900, this.movesHistory.length);
        const clonePath = this.movesHistory.slice(-pathLength);
        
        const clone = {
            type: type,
            path: [.../*
SHADOW CLONE ESCAPE - COMPLETE GAME IMPLEMENTATION
Expected Assets:
- assets/ninja_spritesheet.png (1536x534, 4 frames horizontally, frameW=384, frameH=534)
- assets/clones_spritesheet.png (1060x433, 3 frames horizontally, frameW=353, frameH=433)
- assets/portal.png (361x316)
- background.png (1920x1080 or 1280x720)
- maze_bg.png (1280x720)
- assets/powerup_speed.png (64x64)
- assets/powerup_cloak.png (64x64)
- assets/powerup_clone.png (64x64)
- Audio: bg_music_loop.wav, spawn.wav, powerup.wav, portal.wav, death.wav, newrecord.wav, footstep.wav
*/

class ShadowCloneEscape {
    constructor() {
        // Game state
        this.gameState = 'loading'; // loading, menu, playing, paused, gameOver, levelComplete
        this.loadingProgress = 0;
        this.assetsLoaded = 0;
        this.totalAssets = 0;
        
        // Assets storage
        this.images = {};
        this.sounds = {};
        
        // Game settings (saved to localStorage)
        this.settings = {
            musicEnabled: true,
            musicVolume: 0.7,
            sfxEnabled: true,
            sfxVolume: 0.8,
            difficulty: 'normal',
            particlesEnabled: true,
            joystickSensitivity: 1.0
        };
        
        // Level configuration
        this.LEVELS = [
            { cols: 15, rows: 15, difficulty: 1 },
            { cols: 17, rows: 17, difficulty: 2 },
            { cols: 19, rows: 19, difficulty: 3 },
            { cols: 21, rows: 21, difficulty: 4 },
            { cols: 23, rows: 23, difficulty: 5 },
            { cols: 25, rows: 25, difficulty: 6 },
            { cols: 27, rows: 27, difficulty: 7 },
            { cols: 29, rows: 29, difficulty: 8 },
            { cols: 31, rows: 31, difficulty: 9 },
            { cols: 33, rows: 33, difficulty: 10 }
        ];
        
        // Game variables
        this.currentLevel = 1;
        this.gameStartTime = 0;
        this.gameTime = 0;
        this.bestTime = Infinity;
        this.isPaused = false;
        this.isGameOver = false;
        
        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.miniMapCanvas = null;
        this.miniMapCtx = null;
        this.mazeCache = null; // Offscreen canvas for maze caching
        
        // Maze system
        this.maze = [];
        this.mazeWidth = 15;
        this.mazeHeight = 15;
        this.cellSize = 30;
        
        // Player system - grid-based movement
        this.player = {
            x: 1, y: 1, // Grid coordinates
            pixelX: 0, pixelY: 0, // Pixel coordinates for rendering
            facing: 0, // Animation frame
            moving: false,
            stepTimer: 0,
            baseStepDelay: 140, // Base step delay in ms
            currentStepDelay: 140,
            speedBoost: false,
            speedBoostTimer: 0,
            cloaked: false,
            cloakTimer: 0
        };
        
        // Movement history - core mechanic for clones
        this.movesHistory = [];
        this.maxHistoryLength = 5000;
        
        // Clone system
        this.clones = [];
        this.cloneSpawnTimer = 0;
        this.cloneSpawnInterval = 3000; // Will be modified by difficulty
        
        // Portal system
        this.portal = { x: 0, y: 0, frame: 0, animTimer: 0 };
        
        // Powerup system
        this.powerups = [];
        this.activePowerup = null;
        this.powerupTimer = 0;
        
        // Particle system
        this.particles = [];
        this.maxParticles = 400;
        
        // Input system
        this.keys = {};
        this.joystick = {
            active: false,
            baseX: 0, baseY: 0,
            knobX: 0, knobY: 0,
            angle: 0, distance: 0
        };
        
        // Mobile detection
        this.isMobile = this.detectMobile();
        
        // Performance monitoring
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 60;
        
        // Initialize game
        this.init();
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }
    
    init() {
        console.log('🎮 Shadow Clone Escape - Initializing...');
        
        this.loadSettings();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupMobileControls();
        this.loadAssets();
        
        // Start game loop
        this.gameLoop();
        
        console.log('✅ Game initialization complete');
    }
    
    setupCanvas() {
        // Main game canvas
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('❌ Game canvas not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false; // Pixel art rendering
        
        // Minimap canvas
        this.miniMapCanvas = document.getElementById('miniMap');
        if (this.miniMapCanvas) {
            this.miniMapCtx = this.miniMapCanvas.getContext('2d');
            this.miniMapCtx.imageSmoothingEnabled = false;
        }
        
        // Resize canvas to fit screen
        this.resizeCanvas();
        
        console.log('🖼️ Canvas setup complete');
    }
    
    resizeCanvas() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
        
        // Update mobile controls visibility
        const mobileControls = document.getElementById('mobileControls');
        if (mobileControls) {
            mobileControls.classList.toggle('hidden', !this.isMobile);
        }
        
        // Update joystick sensitivity row visibility
        const joystickRow = document.getElementById('joystickSensitivityRow');
        if (joystickRow) {
            joystickRow.style.display = this.isMobile ? 'flex' : 'none';
        }
    }
    
    setupEventListeners() {
        // Window events
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('beforeunload', () => this.saveSettings());
        
        // Visibility change (auto-pause when tab not visible)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameState === 'playing') {
                this.pauseGame();
            }
        });
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Prevent context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Setup menu button listeners
        this.setupMenuListeners();
        
        // Setup settings listeners
        this.setupSettingsListeners();
        
        console.log('🎯 Event listeners setup complete');
    }
    
    setupMenuListeners() {
        // Main menu buttons
        const startBtn = document.getElementById('startBtn');
        if (startBtn) startBtn.addEventListener('click', () => this.startGame());
        
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettings());
        
        const leaderboardBtn = document.getElementById('leaderboardBtn');
        if (leaderboardBtn) leaderboardBtn.addEventListener('click', () => this.showLeaderboard());
        
        const howToPlayBtn = document.getElementById('howToPlayBtn');
        if (howToPlayBtn) howToPlayBtn.addEventListener('click', () => this.showHowToPlay());
        
        // Pause menu buttons
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseGame());
        
        const mobilePauseBtn = document.getElementById('mobilePauseBtn');
        if (mobilePauseBtn) mobilePauseBtn.addEventListener('click', () => this.pauseGame());
        
        const resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumeGame());
        
        const pauseSettingsBtn = document.getElementById('pauseSettingsBtn');
        if (pauseSettingsBtn) pauseSettingsBtn.addEventListener('click', () => this.showSettings());
        
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) restartBtn.addEventListener('click', () => this.restartGame());
        
        const mainMenuBtn = document.getElementById('mainMenuBtn');
        if (mainMenuBtn) mainMenuBtn.addEventListener('click', () => this.returnToMainMenu());
        
        // Game over menu buttons
        const playAgainBtn = document.getElementById('playAgainBtn');
        if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.restartGame());
        
        const gameOverMainMenuBtn = document.getElementById('gameOverMainMenuBtn');
        if (gameOverMainMenuBtn) gameOverMainMenuBtn.addEventListener('click', () => this.returnToMainMenu());
        
        // Level complete menu buttons
        const nextLevelBtn = document.getElementById('nextLevelBtn');
        if (nextLevelBtn) nextLevelBtn.addEventListener('click', () => this.nextLevel());
        
        const levelCompleteMainMenuBtn = document.getElementById('levelCompleteMainMenuBtn');
        if (levelCompleteMainMenuBtn) levelCompleteMainMenuBtn.addEventListener('click', () => this.returnToMainMenu());
        
        // Modal close buttons
        const closeButtons = ['closeSettingsBtn', 'closeLeaderboardBtn', 'closeHowToPlayBtn'];
        closeButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => this.hideAllModals());
        });
        
        // Name input submission
        const submitNameBtn = document.getElementById('submitNameBtn');
        if (submitNameBtn) submitNameBtn.addEventListener('click', () => this.submitHighScore());
        
        const playerNameInput = document.getElementById('playerNameInput');
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.submitHighScore();
            });
        }
        
        // Clear leaderboard
        const clearLeaderboardBtn = document.getElementById('clearLeaderboardBtn');
        if (clearLeaderboardBtn) {
            clearLeaderboardBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all scores?')) {
                    localStorage.removeItem('shadowCloneScores');
                    this.showLeaderboard();
                }
            });
        }
    }
    
    setupSettingsListeners() {
        // Music toggle
        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle) {
            musicToggle.checked = this.settings.musicEnabled;
            musicToggle.addEventListener('change', (e) => {
                this.settings.musicEnabled = e.target.checked;
                this.updateMusicState();
                this.saveSettings();
            });
        }
        
        // Music volume
        const musicVolume = document.getElementById('musicVolume');
        const musicVolumeValue = document.getElementById('musicVolumeValue');
        if (musicVolume && musicVolumeValue) {
            musicVolume.value = this.settings.musicVolume * 100;
            musicVolumeValue.textContent = Math.round(this.settings.musicVolume * 100) + '%';
            musicVolume.addEventListener('input', (e) => {
                this.settings.musicVolume = e.target.value / 100;
                musicVolumeValue.textContent = Math.round(e.target.value) + '%';
                this.updateMusicState();
                this.saveSettings();
            });
        }
        
        // SFX toggle
        const sfxToggle = document.getElementById('sfxToggle');
        if (sfxToggle) {
            sfxToggle.checked = this.settings.sfxEnabled;
            sfxToggle.addEventListener('change', (e) => {
                this.settings.sfxEnabled = e.target.checked;
                this.saveSettings();
            });
        }
        
        // SFX volume
        const sfxVolume = document.getElementById('sfxVolume');
        const sfxVolumeValue = document.getElementById('sfxVolumeValue');
        if (sfxVolume && sfxVolumeValue) {
            sfxVolume.value = this.settings.sfxVolume * 100;
            sfxVolumeValue.textContent = Math.round(this.settings.sfxVolume * 100) + '%';
            sfxVolume.addEventListener('input', (e) => {
                this.settings.sfxVolume = e.target.value / 100;
                sfxVolumeValue.textContent = Math.round(e.target.value) + '%';
                this.saveSettings();
            });
        }
        
        // Difficulty select
        const difficultySelect = document.getElementByI
