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

// Cached DOM elements for performance
const DOM = {
    gameContent: null,
    wordDisplay: null,
    letterOptions: null,
    feedback: null,
    statsDisplay: null,
    progressBar: null
};

// Game State
let wordBuildingContent = [];
let currentLevel = 0;
let currentWord = null;
let selectedLetters = [];
let availableLetters = [];
let usedQuestions = [];
let shuffledQuestions = [];
let soundEnabled = true;
let musicEnabled = true;
let backgroundMusic = null;
let currentDifficulty = null;
let currentSoundTheme = 'fun'; // fun, calm, exciting
let currentVisualTheme = 'default'; // default, cotton-candy, ocean, sunset, forest
let currentBackgroundMusic = 'backsound3'; // Default background music
let availableBackgroundMusic = []; // Available background music files
let answerMode = 'click'; // click or input
let gameStats = {
    correct: 0,
    wrong: 0,
    total: 0
};
let totalQuestionsInSession = 0;
let completedQuestionsInSession = 0;
let backgroundParticles = [];

// ========================================
// AUDIO SYSTEM - Reuses single AudioContext
// ========================================
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.soundEnabled = true;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext not available:', e);
        }
    }

    getContext() {
        this.init();
        return this.ctx;
    }

    // Play a sequence of notes (for correct sound)
    playNotes(notes, waveType, duration, volume) {
        if (!soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            notes.forEach((frequency, index) => {
                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                oscillator.frequency.value = frequency;
                oscillator.type = waveType;

                gainNode.gain.setValueAtTime(volume, ctx.currentTime + index * 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.1 + duration);

                oscillator.start(ctx.currentTime + index * 0.1);
                oscillator.stop(ctx.currentTime + index * 0.1 + duration);
            });
        } catch (e) {
            console.warn('Error playing notes:', e);
        }
    }

    // Play a frequency sweep (for wrong sound)
    playSweep(startFreq, endFreq, waveType, duration, volume) {
        if (!soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
            oscillator.type = waveType;

            gainNode.gain.setValueAtTime(volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration + 0.1);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration + 0.1);
        } catch (e) {
            console.warn('Error playing sweep:', e);
        }
    }

    // Play a short click sound
    playClick() {
        if (!soundEnabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.setValueAtTime(800, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.05);
        } catch (e) {
            console.warn('Error playing click:', e);
        }
    }
}

// Create single audio system instance
const audioSystem = new AudioSystem();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Cache DOM elements
    cacheDOM();

    await loadQuestions();
    loadProgress();
    loadSoundSettings();
    loadAnswerMode();
    loadBackgroundMusicFiles();
    updateSoundThemeSelector();
    updateVisualThemeSelector();
    updateBackgroundMusicSelector();
    updateDifficultyDisplay();
    applyVisualTheme();
    initBackgroundMusic();
    createBackgroundParticles();
    setupKeyboardSupport();

    // Log device info for debugging
    console.log('Device Info:', { isMobile, isTablet, isLowEndDevice, prefersReducedMotion, particleConfig: PARTICLE_CONFIG });
});

// Cache DOM elements for better performance
function cacheDOM() {
    DOM.gameContent = document.getElementById('game-content');
    DOM.statsDisplay = document.getElementById('statsDisplay');
    DOM.progressBar = document.getElementById('progressBar');
}

// ========================================
// BACKGROUND PARTICLES SYSTEM
// ========================================
function createBackgroundParticles() {
    if (prefersReducedMotion || PARTICLE_CONFIG.background === 0) return;

    const container = document.body;
    const particleCount = PARTICLE_CONFIG.background;
    const shapes = ['circle', 'star'];
    const starEmojis = ['✨', '⭐', '💫', '🌟'];

    // Remove existing particles
    backgroundParticles.forEach(p => p.remove());
    backgroundParticles = [];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const size = 8 + Math.random() * 16;

        particle.className = `bg-particle ${shape} float`;

        if (shape === 'star') {
            particle.textContent = starEmojis[Math.floor(Math.random() * starEmojis.length)];
            particle.style.fontSize = `${size}px`;
        } else {
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
        }

        // Random position
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        // Random animation parameters
        const duration = 15 + Math.random() * 20;
        const delay = Math.random() * -20;
        const moveX = (Math.random() - 0.5) * 100;
        const moveY = (Math.random() - 0.5) * 100;

        particle.style.setProperty('--duration', `${duration}s`);
        particle.style.setProperty('--delay', `${delay}s`);
        particle.style.setProperty('--moveX', `${moveX}px`);
        particle.style.setProperty('--moveY', `${moveY}px`);

        container.appendChild(particle);
        backgroundParticles.push(particle);
    }
}

// Recreate particles when theme changes
function recreateParticles() {
    requestAnimationFrame(() => {
        createBackgroundParticles();
    });
}

// ========================================
// OPTIMIZED ANIMATION HELPERS
// ========================================
// Use requestAnimationFrame for smoother animations
function animateElement(element, keyframes, options) {
    if (!element) return null;

    // Use Web Animations API with RAF
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const animation = element.animate(keyframes, options);
            animation.onfinish = resolve;
        });
    });
}

// Throttle function for performance
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Handle window resize - recreate particles on orientation change
window.addEventListener('resize', debounce(() => {
    createBackgroundParticles();
}, 500));

// Load questions from localStorage or JSON file
async function loadQuestions() {
    // Load from questions.json file only (requires web server)
    try {
        const response = await fetch('questions.json');
        if (response.ok) {
            const data = await response.json();
            
            // Check if JSON is empty or invalid
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.error('questions.json is empty or invalid');
                wordBuildingContent = getDefaultQuestions();
            } else {
                wordBuildingContent = data;
            }
        } else {
            console.error('Failed to load questions.json (status:', response.status, ')');
            wordBuildingContent = getDefaultQuestions();
        }
    } catch (error) {
        console.error('Error loading questions.json:', error);
        wordBuildingContent = getDefaultQuestions();
    }
}

// Minimal fallback (only 3 questions - requires questions.json to work properly)
function getDefaultQuestions() {
    return [
        { word: 'MEJA', emoji: '📖', imageUrl: '', hint: 'Tempat untuk belajar', difficulty: 'easy' },
        { word: 'KURSI', emoji: '🪑', imageUrl: '', hint: 'Alat untuk duduk', difficulty: 'easy' },
        { word: 'BUKU', emoji: '📚', imageUrl: '', hint: 'Alat untuk membaca', difficulty: 'easy' }
    ];
}

// Save custom questions to localStorage
function saveCustomQuestions() {
    try {
        localStorage.setItem('customQuestions', JSON.stringify(wordBuildingContent));
    } catch (e) {
        console.warn('Cannot save custom questions to localStorage:', e);
        alert('Cannot save questions. Storage may be full or disabled.');
    }
}

// Load saved progress
function loadProgress() {
    const savedStats = localStorage.getItem('gameStats');
    if (savedStats) {
        try {
            gameStats = JSON.parse(savedStats);
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    }
}

// Load sound settings
function loadSoundSettings() {
    try {
        const saved = localStorage.getItem('soundEnabled');
        if (saved !== null) {
            soundEnabled = saved === 'true';
        }

        const savedMusic = localStorage.getItem('musicEnabled');
        if (savedMusic !== null) {
            musicEnabled = savedMusic === 'true';
        }

        const savedTheme = localStorage.getItem('soundTheme');
        if (savedTheme) {
            currentSoundTheme = savedTheme;
        }

        const savedVisualTheme = localStorage.getItem('visualTheme');
        if (savedVisualTheme) {
            currentVisualTheme = savedVisualTheme;
        }

        const savedBackgroundMusic = localStorage.getItem('backgroundMusic');
        if (savedBackgroundMusic) {
            currentBackgroundMusic = savedBackgroundMusic;
        }
    } catch (e) {
        console.warn('Cannot load sound settings from localStorage:', e);
        // Use default values
        soundEnabled = true;
        musicEnabled = true;
        currentSoundTheme = 'fun';
        currentVisualTheme = 'default';
        currentBackgroundMusic = 'backsound3';
    }
}

// Load available background music files
function loadBackgroundMusicFiles() {
    // Available background music files
    availableBackgroundMusic = [
        { name: 'backsound1', displayName: '🎵 Musik 1' },
        { name: 'backsound2', displayName: '🎶 Musik 2' },
        { name: 'backsound3', displayName: '🎼 Musik 3' }
    ];
    
    // Validate if files exist
    availableBackgroundMusic = availableBackgroundMusic.filter(track => {
        const audio = new Audio(`../audio/backsound/${track.name}.mp3`);
        return true; // Assume they exist since user said they added them
    });
}

// Update background music selector
function updateBackgroundMusicSelector() {
    const musicSelector = document.getElementById('backgroundMusicSelector');
    if (musicSelector) {
        musicSelector.innerHTML = availableBackgroundMusic.map(track => 
            `<option value="${track.name}">${track.displayName}</option>`
        ).join('');
        musicSelector.value = currentBackgroundMusic;
    }
}

// Save sound settings
function saveSoundSettings() {
    try {
        localStorage.setItem('soundEnabled', soundEnabled.toString());
        localStorage.setItem('musicEnabled', musicEnabled.toString());
        localStorage.setItem('soundTheme', currentSoundTheme);
        localStorage.setItem('visualTheme', currentVisualTheme);
        localStorage.setItem('backgroundMusic', currentBackgroundMusic);
    } catch (e) {
        console.warn('Cannot save sound settings to localStorage:', e);
        alert('Cannot save settings. Storage may be full or disabled.');
    }
}

// Toggle sound on/off
function toggleSound() {
    soundEnabled = !soundEnabled;
    saveSoundSettings();
    updateSoundButton();
}

// Update sound button display
function updateSoundButton() {
    const soundBtn = document.getElementById('soundToggle');
    if (soundBtn) {
        soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
        soundBtn.title = soundEnabled ? 'Matikan suara' : 'Hidupkan suara';
    }
}

// Initialize background music
function initBackgroundMusic() {
    if (!backgroundMusic) {
        backgroundMusic = new Audio();
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.3;
        
        // Add event listener to ensure loop works
        backgroundMusic.addEventListener('ended', () => {
            // This will trigger when audio ends
            // With loop=true, this shouldn't happen, but ensures it loops
            backgroundMusic.currentTime = 0;
            backgroundMusic.play();
        });
    }
    updateMusicButton();
    updateBackgroundMusicSelector();
}

// Create background music track using Web Audio API
function createBackgroundMusicTrack() {
    // We'll use a simple melody pattern that loops
    // For now, we'll just handle the toggle - you can add actual music file later
    // backgroundMusic.src = 'audio/background-music.mp3';
}

// Change background music
function changeBackgroundMusic(musicName) {
    currentBackgroundMusic = musicName;
    saveSoundSettings();
    
    // Reload music if it's currently playing
    if (musicEnabled) {
        stopBackgroundMusic();
        playBackgroundMusic();
    }
    
    // Update selector
    updateBackgroundMusicSelector();
}

// Toggle music on/off
function toggleMusic() {
    musicEnabled = !musicEnabled;
    saveSoundSettings();
    updateMusicButton();

    if (musicEnabled) {
        playBackgroundMusic();
    } else {
        stopBackgroundMusic();
    }
}

// Update music button display
function updateMusicButton() {
    const musicBtn = document.getElementById('musicToggle');
    if (musicBtn) {
        musicBtn.textContent = musicEnabled ? '🎵' : '🎶';
        musicBtn.title = musicEnabled ? 'Matikan musik' : 'Hidupkan musik';
    }
}

// Play background music
function playBackgroundMusic() {
    if (backgroundMusic && musicEnabled && currentBackgroundMusic) {
        const musicPath = `../audio/backsound/${currentBackgroundMusic}.mp3`;
        backgroundMusic.src = musicPath;
        backgroundMusic.load();
        backgroundMusic.play().then(() => {
            console.log('Background music playing successfully');
        }).catch(e => {
            console.warn('Could not play background music:', e);
            console.warn('Error details:', {
                src: backgroundMusic.src,
                error: e,
                currentTime: backgroundMusic.currentTime,
                readyState: backgroundMusic.readyState
            });
        });
    }
}

// Stop background music
function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

// Change sound theme
function changeSoundTheme(theme) {
    currentSoundTheme = theme;
    saveSoundSettings();
    
    // Play a preview sound of the new theme
    if (soundEnabled) {
        playCorrectSound();
    }
}

// Update sound theme selector
function updateSoundThemeSelector() {
    const themeSelect = document.getElementById('soundTheme');
    if (themeSelect) {
        themeSelect.value = currentSoundTheme;
    }
}

// Change visual theme
function changeVisualTheme(theme) {
    currentVisualTheme = theme;
    saveSoundSettings();
    applyVisualTheme();
}

// Apply visual theme
function applyVisualTheme() {
    const body = document.body;

    // Remove all theme classes
    body.classList.remove('cotton-candy-theme', 'ocean-theme', 'sunset-theme', 'forest-theme');

    // Add current theme class
    if (currentVisualTheme === 'cotton-candy') {
        body.classList.add('cotton-candy-theme');
    } else if (currentVisualTheme === 'ocean') {
        body.classList.add('ocean-theme');
    } else if (currentVisualTheme === 'sunset') {
        body.classList.add('sunset-theme');
    } else if (currentVisualTheme === 'forest') {
        body.classList.add('forest-theme');
    }

    // Recreate particles with new theme colors
    recreateParticles();
}

// Update visual theme selector
function updateVisualThemeSelector() {
    const themeSelect = document.getElementById('visualTheme');
    if (themeSelect) {
        themeSelect.value = currentVisualTheme;
    }
}

// Update difficulty display in header
function updateDifficultyDisplay() {
    const homeButton = document.getElementById('homeButton');
    const selectorContainer = document.getElementById('difficultySelectorContainer');
    const difficultySelector = document.getElementById('difficultySelector');

    // Always show home button
    if (homeButton) homeButton.style.display = 'inline-flex';

    if (currentDifficulty) {
        // Show difficulty selector during gameplay
        if (selectorContainer) selectorContainer.style.display = 'flex';
        if (difficultySelector) difficultySelector.value = currentDifficulty;
    } else {
        // Hide difficulty selector on start screen
        if (selectorContainer) selectorContainer.style.display = 'none';
    }
}

// Change difficulty during gameplay
function changeDifficulty(newDifficulty) {
    if (newDifficulty === currentDifficulty) return;
    
    // Show custom confirmation dialog
    const difficultyNames = {
        'easy': 'Mudah (3-4 huruf)',
        'medium': 'Sedang (5-6 huruf)',
        'hard': 'Sulit (7+ huruf)'
    };
    
    const difficultyEmojis = {
        'easy': '😊',
        'medium': '🤔',
        'hard': '🧠'
    };
    
    showDifficultyChangeDialog(newDifficulty, difficultyNames[newDifficulty], difficultyEmojis[newDifficulty]);
}

// Show custom difficulty change dialog
function showDifficultyChangeDialog(newDifficulty, difficultyName, emoji) {
    const dialog = document.createElement('div');
    dialog.className = 'difficulty-dialog-overlay';
    dialog.innerHTML = `
        <div class="difficulty-dialog">
            <div class="difficulty-dialog-content">
                <div class="difficulty-emoji">${emoji}</div>
                <h3>Ganti Tingkat Kesulitan?</h3>
                <p>Pindah ke tingkat <strong>${difficultyName}</strong></p>
                <p class="difficulty-warning">⚠️ Progres saat ini akan direset</p>
                <div class="difficulty-dialog-buttons">
                    <button class="difficulty-cancel-btn" onclick="closeDifficultyDialog()">Batal</button>
                    <button class="difficulty-confirm-btn" onclick="confirmDifficultyChange('${newDifficulty}')">Ya, Ganti</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add enter key support
    document.addEventListener('keydown', handleDifficultyDialogKey);
}

// Close difficulty change dialog
function closeDifficultyDialog() {
    const dialog = document.querySelector('.difficulty-dialog-overlay');
    if (dialog) {
        dialog.remove();
        document.removeEventListener('keydown', handleDifficultyDialogKey);
        // Revert selector back to current difficulty
        document.getElementById('difficultySelector').value = currentDifficulty;
    }
}

// Confirm difficulty change
function confirmDifficultyChange(newDifficulty) {
    closeDifficultyDialog();
    startGame(newDifficulty);
}

// Handle keyboard events for difficulty dialog
function handleDifficultyDialogKey(event) {
    if (event.key === 'Escape') {
        closeDifficultyDialog();
    } else if (event.key === 'Enter') {
        const dialog = document.querySelector('.difficulty-dialog-overlay');
        if (dialog) {
            const confirmBtn = dialog.querySelector('.difficulty-confirm-btn');
            if (confirmBtn) {
                const difficulty = confirmBtn.getAttribute('onclick').match(/'([^']+)'/)[1];
                confirmDifficultyChange(difficulty);
            }
        }
    }
}

// Update statistics display
function updateStatsDisplay() {
    const statsContainer = document.getElementById('statsDisplay');
    if (statsContainer) {
        const accuracy = gameStats.total > 0 ? Math.round((gameStats.correct / gameStats.total) * 100) : 0;
        statsContainer.innerHTML = `
            <div class="stats-item">
                <span class="stats-label">✅ Benar:</span>
                <span class="stats-value">${gameStats.correct}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">❌ Salah:</span>
                <span class="stats-value">${gameStats.wrong}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">📊 Akurasi:</span>
                <span class="stats-value">${accuracy}%</span>
            </div>
        `;
    }
}

// Update statistics when answer is correct
function updateCorrectAnswer() {
    gameStats.correct++;
    gameStats.total++;
    saveProgress();
    updateStatsDisplay();
}

// Update statistics when answer is wrong
function updateWrongAnswer() {
    gameStats.wrong++;
    gameStats.total++;
    saveProgress();
    updateStatsDisplay();
}

// Save progress
function saveProgress() {
    try {
        localStorage.setItem('gameStats', JSON.stringify(gameStats));
    } catch (e) {
        console.warn('localStorage not available:', e);
        // Fallback to sessionStorage
        if (typeof sessionStorage !== 'undefined') {
            try {
                sessionStorage.setItem('gameStats', JSON.stringify(gameStats));
            } catch (se) {
                console.warn('sessionStorage also not available:', se);
                // In-memory fallback (stats will reset on refresh)
                console.warn('Stats will reset on page refresh');
            }
        }
    }
}

// Start game
async function startGame(difficulty = null) {
    currentDifficulty = difficulty;
    currentLevel = 0;
    usedQuestions = [];

    // Filter questions by difficulty
    let filteredQuestions = difficulty
        ? wordBuildingContent.filter(q => q.difficulty === difficulty)
        : [...wordBuildingContent];

    shuffledQuestions = shuffleArray(filteredQuestions);

    // Reset stats for new game session
    gameStats = {
        correct: 0,
        wrong: 0,
        total: 0
    };

    // Initialize progress tracking
    totalQuestionsInSession = shuffledQuestions.length;
    completedQuestionsInSession = 0;

    saveProgress();

    // Show stats container
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        statsContainer.classList.add('visible');
    }

    // Show progress container
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'block';
    }

    updateStatsDisplay();
    updateProgressBar();
    updateSoundButton();
    updateMusicButton();

    // Start background music if enabled
    if (musicEnabled) {
        playBackgroundMusic();
    }

    await showWordGame();
}

// Update progress bar
function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');

    if (progressBar && progressText && progressPercent) {
        const percentage = totalQuestionsInSession > 0
            ? Math.round((completedQuestionsInSession / totalQuestionsInSession) * 100)
            : 0;

        progressBar.style.width = percentage + '%';
        progressText.textContent = `${completedQuestionsInSession} / ${totalQuestionsInSession}`;
        progressPercent.textContent = percentage + '%';
    }
}

// Show Admin Panel
function showAdminPanel() {
    // Hide stats container
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        statsContainer.classList.remove('visible');
    }

    // Hide progress container
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }

    const content = document.getElementById('game-content');
    const questionsList = wordBuildingContent.map((q, index) => {
        const displayIcon = q.emoji 
            ? `<span class="question-emoji">${q.emoji}</span>` 
            : (q.imageUrl ? `<span class="question-emoji">🖼️</span>` : `<span class="question-emoji">❓</span>`);
        const displayNote = q.emoji 
            ? '' 
            : (q.imageUrl ? `<br><small>🖼️ Gambar URL: ${q.imageUrl.substring(0, 40)}...</small>` : '<br><small>⚠️ Tidak ada emoji atau gambar</small>');
        
        return `
            <div class="admin-question-item">
                <div class="question-info">
                    ${displayIcon}
                    <strong>${q.word}</strong> - ${q.hint}
                    ${displayNote}
                </div>
                <div class="question-actions">
                    <button onclick="editQuestion(${index})" class="edit-btn-small">✏️</button>
                    <button onclick="deleteQuestion(${index})" class="delete-btn-small">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
    
    content.innerHTML = `
        <div class="admin-panel">
            <h2>⚙️ Kelola Pertanyaan</h2>
            <p>Total pertanyaan: ${wordBuildingContent.length}</p>
            <p style="font-size: 0.9em; color: #666; margin-bottom: 20px;">
                💡 <strong>Prioritas tampilan:</strong> Jika ada emoji, tampilkan emoji. Jika tidak ada emoji, tampilkan gambar URL.
            </p>
            
            <div class="admin-actions">
                <button onclick="showAddQuestionForm()" class="admin-btn">➕ Tambah Pertanyaan</button>
                <button onclick="resetToDefault()" class="admin-btn">🔄 Reset ke Default</button>
                <button onclick="location.reload()" class="admin-btn">🏠 Kembali</button>
            </div>
            
            <div class="questions-list">
                ${questionsList}
            </div>
        </div>
    `;
}

// Show add question form
function showAddQuestionForm(editIndex = null) {
    const isEdit = editIndex !== null;
    const question = isEdit ? wordBuildingContent[editIndex] : { word: '', emoji: '📖', imageUrl: '', hint: '' };
    
    const content = document.getElementById('game-content');
    content.innerHTML = `
        <div class="admin-panel">
            <h2>${isEdit ? '✏️ Edit' : '➕ Tambah'} Pertanyaan</h2>
            <form class="question-form" onsubmit="saveQuestion(event, ${editIndex})">
                <div class="form-group">
                    <label>Kata (huruf besar):</label>
                    <input type="text" id="wordInput" value="${question.word}" required 
                           pattern="[A-Z]+" title="Gunakan huruf besar saja">
                </div>
                
                <div class="form-group">
                    <label>Emoji (prioritas utama):</label>
                    <input type="text" id="emojiInput" value="${question.emoji}" 
                           placeholder="Contoh: 🐱">
                    <small>Emoji akan ditampilkan jika diisi. Kosongkan jika ingin pakai gambar URL.</small>
                </div>
                
                <div class="form-group">
                    <label>URL Gambar (jika tidak ada emoji):</label>
                    <input type="url" id="imageUrlInput" value="${question.imageUrl}" 
                           placeholder="https://example.com/image.jpg">
                    <small>Gambar hanya ditampilkan jika emoji kosong</small>
                </div>
                
                <div class="form-group">
                    <label>Petunjuk:</label>
                    <input type="text" id="hintInput" value="${question.hint}" required>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="admin-btn">💾 Simpan</button>
                    <button type="button" onclick="showAdminPanel()" class="admin-btn">❌ Batal</button>
                </div>
            </form>
        </div>
    `;
}

// Save question
function saveQuestion(event, editIndex) {
    event.preventDefault();
    
    const word = document.getElementById('wordInput').value.toUpperCase();
    const emoji = document.getElementById('emojiInput').value.trim();
    const imageUrl = document.getElementById('imageUrlInput').value.trim();
    const hint = document.getElementById('hintInput').value;
    
    if (!emoji && !imageUrl) {
        alert('Harus ada emoji ATAU gambar URL!');
        return;
    }
    
    const newQuestion = { word, emoji, imageUrl, hint };
    
    if (editIndex !== null) {
        wordBuildingContent[editIndex] = newQuestion;
    } else {
        wordBuildingContent.push(newQuestion);
    }
    
    saveCustomQuestions();
    showAdminPanel();
}

// Edit question
function editQuestion(index) {
    showAddQuestionForm(index);
}

// Delete question
function deleteQuestion(index) {
    if (confirm(`Hapus pertanyaan "${wordBuildingContent[index].word}"?`)) {
        wordBuildingContent.splice(index, 1);
        saveCustomQuestions();
        showAdminPanel();
    }
}

// Reset to default
function resetToDefault() {
    if (confirm('Reset semua pertanyaan ke default? Perubahan kustom akan hilang.')) {
        localStorage.removeItem('customQuestions');
        location.reload();
    }
}

// Shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Show celebration popup with confetti
function showCelebration(word) {
    // Play correct sound
    if (soundEnabled) {
        playCorrectSound();
    }

    // Get random celebration message
    const celebrations = [
        { emoji: '🎉', text: 'Hebat!', subtext: 'Benar sekali!' },
        { emoji: '⭐', text: 'Luar Biasa!', subtext: 'Kamu pintar!' },
        { emoji: '🌟', text: 'Sempurna!', subtext: 'Mantap!' },
        { emoji: '🎊', text: 'Bagus Sekali!', subtext: 'Terus semangat!' },
        { emoji: '✨', text: 'Keren!', subtext: 'Jawaban tepat!' },
        { emoji: '🏆', text: 'Juara!', subtext: 'Kamu hebat!' },
        { emoji: '💫', text: 'Bravo!', subtext: 'Sangat bagus!' },
        { emoji: '🎯', text: 'Tepat!', subtext: 'Excellent!' }
    ];

    const celebration = celebrations[Math.floor(Math.random() * celebrations.length)];

    // Create simple confetti
    createSimpleConfetti();

    // Create celebration popup
    const popup = document.createElement('div');
    popup.className = 'celebration-popup';
    popup.innerHTML = `
        <div class="celebration-content">
            <div class="celebration-emoji">${celebration.emoji}</div>
            <div class="celebration-text">${celebration.text}</div>
            <div class="celebration-word">${word}</div>
            <div class="celebration-subtext">${celebration.subtext}</div>
        </div>
    `;

    document.body.appendChild(popup);

    // Remove popup after delay
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

// Show wrong answer popup
function showWrongAnswer() {
    // Play wrong sound
    if (soundEnabled) {
        playWrongSound();
    }

    // Get random encouraging message
    const encouragements = [
        { emoji: '🤔', text: 'Oops!', subtext: 'Coba lagi ya!' },
        { emoji: '😊', text: 'Hampir!', subtext: 'Coba sekali lagi!' },
        { emoji: '💪', text: 'Ayo!', subtext: 'Kamu pasti bisa!' },
        { emoji: '🌟', text: 'Jangan menyerah!', subtext: 'Coba yang lain!' },
        { emoji: '😉', text: 'Belum tepat!', subtext: 'Semangat!' },
        { emoji: '🎯', text: 'Coba lagi!', subtext: 'Pasti bisa!' },
        { emoji: '✨', text: 'Hmm...', subtext: 'Pikir sekali lagi!' },
        { emoji: '🤗', text: 'Tidak apa-apa!', subtext: 'Terus mencoba!' }
    ];

    const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

    // Shake the letter slots
    shakeletterSlots();

    // Create wrong answer popup
    const popup = document.createElement('div');
    popup.className = 'wrong-popup';
    popup.innerHTML = `
        <div class="wrong-content">
            <div class="wrong-emoji">${encouragement.emoji}</div>
            <div class="wrong-text">${encouragement.text}</div>
            <div class="wrong-subtext">${encouragement.subtext}</div>
        </div>
    `;

    document.body.appendChild(popup);

    // Remove popup after delay
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => popup.remove(), 300);
    }, 1500);
}

// Shake letter slots when wrong
function shakeletterSlots() {
    const slots = document.querySelectorAll('.letter-slot.filled');
    slots.forEach(slot => {
        slot.classList.add('shake-wrong');
        setTimeout(() => {
            slot.classList.remove('shake-wrong');
        }, 500);
    });
}

// Create exciting confetti effect - optimized for mobile
function createSimpleConfetti() {
    // Skip confetti if user prefers reduced motion
    if (prefersReducedMotion) return;

    const colors = ['#ff6b6b', '#4ecdc4', '#764ba2', '#667eea', '#ffd93d', '#ff9a9e', '#a18cd1', '#fbc2eb'];
    const confettiCount = PARTICLE_CONFIG.confetti; // Use device-optimized count
    const emojis = ['⭐', '✨', '💫', '🌟'];

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
    const confettiElements = [];

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        const isEmoji = Math.random() > 0.7; // 30% chance of emoji
        const size = isEmoji ? 16 : 10;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 2 + Math.random() * 1.5;
        const rotation = Math.random() * 720 + 360; // 1-3 full rotations

        confetti.className = 'confetti-simple';

        if (isEmoji) {
            confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            confetti.style.cssText = `
                position: fixed;
                font-size: ${size}px;
                left: ${left}%;
                top: -30px;
                animation: confettiFallEmoji ${duration}s ease-out ${delay}s forwards;
                z-index: 9999;
                pointer-events: none;
                will-change: transform;
            `;
        } else {
            confetti.style.cssText = `
                position: fixed;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                left: ${left}%;
                top: -30px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                animation: confettiFall ${duration}s ease-out ${delay}s forwards;
                z-index: 9999;
                pointer-events: none;
                will-change: transform;
                --rotation: ${rotation}deg;
            `;
        }

        fragment.appendChild(confetti);
        confettiElements.push({ element: confetti, removeTime: (duration + delay) * 1000 + 100 });
    }

    // Append all at once for better performance
    document.body.appendChild(fragment);

    // Schedule removal
    confettiElements.forEach(({ element, removeTime }) => {
        setTimeout(() => element.remove(), removeTime);
    });
}

// Word Building Game
async function showWordGame() {
    // Get next unused question
    if (currentLevel < shuffledQuestions.length) {
        currentWord = shuffledQuestions[currentLevel];
        usedQuestions.push(currentWord);
    } else if (usedQuestions.length < wordBuildingContent.length) {
        // Reshuffle remaining unused questions
        const remainingQuestions = wordBuildingContent.filter(q => 
            !usedQuestions.some(used => used.word === q.word)
        );
        shuffledQuestions = shuffleArray(remainingQuestions);
        currentLevel = 0;
        currentWord = shuffledQuestions[currentLevel];
        usedQuestions.push(currentWord);
    } else {
        // All questions have been used, start over
        usedQuestions = [];
        shuffledQuestions = shuffleArray([...wordBuildingContent]);
        currentLevel = 0;
        currentWord = shuffledQuestions[currentLevel];
        usedQuestions.push(currentWord);
    }
    
    selectedLetters = [];
    previousInputLength = 0; // Reset for input mode animation

    // Create available letters (correct letters + some extra)
    const correctLetters = currentWord.word.split('');
    const extraLetters = ['A', 'I', 'U', 'E', 'O', 'N', 'G', 'H', 'R', 'T', 'S'];
    const randomExtras = extraLetters.sort(() => Math.random() - 0.5).slice(0, 3);
    availableLetters = shuffleArray([...correctLetters, ...randomExtras]);
    
    const content = document.getElementById('game-content');
    
    const imageDisplay = currentWord.emoji 
        ? `<div class="emoji">${currentWord.emoji}</div>`
        : (currentWord.imageUrl 
            ? `<img src="${currentWord.imageUrl}" alt="${currentWord.word}" class="word-image">` 
            : `<div class="emoji">❓</div>`);
    
    // Update difficulty display in header
    updateDifficultyDisplay();
    
    // Render game (simplified without complex audio detection)
    renderGame(currentWord.word, imageDisplay, currentWord.hint);
}

// Render game (simplified version)
function renderGame(word, imageDisplay, hint) {
    // Always show voice button - will handle audio detection in speakWord function
    const voiceButton = `
        <button class="voice-btn" onclick="speakWord('${word}')" title="Dengar pengucapan">
            🔊 Dengar
        </button>
    `;
    
    const content = document.getElementById('game-content');
    
    // Render based on answer mode
    if (answerMode === 'input') {
        // Manual input mode
        content.innerHTML = `
            <div class="word-game">
                <div class="picture-display">
                    <div class="image-container">
                        ${imageDisplay}
                        ${voiceButton}
                    </div>
                    <div class="hint">Petunjuk: ${hint}</div>
                </div>
                
                <div class="word-display" id="wordDisplay">
                    ${word.split('').map(() => '<div class="letter-slot"></div>').join('')}
                </div>
                
                <!-- Hidden input for keyboard capture -->
                <input type="text" 
                       id="manualInput" 
                       maxlength="${word.length}"
                       autocomplete="off"
                       autocorrect="off"
                       autocapitalize="characters"
                       style="position: absolute; left: -9999px; opacity: 0;"
                       oninput="handleInputTyping(this)">
                
                <div class="action-buttons">
                    <button class="clear-btn" onclick="clearManualInput()">🗑️ Hapus</button>
                    <button class="skip-btn" onclick="skipQuestion()">⏭️ Lewati</button>
                </div>
                
                <div id="feedback"></div>
            </div>
        `;
        // Focus on hidden input after a short delay
        setTimeout(() => {
            const input = document.getElementById('manualInput');
            if (input) input.focus();
        }, 200);
    } else {
        // Click mode (original)
        content.innerHTML = `
            <div class="word-game">
                <div class="picture-display">
                    <div class="image-container">
                        ${imageDisplay}
                        ${voiceButton}
                    </div>
                    <div class="hint">Petunjuk: ${hint}</div>
                </div>
                
                <div class="word-display" id="wordDisplay">
                    ${word.split('').map(() => '<div class="letter-slot"></div>').join('')}
                </div>
                
                <div class="letter-options" id="letterOptions">
                    ${availableLetters.map((letter, index) => `
                        <button class="letter-btn" onclick="selectLetter('${letter}', ${index})" id="letter-${index}">
                            ${letter}
                        </button>
                    `).join('')}
                </div>
                
                <div class="action-buttons">
                    <button class="clear-btn" onclick="clearSelection()">🗑️ Hapus</button>
                    <button class="skip-btn" onclick="skipQuestion()">⏭️ Lewati</button>
                </div>
                
                <div id="feedback"></div>
            </div>
        `;
    }
}

function selectLetter(letter, index) {
    if (selectedLetters.length < currentWord.word.length) {
        selectedLetters.push(letter);
        updateWordDisplay();
        
        // Disable the selected letter button
        document.getElementById(`letter-${index}`).disabled = true;
        
        // Auto-check if word is complete
        if (selectedLetters.length === currentWord.word.length) {
            setTimeout(checkAnswer, 500);
        }
    }
}

function updateWordDisplay() {
    const slots = document.querySelectorAll('.letter-slot');
    selectedLetters.forEach((letter, index) => {
        if (slots[index] && !slots[index].classList.contains('filled')) {
            // Add letter with animation
            slots[index].textContent = letter;
            slots[index].classList.add('filled');

            // Play subtle click sound for feedback
            if (soundEnabled && !prefersReducedMotion) {
                playLetterClickSound();
            }
        } else if (slots[index]) {
            slots[index].textContent = letter;
        }
    });
}

// Subtle click sound for letter selection
function playLetterClickSound() {
    audioSystem.playClick();
}

function clearSelection() {
    selectedLetters = [];
    
    // Clear all slots
    document.querySelectorAll('.letter-slot').forEach(slot => {
        slot.textContent = '';
        slot.classList.remove('filled');
    });
    
    // Enable all letter buttons
    document.querySelectorAll('.letter-btn').forEach(btn => {
        btn.disabled = false;
    });
    
    // Clear feedback
    document.getElementById('feedback').innerHTML = '';
}

// Set answer mode (click or input)
function setAnswerMode(mode) {
    answerMode = mode;
    
    // Update active button styling
    document.querySelectorAll('.answer-mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.answerMode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Save preference to localStorage
    try {
        localStorage.setItem('answerMode', mode);
    } catch (e) {
        console.warn('Cannot save answer mode to localStorage:', e);
    }
}

// Load answer mode preference
function loadAnswerMode() {
    try {
        const saved = localStorage.getItem('answerMode');
        if (saved && (saved === 'click' || saved === 'input')) {
            answerMode = saved;
            // Update UI to match saved preference
            document.querySelectorAll('.answer-mode-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.answerMode === answerMode) {
                    btn.classList.add('active');
                }
            });
        }
    } catch (e) {
        console.warn('Cannot load answer mode from localStorage:', e);
    }
}

// Validate word before checking answer
function validateWord(word) {
    if (!word || typeof word !== 'string') return false;
    if (word.length < 2 || word.length > 12) return false;
    return true;
}

// Handle manual input submission
function submitManualInput() {
    const input = document.getElementById('manualInput');
    if (!input) return;
    
    const userInput = input.value.toUpperCase().trim();
    
    // Validate input
    if (!validateWord(userInput)) {
        return;
    }
    
    // Disable input while processing
    input.disabled = true;
    
    // Check the answer
    checkManualAnswer(userInput);
}

// Check manual input answer
function checkManualAnswer(userInput) {
    const feedback = document.getElementById('feedback');
    
    // Validate words
    if (!validateWord(userInput) || !validateWord(currentWord.word)) {
        console.warn('Invalid word detected:', { userInput, currentWord });
        // Re-enable input
        const input = document.getElementById('manualInput');
        if (input) input.disabled = false;
        return;
    }
    
    if (userInput === currentWord.word) {
        // Update statistics
        updateCorrectAnswer();
        
        // Show celebration popup and confetti
        showCelebration(currentWord.word);
        
        // Auto-advance to next question after delay
        setTimeout(() => {
            nextWord();
        }, 2500);
    } else {
        // Update statistics
        updateWrongAnswer();
        
        // Show wrong answer popup
        showWrongAnswer();
        
        // Re-enable input after delay
        setTimeout(() => {
            const input = document.getElementById('manualInput');
            if (input) {
                input.disabled = false;
                input.value = '';
            }
            
            // Clear letter slots as well
            const slots = document.querySelectorAll('.letter-slot');
            slots.forEach(slot => {
                slot.textContent = '';
                slot.classList.remove('filled');
            });
        }, 2000);
    }
}

// Clear manual input
function clearManualInput() {
    const input = document.getElementById('manualInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    // Clear slots as well
    const slots = document.querySelectorAll('.letter-slot');
    slots.forEach(slot => {
        slot.textContent = '';
        slot.classList.remove('filled');
    });
    // Reset input tracking
    previousInputLength = 0;
}

// Handle input typing in real-time
// Track previous input length for animation
let previousInputLength = 0;

function handleInputTyping(inputElement) {
    const value = inputElement.value.toUpperCase().trim();
    const slots = document.querySelectorAll('.letter-slot');
    const maxLetters = currentWord.word.length;
    const currentLength = Math.min(value.length, maxLetters);

    // Determine if letter was added or removed
    const isAdding = currentLength > previousInputLength;

    // Update slots
    slots.forEach((slot, index) => {
        if (index < currentLength) {
            const letter = value[index];
            const wasEmpty = !slot.classList.contains('filled');

            slot.textContent = letter;

            if (wasEmpty && isAdding) {
                // New letter added - trigger animation
                slot.classList.remove('filled');
                // Force reflow to restart animation
                void slot.offsetWidth;
                slot.classList.add('filled');

                // Play click sound for new letter
                if (soundEnabled && !prefersReducedMotion) {
                    playLetterClickSound();
                }
            } else {
                slot.classList.add('filled');
            }
        } else {
            // Clear this slot
            slot.textContent = '';
            slot.classList.remove('filled');
        }
    });

    previousInputLength = currentLength;

    // Auto-submit if word is complete (same length as answer)
    if (value.length === maxLetters) {
        setTimeout(() => {
            submitManualInput();
        }, 300);
    }
}

function checkAnswer() {
    const formedWord = selectedLetters.join('');
    const feedback = document.getElementById('feedback');
    
    // Validate formed word
    if (!validateWord(formedWord) || !validateWord(currentWord.word)) {
        console.warn('Invalid word detected:', { formedWord, currentWord });
        return;
    }
    
    if (formedWord === currentWord.word) {
        // Update statistics
        updateCorrectAnswer();
        
        // Show celebration popup and confetti
        showCelebration(currentWord.word);
        
        // Disable all buttons
        document.querySelectorAll('.letter-btn').forEach(btn => {
            btn.disabled = true;
        });
        
        // Auto-advance to next question after delay
        setTimeout(() => {
            nextWord();
        }, 2500);
    } else {
        // Update statistics
        updateWrongAnswer();
        
        // Show wrong answer popup
        showWrongAnswer();
        
        // Clear selection after delay
        setTimeout(clearSelection, 2000);
    }
}

async function nextWord() {
    currentLevel++;
    completedQuestionsInSession++;
    updateProgressBar();

    if (currentLevel < shuffledQuestions.length) {
        await showWordGame();
    } else {
        showGameComplete();
    }
}

// Skip current question
function skipQuestion() {
    showSkipDialog();
}

// Show custom skip dialog
function showSkipDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'skip-dialog-overlay';
    dialog.innerHTML = `
        <div class="skip-dialog">
            <div class="skip-dialog-content">
                <div class="skip-emoji">🤔</div>
                <h3>Lewati Pertanyaan?</h3>
                <p>Yakin ingin melewati kata ini?</p>
                <div class="skip-dialog-buttons">
                    <button class="skip-cancel-btn" onclick="closeSkipDialog()">Tidak</button>
                    <button class="skip-confirm-btn" onclick="confirmSkip()">Ya, Lewati</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add enter key support
    document.addEventListener('keydown', handleSkipDialogKey);
}

// Close skip dialog
function closeSkipDialog() {
    const dialog = document.querySelector('.skip-dialog-overlay');
    if (dialog) {
        dialog.remove();
        document.removeEventListener('keydown', handleSkipDialogKey);
    }
}

// Confirm skip
function confirmSkip() {
    closeSkipDialog();
    // Don't count skipped questions in progress, just move to next
    currentLevel++;
    if (currentLevel < shuffledQuestions.length) {
        showWordGame();
    } else {
        showGameComplete();
    }
}

// Handle keyboard events for dialog
function handleSkipDialogKey(event) {
    if (event.key === 'Escape') {
        closeSkipDialog();
    } else if (event.key === 'Enter') {
        confirmSkip();
    }
}

// Game Complete
function showGameComplete() {
    const content = document.getElementById('game-content');
    const difficultyText = currentDifficulty === 'easy' ? 'Mudah' : 
                          currentDifficulty === 'medium' ? 'Sedang' : 
                          currentDifficulty === 'hard' ? 'Sulit' : '';
    
    content.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h2>🎉 Selesai! 🎉</h2>
            <p style="font-size: 1.5em; margin: 20px 0;">
                ${difficultyText ? `Kamu menyelesaikan semua kata level ${difficultyText}!` : 'Kamu hebat!'}
            </p>
            <div style="margin: 20px 0;">
                <button class="next-btn" onclick="startGame('${currentDifficulty}')" style="margin: 5px;">
                    🔄 Main Lagi
                </button>
                <button class="skip-btn" onclick="backToMenu()" style="margin: 5px;">
                    🏠 Menu Utama
                </button>
            </div>
        </div>
    `;
}

// Back to main menu
function backToMenu() {
    currentDifficulty = null;
    updateDifficultyDisplay();

    // Stop background music
    stopBackgroundMusic();

    // Hide progress and stats
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }

    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        statsContainer.classList.remove('visible');
    }

    // Navigate to main menu
    window.location.href = '../index.html';
}

// Voice Word Pronunciation
function speakWord(word) {
    if (!soundEnabled) return;
    
    // Store whether background music was playing
    const wasMusicPlaying = musicEnabled && backgroundMusic && !backgroundMusic.paused;
    
    // Pause background music temporarily so user can hear clearly
    if (wasMusicPlaying) {
        backgroundMusic.pause();
    }
    
    // Try to play MP3 file first
    const audioFile = `../audio/${word}.mp3`;
    const audio = new Audio(audioFile);
    
    // Resume background music when word audio finishes
    const resumeBackgroundMusic = () => {
        if (wasMusicPlaying) {
            backgroundMusic.play().catch(e => {
                console.warn('Could not resume background music:', e);
            });
        }
    };
    
    audio.addEventListener('canplaythrough', () => {
        audio.play();
    });
    
    audio.addEventListener('ended', () => {
        resumeBackgroundMusic();
    });
    
    audio.addEventListener('error', () => {
        // Fallback to Web Speech API if MP3 not found
        fallbackToSpeech(word, () => {
            // Resume after speech finishes
            setTimeout(resumeBackgroundMusic, 1000);
        });
    });
    
    // Start loading the audio
    audio.load();
}

// Simplified audio system - no complex caching

// Fallback to Web Speech API
function fallbackToSpeech(word, onEndCallback) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'id-ID'; // Indonesian
        utterance.rate = 0.8; // Slower for kids
        utterance.pitch = 1.2; // Higher pitch for kids
        
        // Add event listener for when speech ends
        utterance.onend = () => {
            if (onEndCallback) {
                onEndCallback();
            }
        };
        
        speechSynthesis.speak(utterance);
    }
}

// Keyboard Support
function setupKeyboardSupport() {
    document.addEventListener('keydown', (e) => {
        // Only handle keys when game is running
        if (!currentWord) return;
        
        // Handle dialog keys first (Escape for dialogs)
        const skipDialog = document.querySelector('.skip-dialog-overlay');
        const diffDialog = document.querySelector('.difficulty-dialog-overlay');
        if (skipDialog || diffDialog) {
            if (e.key === 'Escape') {
                if (skipDialog) closeSkipDialog();
                if (diffDialog) closeDifficultyDialog();
            } else if (e.key === 'Enter') {
                if (skipDialog) confirmSkip();
                if (diffDialog) {
                    const confirmBtn = diffDialog.querySelector('.difficulty-confirm-btn');
                    if (confirmBtn) {
                        const difficulty = confirmBtn.getAttribute('onclick').match(/'([^']+)'/)[1];
                        confirmDifficultyChange(difficulty);
                    }
                }
            }
            return;
        }
        
        // Manual input mode: redirect letter keys to input field
        if (answerMode === 'input' && currentWord) {
            const input = document.getElementById('manualInput');
            if (input) {
                // Allow letters (A-Z), Enter, Backspace
                const isLetterKey = /^[a-zA-Z]$/.test(e.key);
                const isEnterKey = e.key === 'Enter';
                const isBackspace = e.key === 'Backspace';
                
                if (isLetterKey || isEnterKey || isBackspace) {
                    // Ensure input is focused
                    if (document.activeElement !== input) {
                        input.focus();
                    }
                    // Handle Enter key submission
                    if (isEnterKey) {
                        e.preventDefault();
                        submitManualInput();
                    }
                    return;
                }
            }
        }
        
        // Skip question with S key (only in click mode or if not typing)
        if ((e.key === 's' || e.key === 'S') && answerMode !== 'input') {
            skipQuestion();
        }
    });
}

// Sound Effects
function playCorrectSound() {
    if (!soundEnabled) return;

    let notes, waveType, duration, volume;

    switch (currentSoundTheme) {
        case 'calm':
            // Soft, gentle ascending notes
            notes = [392, 440, 494]; // G, A, B
            waveType = 'sine';
            duration = 0.4;
            volume = 0.2;
            break;
        case 'exciting':
            // Upbeat, celebratory melody
            notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (higher)
            waveType = 'square';
            duration = 0.2;
            volume = 0.25;
            break;
        default: // 'fun'
            // Happy, playful melody
            notes = [523.25, 659.25, 783.99]; // C, E, G (C major chord)
            waveType = 'sine';
            duration = 0.3;
            volume = 0.3;
    }

    audioSystem.playNotes(notes, waveType, duration, volume);
}

function playWrongSound() {
    if (!soundEnabled) return;

    let startFreq, endFreq, waveType, duration, volume;

    switch (currentSoundTheme) {
        case 'calm':
            // Soft, gentle descending sound
            startFreq = 300;
            endFreq = 200;
            waveType = 'sine';
            duration = 0.4;
            volume = 0.15;
            break;
        case 'exciting':
            // More dramatic slide down
            startFreq = 600;
            endFreq = 100;
            waveType = 'sawtooth';
            duration = 0.2;
            volume = 0.2;
            break;
        default: // 'fun'
            // Classic boing sound
            startFreq = 400;
            endFreq = 150;
            waveType = 'triangle';
            duration = 0.3;
            volume = 0.15;
    }

    audioSystem.playSweep(startFreq, endFreq, waveType, duration, volume);
}