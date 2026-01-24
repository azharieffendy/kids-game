// ========================================
// DEVICE DETECTION & PERFORMANCE CONFIG
// ========================================
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);

const isTablet = /iPad|Android/i.test(navigator.userAgent) &&
    window.innerWidth >= 768 && window.innerWidth <= 1024;

const isLowEndDevice = isMobile ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Particle counts based on device capability
const PARTICLE_CONFIG = {
    background: prefersReducedMotion ? 0 : (isLowEndDevice ? 6 : 12),
    confetti: isLowEndDevice ? 20 : 40,
    celebration: isLowEndDevice ? 4 : 8
};

// ========================================
// SECURITY UTILITIES
// ========================================
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ========================================
// AUDIO SYSTEM
// ========================================
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.bgAudioElement = null;
        this.currentBackgroundMusic = 'backsound3';
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            // AudioContext not available - silent fail
        }
    }

    getContext() {
        this.init();
        return this.ctx;
    }

    getThemeSound(visualTheme) {
        // Map visual themes to sound characteristics
        const themeSounds = {
            'default': { type: 'triangle', gain: 0.18, duration: 0.3, delay: 0.1 },
            'cotton-candy': { type: 'sine', gain: 0.2, duration: 0.35, delay: 0.12 },
            'ocean': { type: 'sine', gain: 0.15, duration: 0.4, delay: 0.15 },
            'sunset': { type: 'square', gain: 0.16, duration: 0.28, delay: 0.09 },
            'forest': { type: 'triangle', gain: 0.17, duration: 0.32, delay: 0.11 }
        };
        return themeSounds[visualTheme] || themeSounds['default'];
    }

    playNotes(frequencies, theme = 'fun', visualTheme = 'default') {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const themeSound = this.getThemeSound(visualTheme);
            const now = ctx.currentTime;
            
            frequencies.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = themeSound.type;
                gain.gain.setValueAtTime(themeSound.gain, now + i * themeSound.delay);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * themeSound.delay + themeSound.duration);

                osc.frequency.setValueAtTime(freq, now + i * themeSound.delay);
                osc.start(now + i * themeSound.delay);
                osc.stop(now + i * themeSound.delay + themeSound.duration);
            });
        } catch (e) {
            // Error playing notes - silent fail
        }
    }

    playSweep(startFreq, endFreq, theme = 'fun') {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = theme === 'calm' ? 'sine' : theme === 'exciting' ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.5);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {
            // Error playing sweep - silent fail
        }
    }

    playClick(theme = 'fun') {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            const freq = theme === 'calm' ? 400 : theme === 'exciting' ? 600 : 500;
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

            osc.start(now);
            osc.stop(now + 0.1);
        } catch (e) {
            // Error playing click - silent fail
        }
    }

    playBackgroundMusic() {
        if (!this.bgAudioElement) {
            this.bgAudioElement = new Audio();
            this.bgAudioElement.loop = true;
            this.bgAudioElement.volume = 0.3;
        }

        try {
            this.init();

            if (this.bgAudioElement) {
                const musicPath = `../audio/backsound/${this.currentBackgroundMusic}.mp3`;
                this.bgAudioElement.src = musicPath;
                this.bgAudioElement.load();
                this.bgAudioElement.play().then(() => {
                    // Music playing
                }).catch(e => {
                    // Could not play background music - silent fail
                });
            }
        } catch (e) {
            // Music not available - silent fail
        }
    }

    stopMusic() {
        if (this.bgAudioElement) {
            this.bgAudioElement.pause();
            this.bgAudioElement.currentTime = 0;
        }
    }

    changeBackgroundMusic(musicName) {
        this.currentBackgroundMusic = musicName;
        if (this.bgAudioElement && !this.bgAudioElement.paused) {
            this.stopMusic();
            this.playBackgroundMusic();
        }
    }

    playVictoryMusic(visualTheme) {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const themeSound = this.getThemeSound(visualTheme);
            
            // Theme-specific victory melodies
            const victoryMelodies = {
                'default': [523, 659, 784, 1047],
                'cotton-candy': [523, 587, 659, 784, 880],
                'ocean': [392, 494, 587, 740],
                'sunset': [659, 784, 880, 1047],
                'forest': [440, 523, 659, 784]
            };
            
            const melody = victoryMelodies[visualTheme] || victoryMelodies['default'];
            
            melody.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = themeSound.type;
                osc.frequency.setValueAtTime(freq, now + i * 0.15);
                
                gain.gain.setValueAtTime(0.3, now + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);

                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.4);
            });
        } catch (e) {
            // Error playing victory music - silent fail
        }
    }
}

const audioSystem = new AudioSystem();

// ========================================
// CARD THEMES DATA
// ========================================
const CARD_THEMES = {
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐣', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠'],
    fruits: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍑', '🍒', '🍍', '🥝', '🥭', '🍈', '🍏', '🍐', '🥑', '🍅', '🌶️', '🥕', '🌽', '🥦', '🥒', '🥬', '🍆', '🥔', '🍠', '🥜', '🌰', '🥥', '🥨', '🥐', '🥖', '🥞', '🧇', '🧀', '🥚', '🍳', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗'],
    vehicles: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🛸', '🚀', '🛰️', '🚢', '⛵', '🛶', '🚤'],
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶']
};

// ========================================
// GAME STATE
// ========================================
let gameState = {
    gridCols: 4,
    gridRows: 4,
    cardTheme: 'animals',
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    moves: 0,
    startTime: null,
    timerInterval: null,
    soundEnabled: true,
    musicEnabled: true,
    soundTheme: 'fun',
    visualTheme: 'default'
};

// Statistics tracking
let gameStats = {
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    gridStats: {} // Format: "4x4": { games: 0, totalTime: 0, bestTime: null }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ========================================
// VISUAL EFFECTS
// ========================================
function createBackgroundParticles() {
    const container = document.getElementById('backgroundParticles');
    if (!container || PARTICLE_CONFIG.background === 0) return;

    container.innerHTML = '';
    const particleCount = PARTICLE_CONFIG.background;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

function createConfetti() {
    const confettiCount = PARTICLE_CONFIG.confetti;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffa07a', '#98d8c8', '#f7dc6f'];

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (2 + Math.random()) + 's';
        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 3000);
    }
}

// ========================================
// GRID SIZE FUNCTIONS
// ========================================
function updateGridFromSelect(value) {
    const [cols, rows] = value.split(',').map(Number);
    gameState.gridCols = cols;
    gameState.gridRows = rows;
}

function selectGridSize(cols, rows) {
    gameState.gridCols = cols;
    gameState.gridRows = rows;

    // Update select if it exists
    const select = document.getElementById('gridSizeSelect');
    if (select) {
        select.value = `${cols},${rows}`;
    }
}

// ========================================
// THEME FUNCTIONS
// ========================================
function changeVisualTheme(theme) {
    gameState.visualTheme = theme;
    document.body.className = `theme-${theme}`;
    saveSettings();
}

function changeSoundTheme(theme) {
    gameState.soundTheme = theme;
    saveSettings();
}

function changeBackgroundMusic(musicName) {
    audioSystem.changeBackgroundMusic(musicName);
    saveSettings();
}

function setCardTheme(theme) {
    gameState.cardTheme = theme;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    saveSettings();
}

// ========================================
// SOUND CONTROLS
// ========================================
function toggleSound() {
    gameState.soundEnabled = !gameState.soundEnabled;
    document.getElementById('soundToggle').textContent = gameState.soundEnabled ? '🔊' : '🔇';
    saveSettings();
}

function toggleMusic() {
    gameState.musicEnabled = !gameState.musicEnabled;
    const btn = document.getElementById('musicToggle');
    btn.textContent = gameState.musicEnabled ? '🎵' : '🔇';

    if (gameState.musicEnabled) {
        audioSystem.playBackgroundMusic();
    } else {
        audioSystem.stopMusic();
    }
    saveSettings();
}

// ========================================
// STORAGE FUNCTIONS
// ========================================
function saveSettings() {
    try {
        localStorage.setItem('memoryGameSettings', JSON.stringify({
            soundEnabled: gameState.soundEnabled,
            musicEnabled: gameState.musicEnabled,
            soundTheme: gameState.soundTheme,
            visualTheme: gameState.visualTheme,
            cardTheme: gameState.cardTheme,
            backgroundMusic: audioSystem.currentBackgroundMusic
        }));
    } catch (e) {
        // Cannot save settings - silent fail
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('memoryGameSettings');
        if (saved) {
            const settings = JSON.parse(saved);
            gameState.soundEnabled = settings.soundEnabled !== undefined ? settings.soundEnabled : true;
            gameState.musicEnabled = settings.musicEnabled !== undefined ? settings.musicEnabled : true;
            gameState.soundTheme = settings.soundTheme || 'fun';
            gameState.visualTheme = settings.visualTheme || 'default';
            gameState.cardTheme = settings.cardTheme || 'animals';

            if (settings.backgroundMusic) {
                audioSystem.currentBackgroundMusic = settings.backgroundMusic;
            }

            // Apply settings to UI
            document.getElementById('soundToggle').textContent = gameState.soundEnabled ? '🔊' : '🔇';
            document.getElementById('musicToggle').textContent = gameState.musicEnabled ? '🎵' : '🔇';
            document.getElementById('visualTheme').value = gameState.visualTheme;
            document.getElementById('soundTheme').value = gameState.soundTheme;
            document.getElementById('backgroundMusicSelector').value = audioSystem.currentBackgroundMusic;
            document.body.className = `theme-${gameState.visualTheme}`;

            // Set card theme button
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === gameState.cardTheme);
            });
        }
    } catch (e) {
        // Cannot load settings - use defaults
    }
}

function loadStats() {
    try {
        const saved = localStorage.getItem('memoryGameStats');
        if (saved) {
            gameStats = JSON.parse(saved);
        }
    } catch (e) {
        // Cannot load stats - use defaults
    }
}

function saveStats() {
    try {
        localStorage.setItem('memoryGameStats', JSON.stringify(gameStats));
    } catch (e) {
        // Cannot save stats - silent fail
    }
}

// ========================================
// GAME LOGIC
// ========================================
function startGame() {
    gameState.matchedPairs = 0;
    gameState.moves = 0;
    gameState.flippedCards = [];
    gameState.startTime = Date.now();
    
    // Track game start
    gameStats.totalGamesPlayed++;

    const cardCount = gameState.gridCols * gameState.gridRows;
    const pairsNeeded = cardCount / 2;

    // Get cards from selected theme
    const themeCards = CARD_THEMES[gameState.cardTheme];
    const selectedCards = themeCards.slice(0, pairsNeeded);
    const cardPairs = [...selectedCards, ...selectedCards];
    
    gameState.cards = shuffleArray(cardPairs).map((emoji, index) => ({
        id: index,
        emoji: emoji,
        isFlipped: false,
        isMatched: false
    }));

    renderGame();
    startTimer();

    if (gameState.musicEnabled) {
        audioSystem.playBackgroundMusic();
    }

    updateStats();
}

function renderGame() {
    const content = document.getElementById('game-content');

    // Calculate grid class based on grid size
    const gridSize = gameState.gridCols * gameState.gridRows;
    let gridClass = 'grid-dynamic';

    const cardsHtml = gameState.cards.map(card => `
        <div class="card ${card.isFlipped ? 'flipped' : ''} ${card.isMatched ? 'matched' : ''}"
             data-id="${card.id}"
             onclick="flipCard(${card.id})">
            <div class="card-inner">
                <div class="card-front">
                    <div class="card-pattern">?</div>
                </div>
                <div class="card-back">
                    <div class="card-emoji">${escapeHtml(card.emoji)}</div>
                </div>
            </div>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="game-board">
            <div class="game-info">
                <button class="new-game-btn" onclick="showStartScreen()">🔄 Game Baru</button>
            </div>
            <div class="card-grid ${gridClass}" style="grid-template-columns: repeat(${gameState.gridCols}, 1fr); grid-template-rows: repeat(${gameState.gridRows}, 1fr);">
                ${cardsHtml}
            </div>
        </div>
    `;
}

function flipCard(cardId) {
    const card = gameState.cards.find(c => c.id === cardId);

    // Prevent flipping if card is already matched or already flipped or two cards are being compared
    if (!card || card.isMatched || card.isFlipped || gameState.flippedCards.length >= 2) {
        return;
    }

    // Flip the card
    card.isFlipped = true;
    gameState.flippedCards.push(card);

    if (gameState.soundEnabled) {
        audioSystem.playClick(gameState.soundTheme);
    }

    // Update the DOM
    const cardElement = document.querySelector(`[data-id="${cardId}"]`);
    cardElement.classList.add('flipped');

    // Check for match when two cards are flipped
    if (gameState.flippedCards.length === 2) {
        gameState.moves++;
        updateStats();
        checkForMatch();
    }
}

function checkForMatch() {
    const [card1, card2] = gameState.flippedCards;

    if (card1.emoji === card2.emoji) {
        // Match found!
        card1.isMatched = true;
        card2.isMatched = true;
        gameState.matchedPairs++;
        updateStats();

        if (gameState.soundEnabled) {
            audioSystem.playNotes([523, 659, 784], gameState.soundTheme, gameState.visualTheme);
        }

        // Mark cards as matched
        setTimeout(() => {
            document.querySelector(`[data-id="${card1.id}"]`).classList.add('matched');
            document.querySelector(`[data-id="${card2.id}"]`).classList.add('matched');
            gameState.flippedCards = [];

            // Check if game is won
            if (gameState.matchedPairs === gameState.cards.length / 2) {
                gameWon();
            }
        }, 500);
    } else {
        // No match - flip cards back
        if (gameState.soundEnabled) {
            audioSystem.playNotes([392, 330], gameState.soundTheme, gameState.visualTheme);
        }

        setTimeout(() => {
            card1.isFlipped = false;
            card2.isFlipped = false;

            document.querySelector(`[data-id="${card1.id}"]`).classList.remove('flipped');
            document.querySelector(`[data-id="${card2.id}"]`).classList.remove('flipped');

            gameState.flippedCards = [];
        }, 1000);
    }
}

function gameWon() {
    stopTimer();
    const elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);

    // Update statistics
    gameStats.totalGamesWon++;
    const gridKey = `${gameState.gridCols}x${gameState.gridRows}`;
    if (!gameStats.gridStats[gridKey]) {
        gameStats.gridStats[gridKey] = { games: 0, totalTime: 0, bestTime: null };
    }
    gameStats.gridStats[gridKey].games++;
    gameStats.gridStats[gridKey].totalTime += elapsedTime;
    if (gameStats.gridStats[gridKey].bestTime === null || elapsedTime < gameStats.gridStats[gridKey].bestTime) {
        gameStats.gridStats[gridKey].bestTime = elapsedTime;
    }
    saveStats();

    if (gameState.soundEnabled) {
        audioSystem.playVictoryMusic(gameState.visualTheme);
    }

    createConfetti();

    setTimeout(() => {
        const content = document.getElementById('game-content');
        // Star rating based on difficulty and moves
        const perfectMoves = gameState.cards.length / 2; // Minimum possible moves
        const goodMoves = perfectMoves * 1.5; // 50% more than perfect
        const okMoves = perfectMoves * 2; // Double the perfect score

        const stars = gameState.moves <= goodMoves ? '⭐⭐⭐' :
                      gameState.moves <= okMoves ? '⭐⭐' : '⭐';

        content.innerHTML = `
            <div class="victory-screen">
                <div class="victory-content">
                    <h2>🎉 Selamat! 🎉</h2>
                    <p class="stars">${stars}</p>
                    <div class="victory-stats">
                        <div class="stat-item">
                            <span class="stat-label">Waktu:</span>
                            <span class="stat-value">${formatTime(elapsedTime)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Langkah:</span>
                            <span class="stat-value">${gameState.moves}</span>
                        </div>
                    </div>
                    <div class="victory-actions">
                        <button class="victory-btn" onclick="startGame()">🔄 Main Lagi</button>
                        <button class="victory-btn secondary" onclick="showStartScreen()">🏠 Menu Utama</button>
                    </div>
                </div>
            </div>
        `;
    }, 1000);
}

function showStartScreen() {
    stopTimer();
    gameState.matchedPairs = 0;
    gameState.moves = 0;
    gameState.flippedCards = [];

    const content = document.getElementById('game-content');
    content.innerHTML = `
        <div class="start-screen">
            <h2>Mari Bermain!</h2>
            <p>Klik kartu untuk menemukan pasangan yang sama</p>

            <div class="grid-size-selection">
                <h3>Pilih Ukuran Grid:</h3>
                <div class="grid-select-container">
                    <select id="gridSizeSelect" class="grid-select" onchange="updateGridFromSelect(this.value)">
                        <optgroup label="Mudah (Easy)">
                            <option value="2,2" ${gameState.gridCols === 2 && gameState.gridRows === 2 ? 'selected' : ''}>2 × 2 (4 kartu)</option>
                            <option value="3,2" ${gameState.gridCols === 3 && gameState.gridRows === 2 ? 'selected' : ''}>3 × 2 (6 kartu)</option>
                            <option value="4,2" ${gameState.gridCols === 4 && gameState.gridRows === 2 ? 'selected' : ''}>4 × 2 (8 kartu)</option>
                        </optgroup>
                        <optgroup label="Sedang (Medium)">
                            <option value="3,4" ${gameState.gridCols === 3 && gameState.gridRows === 4 ? 'selected' : ''}>3 × 4 (12 kartu)</option>
                            <option value="4,4" ${gameState.gridCols === 4 && gameState.gridRows === 4 ? 'selected' : ''}>4 × 4 (16 kartu)</option>
                            <option value="5,4" ${gameState.gridCols === 5 && gameState.gridRows === 4 ? 'selected' : ''}>5 × 4 (20 kartu)</option>
                            <option value="6,4" ${gameState.gridCols === 6 && gameState.gridRows === 4 ? 'selected' : ''}>6 × 4 (24 kartu)</option>
                        </optgroup>
                        <optgroup label="Sulit (Hard)">
                            <option value="5,6" ${gameState.gridCols === 5 && gameState.gridRows === 6 ? 'selected' : ''}>5 × 6 (30 kartu)</option>
                            <option value="6,6" ${gameState.gridCols === 6 && gameState.gridRows === 6 ? 'selected' : ''}>6 × 6 (36 kartu)</option>
                            <option value="7,6" ${gameState.gridCols === 7 && gameState.gridRows === 6 ? 'selected' : ''}>7 × 6 (42 kartu)</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            <div class="theme-selection">
                <h3>Pilih Tema Kartu:</h3>
                <div class="card-theme-buttons">
                    <button class="theme-btn animals ${gameState.cardTheme === 'animals' ? 'active' : ''}" onclick="setCardTheme('animals')" data-theme="animals">
                        🐶 Hewan
                    </button>
                    <button class="theme-btn fruits ${gameState.cardTheme === 'fruits' ? 'active' : ''}" onclick="setCardTheme('fruits')" data-theme="fruits">
                        🍎 Buah
                    </button>
                    <button class="theme-btn vehicles ${gameState.cardTheme === 'vehicles' ? 'active' : ''}" onclick="setCardTheme('vehicles')" data-theme="vehicles">
                        🚗 Kendaraan
                    </button>
                    <button class="theme-btn emojis ${gameState.cardTheme === 'emojis' ? 'active' : ''}" onclick="setCardTheme('emojis')" data-theme="emojis">
                        😀 Emoji
                    </button>
                </div>
            </div>
            <div class="start-game-button">
                <button class="start-btn" onclick="startGame()">🎮 Mulai Game</button>
                <button class="stats-btn" onclick="showStatistics()">📊 Statistik</button>
            </div>
        </div>
    `;

    updateStats();
}

function showStatistics() {
    const content = document.getElementById('game-content');
    
    const winPercentage = gameStats.totalGamesPlayed > 0 
        ? Math.round((gameStats.totalGamesWon / gameStats.totalGamesPlayed) * 100) 
        : 0;
    
    // Build grid stats HTML
    let gridStatsHtml = '';
    const sortedGrids = Object.keys(gameStats.gridStats).sort((a, b) => {
        const [aCols, aRows] = a.split('x').map(Number);
        const [bCols, bRows] = b.split('x').map(Number);
        return (aCols * aRows) - (bCols * bRows);
    });
    
    if (sortedGrids.length === 0) {
        gridStatsHtml = '<p style="text-align: center; color: #666; margin-top: 20px;">Belum ada statistik. Mainkan game untuk melihat statistik!</p>';
    } else {
        gridStatsHtml = sortedGrids.map(gridKey => {
            const stats = gameStats.gridStats[gridKey];
            const avgTime = Math.round(stats.totalTime / stats.games);
            return `
                <div class="grid-stat-item">
                    <div class="grid-stat-header">
                        <span class="grid-stat-size">${gridKey.replace('x', ' × ')}</span>
                        <span class="grid-stat-games">${stats.games} game${stats.games > 1 ? 's' : ''}</span>
                    </div>
                    <div class="grid-stat-details">
                        <div class="grid-stat-detail">
                            <span class="detail-label">Rata-rata:</span>
                            <span class="detail-value">${formatTime(avgTime)}</span>
                        </div>
                        <div class="grid-stat-detail">
                            <span class="detail-label">Terbaik:</span>
                            <span class="detail-value">${formatTime(stats.bestTime)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    content.innerHTML = `
        <div class="stats-screen">
            <h2>📊 Statistik Permainan</h2>
            
            <div class="overall-stats">
                <div class="overall-stat-card">
                    <div class="stat-number">${gameStats.totalGamesPlayed}</div>
                    <div class="stat-label">Total Game</div>
                </div>
                <div class="overall-stat-card">
                    <div class="stat-number">${gameStats.totalGamesWon}</div>
                    <div class="stat-label">Menang</div>
                </div>
                <div class="overall-stat-card">
                    <div class="stat-number">${winPercentage}%</div>
                    <div class="stat-label">Win Rate</div>
                </div>
            </div>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px; text-align: center; color: #2c3e50;">Statistik per Ukuran Grid</h3>
            <div class="grid-stats-list">
                ${gridStatsHtml}
            </div>
            
            <div class="stats-actions">
                <button class="victory-btn" onclick="showStartScreen()">🏠 Kembali</button>
                <button class="victory-btn secondary" onclick="resetStatistics()">🗑️ Reset Statistik</button>
            </div>
        </div>
    `;
}

function resetStatistics() {
    if (confirm('Apakah Anda yakin ingin mereset semua statistik?')) {
        gameStats = {
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            gridStats: {}
        };
        saveStats();
        showStatistics();
    }
}

// ========================================
// TIMER FUNCTIONS
// ========================================
function startTimer() {
    stopTimer();
    gameState.timerInterval = setInterval(() => {
        updateStats();
    }, 1000);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function updateStats() {
    const statsDisplay = document.getElementById('statsDisplay');
    const elapsedTime = gameState.startTime ?
        Math.floor((Date.now() - gameState.startTime) / 1000) : 0;

    statsDisplay.innerHTML = `
        <div class="stat">⏱️ ${formatTime(elapsedTime)}</div>
        <div class="stat">🎯 Langkah: ${gameState.moves}</div>
        <div class="stat">✅ Cocok: ${gameState.matchedPairs}/${gameState.cards.length / 2 || 0}</div>
    `;
}

// ========================================
// NAVIGATION
// ========================================
function backToMenu() {
    stopTimer();
    audioSystem.stopMusic();
    window.location.href = '../index.html';
}

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadStats();
    createBackgroundParticles();
    updateStats();
});
