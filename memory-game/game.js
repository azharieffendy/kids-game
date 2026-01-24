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

    playNotes(frequencies, theme = 'fun') {
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            frequencies.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                if (theme === 'calm') {
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.15, now + i * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
                } else if (theme === 'exciting') {
                    osc.type = 'square';
                    gain.gain.setValueAtTime(0.2, now + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
                } else {
                    osc.type = 'triangle';
                    gain.gain.setValueAtTime(0.18, now + i * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
                }

                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.3);
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
}

const audioSystem = new AudioSystem();

// ========================================
// CARD THEMES DATA
// ========================================
const CARD_THEMES = {
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'],
    fruits: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍑', '🍒', '🍍', '🥝', '🥭'],
    vehicles: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛'],
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '😍']
};

// ========================================
// GAME STATE
// ========================================
let gameState = {
    difficulty: 'easy',
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

// ========================================
// GAME LOGIC
// ========================================
function startGame(difficulty) {
    gameState.difficulty = difficulty;
    gameState.matchedPairs = 0;
    gameState.moves = 0;
    gameState.flippedCards = [];
    gameState.startTime = Date.now();

    // Determine grid size
    const gridSizes = {
        easy: 8,    // 4x2
        medium: 16, // 4x4
        hard: 24    // 4x6
    };

    const cardCount = gridSizes[difficulty];
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
    const gridClass = gameState.difficulty === 'easy' ? 'grid-4x2' :
                      gameState.difficulty === 'medium' ? 'grid-4x4' : 'grid-4x6';

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
            <div class="card-grid ${gridClass}">
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

        if (gameState.soundEnabled) {
            audioSystem.playNotes([523, 659, 784], gameState.soundTheme);
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
            audioSystem.playNotes([392, 330], gameState.soundTheme);
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

    if (gameState.soundEnabled) {
        audioSystem.playSweep(200, 800, gameState.soundTheme);
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
                        <button class="victory-btn" onclick="startGame('${gameState.difficulty}')">🔄 Main Lagi</button>
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

            <div class="difficulty-selection">
                <h3>Pilih Tingkat Kesulitan:</h3>
                <div class="difficulty-buttons">
                    <button class="difficulty-btn easy" onclick="startGame('easy')" title="8 kartu (4 pasang)">
                        😊 Mudah
                        <small>(4×2 kartu)</small>
                    </button>
                    <button class="difficulty-btn medium" onclick="startGame('medium')" title="16 kartu (8 pasang)">
                        🤔 Sedang
                        <small>(4×4 kartu)</small>
                    </button>
                    <button class="difficulty-btn hard" onclick="startGame('hard')" title="24 kartu (12 pasang)">
                        🧠 Sulit
                        <small>(4×6 kartu)</small>
                    </button>
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
        </div>
    `;

    updateStats();
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
    createBackgroundParticles();
    updateStats();
});
