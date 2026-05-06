// ====== Game Engine (modular, easy to maintain) ======
const Game = (() => {
  // State
  const state = {
    score:0, wrong:0, timeLeft:60, maxTime:60, qnum:0, currentAnswer:null, streak:0, combo:1,
    difficulty:'easy', mode:'mixed', answerMode:'choice', running:false, learningMode:false, paused:false,
    highScores:{}, unlockedThemes: new Set(['lavender-fields']), achievements: new Set(), audio:null,
    // Game statistics
    correctAnswers: 0, wrongAnswers: 0, totalQuestions: 0, bestStreak: 0,
    gameStartTime: null, totalAnswerTime: 0, answersGiven: 0
  };

  // DOM refs
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // Event listener storage for cleanup
  const eventListeners = [];
  const timers = [];
  const timeouts = [];

  // Helper to add tracked event listeners
  function addTrackedListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler, options });
  }

  // Helper to add tracked timers
  function addTrackedTimer(id) {
    timers.push(id);
  }

  // Helper to add tracked timeouts
  function addTrackedTimeout(callback, delay) {
    const id = setTimeout(() => {
      callback();
      // Remove from timeouts array after executing
      const index = timeouts.indexOf(id);
      if (index > -1) timeouts.splice(index, 1);
    }, delay);
    timeouts.push(id);
    return id;
  }

  // Cleanup function
  function cleanup() {
    // Remove all event listeners
    eventListeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    eventListeners.length = 0;

    // Clear all timers
    timers.forEach(id => clearInterval(id));
    timers.length = 0;

    // Clear all timeouts
    timeouts.forEach(id => clearTimeout(id));
    timeouts.length = 0;

    // Clear main timer
    if (state._timer) {
      clearInterval(state._timer);
      state._timer = null;
    }

    // Cleanup audio system
    if (audio) audio.cleanup();
  }

  const refs = {
    question: $('#question'), answers: $('#answers'), feedback: $('#feedback'),
    score: $('#score'), wrong: $('#wrong'), time: $('#time'), qnum: $('#qnum'), combo: $('#combo'),
    startBtn: $('#startBtn'), learningToggle: $('#learningToggle'), musicToggle: $('#musicToggle'),
    pauseBtn: $('#pauseBtn'), soundToggle: $('#soundToggle'), backToMenuBtn: $('#backToMenuBtn'),
    rewardPopup: $('#rewardPopup'), questionCard: document.querySelector('.question-card'),
    // Timer progress bar
    timerProgress: $('#timerProgress'),
    // Pause screen
    pauseOverlay: $('#pauseOverlay'), resumeBtn: $('#resumeBtn'), pauseChangeSettingsBtn: $('#pauseChangeSettingsBtn'),
    // Answer input refs
    answerInputContainer: $('#answerInputContainer'), answerInput: $('#answerInput'), submitBtn: $('#submitBtn'),
    // Score screen refs
    scoreScreen: $('#scoreScreen'), scoreEmoji: $('#scoreEmoji'), scoreTitle: $('#scoreTitle'),
    scoreSubtitle: $('#scoreSubtitle'), finalScore: $('#finalScore'), highScoreBadge: $('#highScoreBadge'),
    correctAnswersEl: $('#correctAnswers'), wrongAnswersEl: $('#wrongAnswers'),
    accuracyEl: $('#accuracy'), avgSpeedEl: $('#avgSpeed'), bestStreakEl: $('#bestStreak'),
    totalQuestionsEl: $('#totalQuestions'), playAgainBtn: $('#playAgainBtn'),
    changeSettingsBtn: $('#changeSettingsBtn')
  };

  // Utils
  const rand = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];

  // Audio system - single AudioContext reused (avoids creating many contexts)
  class AudioSystem {
    constructor(){
      this.ctx = null;
      this.bgAudioElement = null;
      this.musicEnabled = true;
      this.soundEnabled = true;
      this.bgPlaying = false;
      this.currentBackgroundMusic = 'backsound1';
      this.availableBackgroundMusic = [
        { name: 'backsound1', displayName: '🎵 Musik 1' },
        { name: 'backsound2', displayName: '🎵 Musik 2' },
        { name: 'backsound3', displayName: '🎵 Musik 3' }
      ];
    }
    
    init(){ 
      if(this.ctx) return; 
      this.ctx = new (window.AudioContext||window.webkitAudioContext)(); 
      
      // Create audio element for background music
      if(!this.bgAudioElement){
        this.bgAudioElement = new Audio();
        this.bgAudioElement.loop = true;
        this.bgAudioElement.volume = 0.3;

        // Add event listener to ensure loop works
        const loopHandler = () => {
          // This will trigger when audio ends
          // With loop=true, this shouldn't happen, but ensures it loops
          this.bgAudioElement.currentTime = 0;
          this.bgAudioElement.play();
        };
        this.bgAudioElement.addEventListener('ended', loopHandler);
        // Store reference for cleanup
        this.loopHandler = loopHandler;
      }
    }

    // Cleanup audio system
    cleanup() {
      if (this.bgAudioElement && this.loopHandler) {
        this.bgAudioElement.removeEventListener('ended', this.loopHandler);
      }
      if (this.bgAudioElement) {
        this.bgAudioElement.pause();
        this.bgAudioElement.currentTime = 0;
      }
    }
    
    // Enhanced sound effects
    playSfx(type){
      if(!this.soundEnabled) return;
      try{
        this.init();
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); 
        const g = this.ctx.createGain();
        
        if(type === 'correct'){
          // Pleasant ding sound
          o.type = 'sine';
          o.frequency.setValueAtTime(800, now);
          o.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
          g.gain.setValueAtTime(0.15, now);
          g.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          o.start(now);
          o.stop(now + 0.3);
        } else if(type === 'wrong'){
          // Gentle buzz
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(200, now);
          o.frequency.exponentialRampToValueAtTime(100, now + 0.2);
          g.gain.setValueAtTime(0.1, now);
          g.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          o.start(now);
          o.stop(now + 0.2);
        } else if(type === 'streak'){
          // Celebration sound
          const frequencies = [523, 659, 784]; // C-E-G chord
          frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.08, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
            gain.connect(this.ctx.destination);
            osc.connect(gain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
          });
          return; // Skip the default connection below
        }
        
        g.connect(this.ctx.destination);
        o.connect(g);
      }catch(e){/* audio blocked */}
    }
    
    startMusic(){
      if(!this.musicEnabled) return;
      
      try{
        this.init();
        
        // Play audio file
        if(this.bgAudioElement){
          const musicPath = `../audio/backsound/${this.currentBackgroundMusic}.mp3`;
          this.bgAudioElement.src = musicPath;
          this.bgAudioElement.load();
          this.bgPlaying = true;
          this.bgAudioElement.play().then(() => {
            // Music playing successfully
          }).catch(e => {
            this.bgPlaying = false;
            // Could not play background music - silent fail
          });
        }
      }catch(e){
        this.bgPlaying = false;
        // Music not available - silent fail
      }
    }
    
    stopMusic(){
      if(this.bgAudioElement){
        this.bgAudioElement.pause();
        this.bgAudioElement.currentTime = 0;
      }
      this.bgPlaying = false;
    }
    
    changeBackgroundMusic(musicName){
      this.currentBackgroundMusic = musicName;
      
      // Save preference
      try{
        localStorage.setItem('mf_backgroundMusic', musicName);
      }catch(e){}
      
      // Reload music if currently playing
      if(this.musicEnabled){
        this.stopMusic();
        this.startMusic();
      }
      
      // Update selector
      const selector = document.getElementById('backgroundMusicSelector');
      if(selector){
        selector.value = musicName;
      }
    }
    
    toggleMusic(){
      this.musicEnabled = !this.musicEnabled;
      
      if(this.musicEnabled){
        this.startMusic();
      } else {
        this.stopMusic();
      }
      
      return this.musicEnabled;
    }
    
    loadSettings(){
      try{
        const savedMusic = localStorage.getItem('mf_backgroundMusic');
        if(savedMusic){
          this.currentBackgroundMusic = savedMusic;
        }
      }catch(e){}
    }
  }

  const audio = new AudioSystem(); state.audio = audio;

  // Persistence
  const save = ()=>{
    try{
      localStorage.setItem('mf_state', JSON.stringify({highScores:state.highScores,unlocks:[...state.unlockedThemes],ach:[...state.achievements]}));
    }catch(e){}
  }
  const load = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem('mf_state')||'{}');
      if(raw.highScores) state.highScores = raw.highScores;
      if(raw.unlocks) raw.unlocks.forEach(t=>state.unlockedThemes.add(t));
      if(raw.ach) raw.ach.forEach(a=>state.achievements.add(a));
    }catch(e){}
  }

  // UI helpers
  function updateUI(){
    refs.score.textContent = state.score;
    refs.wrong.textContent = state.wrong;
    refs.qnum.textContent = state.qnum;
    if(refs.combo) refs.combo.textContent = state.combo;
    updateTimerDisplay();
  }

  function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1)}
  
  // Helper to enable/disable answer buttons
  function setButtonsEnabled(enabled){
    $$('.answer').forEach(b => b.disabled = !enabled);
  }
  
  // Helper to get time settings based on difficulty
  function getTimeSettings(){
    const settings = {
      easy: { initial: 10, bonus: 3 },
      medium: { initial: 20, bonus: 4 },
      hard: { initial: 30, bonus: 5 }
    };
    return settings[state.difficulty] || settings.medium;
  }
  
  // Helper to reset emoji and enable buttons after delay
  function resetToNeutralState(delay = 600){
    addTrackedTimeout(() => {
      setButtonsEnabled(true);
    }, delay);
  }

  // Helper to set active option in a group
  function setActiveOption(selector, clickedElement){
    document.querySelectorAll(selector).forEach(x => {
      x.classList.remove('active');
      if(x.hasAttribute('aria-pressed')) x.setAttribute('aria-pressed', 'false');
    });
    clickedElement.classList.add('active');
    if(clickedElement.hasAttribute('aria-pressed')) clickedElement.setAttribute('aria-pressed', 'true');
  }

  // Question generation
  function genNumbers(){
    const ops = {
      mixed: ['+', '-'],
      addition: ['+'],
      subtraction: ['-']
    };
    const op = pick(ops[state.mode]);
    
    let num1, num2;
    
    if(state.difficulty === 'easy'){
      num1 = rand(0, 10);
      num2 = rand(0, 10);
    } else if(state.difficulty === 'medium'){
      // Mix of 1-digit and 2-digit numbers
      if(Math.random() > 0.5){
        num1 = rand(0, 9);
        num2 = rand(10, 99);
      } else {
        num1 = rand(10, 99);
        num2 = rand(0, 9);
      }
    } else {
      // Hard: both 2-digit
      num1 = rand(10, 99);
      num2 = rand(10, 99);
    }
    
    // Ensure no negative results for subtraction
    if(op === '-' && num1 < num2){
      [num1, num2] = [num2, num1];
    }
    
    const ans = op === '+' ? num1 + num2 : num1 - num2;
    return { num1, num2, op, ans };
  }

  function shuffle(arr){return arr.sort(()=>Math.random()-0.5)}

  // Generate answer options (4 options now)
  function generateQuestion(){
    const q = genNumbers(); state.currentAnswer = q.ans; state.qnum++;
    document.getElementById('q-top').textContent = q.num1;
    document.getElementById('q-bottom-number').textContent = q.num2;
    document.getElementById('q-op').textContent = q.op;

    // create options
    const answers = new Set([q.ans]);
    const correctLastDigit = q.ans % 10;
    
    // Helper function to get digit count
    const getDigitCount = (num) => {
      if(num === 0) return 1;
      return Math.floor(Math.log10(Math.abs(num))) + 1;
    };
    
    // Helper function to get first digit
    const getFirstDigit = (num) => {
      return Math.floor(num / Math.pow(10, getDigitCount(num) - 1));
    };
    
    // Helper function to check if number has same digit count as answer
    const correctDigitCount = getDigitCount(q.ans);
    const hasSameDigitCount = (num) => getDigitCount(num) === correctDigitCount;
    const correctFirstDigit = getFirstDigit(q.ans);
    
    const maxAttempts = 50; // Prevent infinite loops
    
    // Step 1: Generate 2 wrong answers with matching LAST digit (and same digit count)
    let sameLastDigitCount = 0;
    let attempts = 0;
    while(sameLastDigitCount < 2 && attempts < maxAttempts){
      attempts++;
      // Add/subtract multiples of 10 to keep same last digit
      const multiplier = rand(1, 10); // 1-10 means ±10, ±20, ... ±100
      const offset = multiplier * 10;
      const candidate = Math.random() > 0.5 ? q.ans + offset : q.ans - offset;
      
      // Make sure it's valid, different from correct answer, and has same digit count
      if(candidate >= 0 && candidate <= 200 && candidate !== q.ans && 
         !answers.has(candidate) && hasSameDigitCount(candidate)){
        answers.add(candidate);
        sameLastDigitCount++;
      }
    }
    
    // Step 2: Generate 1 wrong answer with matching FIRST digit (and same digit count)
    attempts = 0;
    let sameFirstDigitCount = 0;
    while(sameFirstDigitCount < 1 && attempts < maxAttempts){
      attempts++;
      // Change only the last digit(s) to keep first digit same
      const currentLastDigit = q.ans % 10;
      const newLastDigit = rand(0, 9);
      
      // For 2-digit numbers: change the ones place
      // For 3-digit numbers: change more digits
      let candidate;
      if(correctDigitCount === 1){
        // For 1-digit, we can't match first digit without being the same number
        // So generate any different 1-digit number
        candidate = rand(0, 9);
      } else if(correctDigitCount === 2){
        // For 2-digit: keep first digit, change last digit
        const tensPlace = Math.floor(q.ans / 10);
        candidate = tensPlace * 10 + newLastDigit;
      } else {
        // For 3-digit: keep first digit, change others
        const firstDigitValue = Math.floor(q.ans / 100);
        const remainingDigits = rand(0, 99);
        candidate = firstDigitValue * 100 + remainingDigits;
      }
      
      // Make sure it's valid and different
      if(candidate >= 0 && candidate <= 200 && candidate !== q.ans && 
         !answers.has(candidate) && hasSameDigitCount(candidate)){
        answers.add(candidate);
        sameFirstDigitCount++;
      }
    }
    
    // Step 3: Generate 1 remaining wrong answer (any digit pattern, but same digit count)
    attempts = 0;
    const maxOffset = state.difficulty === 'easy' ? 5 : 20;
    while(answers.size < 4 && attempts < maxAttempts){
      attempts++;
      const offset = rand(1, maxOffset);
      const candidate = Math.random() > 0.5 ? q.ans + offset : Math.max(0, q.ans - offset);
      if(candidate >= 0 && candidate <= 200 && !answers.has(candidate) && hasSameDigitCount(candidate)){
        answers.add(candidate);
      }
    }
    
    const arr = shuffle(Array.from(answers));
    
    // Show/hide UI elements based on answer mode
    if(state.answerMode === 'input'){
      // Manual input mode: hide buttons, show input
      refs.answers.style.display = 'none';
      refs.answerInputContainer.style.display = 'flex';
      refs.answerInput.value = '';
      refs.answerInput.focus();
    } else {
      // Multiple choice mode: show buttons, hide input
      refs.answers.style.display = 'grid';
      refs.answerInputContainer.style.display = 'none';

      // Reuse existing buttons - just update displayed values.
      const buttons = $$('.answer');
      buttons.forEach((btn, index) => {
        const value = arr[index];
        btn.textContent = value;
        btn.dataset.answer = value;
        btn.className = 'answer';
        btn.disabled = false;
      });
    }

    updateUI();
  }

  // Handle manual input submission
  // Validate input value
  function validateManualInput(input) {
    if (!input || typeof input !== 'string') return false;
    const trimmed = input.trim();
    if (trimmed === '') return false;
    
    // Only allow numbers and optional negative sign
    if (!/^-?\d+$/.test(trimmed)) return false;
    
    // Check if number is within reasonable range
    const num = parseInt(trimmed, 10);
    if (isNaN(num)) return false;
    if (num < -9999 || num > 9999) return false;
    
    return true;
  }

  function handleManualInputSubmit(){
    if(!state.running && !state.learningMode) return;
    
    const inputValue = refs.answerInput.value;
    
    // Validate input before processing
    if (!validateManualInput(inputValue)) {
      refs.answerInput.classList.add('error');
      addTrackedTimeout(() => refs.answerInput.classList.remove('error'), 500);
      return;
    }
    
    const userAnswer = parseInt(inputValue.trim(), 10);
    
    // Disable input while processing
    refs.answerInput.disabled = true;
    refs.submitBtn.disabled = true;
    
    if(userAnswer === state.currentAnswer){
      handleCorrectAnswer(null, true); // Pass null for btn, true for isManualInput
    } else {
      handleWrongAnswer(null, true); // Pass null for btn, true for isManualInput
    }
    updateUI();
  }

  // Handle answer
  function handleAnswer(ans, btn){
    if(!state.running && !state.learningMode) return;
    
    setButtonsEnabled(false);
    
    if(ans === state.currentAnswer){
      handleCorrectAnswer(btn);
    }else{
      handleWrongAnswer(btn);
    }
    updateUI();
  }
  
  // Handle correct answer logic
  function handleCorrectAnswer(btn, isManualInput = false){
    if(btn) btn.classList.add('correct');
    showFeedback(true);
    audio.playSfx('correct');
    // Play streak sound on milestones (every 5 correct)
    if(state.streak > 0 && (state.streak + 1) % 5 === 0){
      addTrackedTimeout(() => audio.playSfx('streak'), 200);
    }
    
    // Show excited emoji on streak milestones
    state.score += 1 * state.combo;
    state.streak++; 
    if(state.streak % 3 === 0) state.combo = Math.min(5, state.combo + 1);
    
    // Track statistics
    state.correctAnswers++;
    state.totalQuestions++;
    if(state.streak > state.bestStreak) state.bestStreak = state.streak;
    
    // Add bonus time for correct answer
    if(!state.learningMode){
      const bonus = getTimeSettings().bonus;
      state.timeLeft += bonus;
      state.maxTime += bonus; // Update max time so progress bar adjusts
    }
    
    maybeAwardStreak();
    
    // Visual effects
    spawnConfetti();
    if(btn){
      const rect = btn.getBoundingClientRect();
      spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
    } else {
      // For manual input, spawn particles near the input field
      const inputRect = refs.answerInput.getBoundingClientRect();
      spawnParticles(inputRect.left + inputRect.width / 2, inputRect.top + inputRect.height / 2);
    }

    addTrackedTimeout(() => {
      generateQuestion();
      setButtonsEnabled(true);
      // Re-enable input for manual mode
      if(isManualInput){
        refs.answerInput.disabled = false;
        refs.submitBtn.disabled = false;
      }
    }, 600);
  }

  // Handle wrong answer logic
  function handleWrongAnswer(btn, isManualInput = false){
    if(btn) btn.classList.add('wrong');
    audio.playSfx('wrong');
    state.wrong++; 
    state.streak = 0; 
    state.combo = 1;
    
    // Track statistics
    state.wrongAnswers++;
    state.totalQuestions++;
    
    showFeedback(false);

    if(state.learningMode){
      addTrackedTimeout(() => {
        if(btn) btn.classList.remove('wrong');
        setButtonsEnabled(true);
        // Re-enable input for manual mode
        if(isManualInput){
          refs.answerInput.disabled = false;
          refs.submitBtn.disabled = false;
        }
        refs.feedback.textContent = 'Try again — you got this!';
      }, 700);
    } else {
      addTrackedTimeout(() => {
        if(state.wrong >= 5){
          endGame('wrong');
        } else {
          if(btn) btn.classList.remove('wrong');
          setButtonsEnabled(true);
          // Re-enable input for manual mode
          if(isManualInput){
            refs.answerInput.disabled = false;
            refs.submitBtn.disabled = false;
          }
        }
      }, 800);
    }
  }

  function showFeedback(correct){
    refs.feedback.className = 'feedback ' + (correct ? 'good' : 'bad');
    const messages = correct 
      ? ['🎉 Correct!', '🌟 Nice!', '💡 Great!']
      : ['❌ Oops!', '🙈 Try again!', '😅 Not quite'];
    refs.feedback.textContent = pick(messages);
  }

  // End game
  function endGame(reason = 'time'){
    state.running = false;
    state.paused = false;
    clearInterval(state._timer);
    
    // Hide pause overlay and button
    refs.pauseOverlay.classList.remove('show');
    refs.pauseBtn.style.display = 'none';
    refs.startBtn.style.display = 'inline-block';
    
    // Hide question card
    if(refs.questionCard) refs.questionCard.classList.remove('show');
    
    // Persist high score by mode/difficulty
    const key = `${state.difficulty}_${state.mode}`;
    const prev = state.highScores[key] || 0;
    const isNewHighScore = state.score > prev;
    if(isNewHighScore){
      state.highScores[key] = state.score;
    }
    
    save();
    updateUI();

    // Show score screen with statistics (unless user quit from pause)
    if(reason === 'paused'){
      // User quit from pause - just reset without showing score
      resetGame();
    } else {
      showScoreScreen(reason, isNewHighScore);
    }
  }
  
  // Show score screen with breakdown
  function showScoreScreen(reason, isNewHighScore){
    // Calculate statistics
    const accuracy = state.totalQuestions > 0 
      ? Math.round((state.correctAnswers / state.totalQuestions) * 100) 
      : 0;
    
    const gameTime = state.gameStartTime 
      ? Math.round((Date.now() - state.gameStartTime) / 1000)
      : 0;
    
    const avgSpeed = state.correctAnswers > 0
      ? (gameTime / state.correctAnswers).toFixed(1)
      : 0;
    
    // Set header based on reason and performance
    if(reason === 'time'){
      refs.scoreEmoji.textContent = state.score >= 10 ? '🎉' : '⏱️';
      refs.scoreTitle.textContent = state.score >= 10 ? 'Great Job!' : 'Time\'s Up!';
      refs.scoreSubtitle.textContent = 'You ran out of time';
    } else {
      refs.scoreEmoji.textContent = '💔';
      refs.scoreTitle.textContent = 'Keep Practicing!';
      refs.scoreSubtitle.textContent = 'Too many wrong answers';
    }
    
    // Set final score
    refs.finalScore.textContent = state.score;
    
    // Show/hide high score badge
    if(isNewHighScore && state.score > 0){
      refs.highScoreBadge.style.display = 'inline-block';
    } else {
      refs.highScoreBadge.style.display = 'none';
    }
    
    // Set breakdown values
    refs.correctAnswersEl.textContent = state.correctAnswers;
    refs.wrongAnswersEl.textContent = state.wrongAnswers;
    refs.accuracyEl.textContent = accuracy + '%';
    refs.avgSpeedEl.textContent = avgSpeed + 's';
    refs.bestStreakEl.textContent = state.bestStreak;
    refs.totalQuestionsEl.textContent = state.totalQuestions;
    
    // Show score screen
    refs.scoreScreen.classList.add('show');
  }

  // Hide score screen
  function hideScoreScreen(){
    refs.scoreScreen.classList.remove('show');
    // Stop music when going back to settings (but keep musicEnabled state)
    if(audio.bgPlaying){
      audio.stopMusic();
    }
    // Reset game state completely
    resetGame();
  }

  function startGame(){
    // Hide score screen if showing
    hideScoreScreen();
    
    // Pickup settings from UI
    const diff = document.querySelector('.option[data-difficulty].active');
    const modeEl = document.querySelector('.option[data-mode].active');
    const answerModeEl = document.querySelector('.option[data-answer-mode].active');
    state.difficulty = diff ? diff.dataset.difficulty : state.difficulty;
    state.mode = modeEl ? modeEl.dataset.mode : state.mode;
    state.answerMode = answerModeEl ? answerModeEl.dataset.answerMode : state.answerMode;
    
    // Reset game state
    const initialTime = state.learningMode ? 9999 : getTimeSettings().initial;
    Object.assign(state, {
      running: true,
      paused: false,
      timeLeft: initialTime,
      maxTime: initialTime,
      wrong: 0,
      score: 0,
      qnum: 0,
      streak: 0,
      combo: 1,
      // Reset statistics
      correctAnswers: 0,
      wrongAnswers: 0,
      totalQuestions: 0,
      bestStreak: 0,
      gameStartTime: Date.now()
    });
    // Show pause button, hide start button
    refs.pauseBtn.style.display = 'inline-block';
    refs.startBtn.style.display = 'none';
    refs.pauseBtn.textContent = '⏸ Pause';
    refs.pauseBtn.title = 'Pause game';
    
    // Show question card
    if(refs.questionCard) refs.questionCard.classList.add('show');
    
    updateUI();
    generateQuestion();

    // Start timer
    startTimer();

    // Start background music if enabled
    if(audio.musicEnabled && !audio.bgPlaying){
      audio.startMusic();
      refs.musicToggle.setAttribute('aria-pressed', 'true');
      refs.musicToggle.textContent = '🎵 Music: On';
    }
  }
  
  function startTimer(){
    clearInterval(state._timer);
    state._timer = setInterval(() => {
      if(!state.running || state.paused) return;
      if(!state.learningMode){
        state.timeLeft--;
        if(state.timeLeft <= 0){
          clearInterval(state._timer);
          state._timer = null;
          endGame('time');
        }
      }
      updateTimerDisplay();
    }, 1000);
  }
  
  function updateTimerDisplay(){
    refs.time.textContent = state.timeLeft;
    // Update progress bar
    if(refs.timerProgress && state.maxTime > 0){
      const percent = (state.timeLeft / state.maxTime) * 100;
      refs.timerProgress.style.width = `${Math.max(0, percent)}%`;
      // Add warning class when time is low (< 20%)
      if(percent < 20){
        refs.timerProgress.classList.add('warning');
      } else {
        refs.timerProgress.classList.remove('warning');
      }
    }
  }

  function pauseGame(){ 
    if(!state.running || state.paused) return;
    state.paused = true;
    setButtonsEnabled(false); // Disable answer buttons
    refs.pauseOverlay.classList.add('show');
    refs.pauseBtn.textContent = '▶️ Resume';
    refs.pauseBtn.title = 'Resume game';
  }
  
  function resumeGame(){
    if(!state.running || !state.paused) return;
    state.paused = false;
    setButtonsEnabled(true); // Re-enable answer buttons
    refs.pauseOverlay.classList.remove('show');
    refs.pauseBtn.textContent = '⏸ Pause';
    refs.pauseBtn.title = 'Pause game';
  }

  function resetGame(){ 
    clearInterval(state._timer);
    
    Object.assign(state, {
      running: false,
      paused: false,
      score: 0,
      wrong: 0,
      timeLeft: 60,
      maxTime: 60,
      qnum: 0,
      streak: 0,
      combo: 1,
      // Reset statistics
      correctAnswers: 0,
      wrongAnswers: 0,
      totalQuestions: 0,
      bestStreak: 0,
      gameStartTime: null,
      totalAnswerTime: 0,
      answersGiven: 0
    });
    
    // Reset UI buttons
    refs.pauseOverlay.classList.remove('show');
    refs.pauseBtn.style.display = 'none';
    refs.startBtn.style.display = 'inline-block';
    
    // Hide question card
    if(refs.questionCard) refs.questionCard.classList.remove('show');
    
    // Reset answer buttons (don't remove them, just reset their state)
    $$('.answer').forEach(btn => {
      btn.textContent = '0';
      btn.className = 'answer';
      btn.disabled = false;
    });
    
    // Hide manual input if visible
    if(refs.answerInputContainer){
      refs.answerInputContainer.style.display = 'none';
      if(refs.answerInput) refs.answerInput.value = '';
    }
    
    updateUI();
    refs.feedback.textContent = '';
  }

  function showReward(text){
    refs.rewardPopup.style.display = 'block';
    refs.rewardPopup.textContent = text;
    refs.rewardPopup.classList.add('pop');
    addTrackedTimeout(() => {
      refs.rewardPopup.style.display = 'none';
      refs.rewardPopup.classList.remove('pop');
    }, 1500);
  }

  // Streak rewards
  function maybeAwardStreak(){
    if(state.streak === 3){
      showReward('🔥 Combo x3! +1 point');
      state.score += 1;
    }
    if(state.streak === 5){
      showReward('🏆 Streak 5! Bonus +2');
      state.score += 2;
    }
    updateUI();
    save();
  }

  // confetti
  function spawnConfetti(){
    const colors = ['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#f9ca24','#6c5ce7'];
    for(let i=0;i<20;i++){
      const el = document.createElement('div'); el.className='confetti-piece';
      el.style.left = (window.innerWidth* Math.random())+'px'; el.style.top = '-20px';
      el.style.background = pick(colors); el.style.transform = `rotate(${rand(0,360)}deg)`;
      document.body.appendChild(el);
      const fall = rand(1800,3200);
      el.animate([{transform:'translateY(0)'},{transform:`translateY(${window.innerHeight + 50}px)`}],{duration:fall, easing:'cubic-bezier(.2,.8,.2,1)'});
      addTrackedTimeout(()=>el.remove(),fall+50);
    }
  }

  // Particle effects (stars, sparkles)
  function spawnParticles(x, y){
    const particles = ['⭐', '✨', '💫', '🌟', '⚡'];
    // Spawn star particles
    for(let i=0;i<8;i++){
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.textContent = pick(particles);
      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      const angle = (i / 8) * Math.PI * 2;
      const distance = rand(30, 80);
      const endX = x + Math.cos(angle) * distance;
      const endY = y + Math.sin(angle) * distance - 60;
      document.body.appendChild(particle);
      particle.animate([
        {transform: 'translate(0, 0) scale(0.5) rotate(0deg)', opacity: 1},
        {transform: `translate(${endX - x}px, ${endY - y}px) scale(1.2) rotate(${rand(-180, 180)}deg)`, opacity: 0}
      ], {duration: rand(800, 1200), easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'});
      addTrackedTimeout(() => particle.remove(), 1200);
    }

    // Spawn sparkles
    for(let i=0;i<12;i++){
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.left = (x + rand(-40, 40)) + 'px';
      sparkle.style.top = (y + rand(-40, 40)) + 'px';
      document.body.appendChild(sparkle);
      addTrackedTimeout(() => sparkle.remove(), 1000);
    }
  }

  // Event wiring for UI controls
  function setupUI(){
    // Difficulty options
    document.querySelectorAll('.option[data-difficulty]').forEach(o => {
      addTrackedListener(o, 'click', () => setActiveOption('.option[data-difficulty]', o));
    });

    // Mode options
    document.querySelectorAll('.option[data-mode]').forEach(o => {
      addTrackedListener(o, 'click', () => setActiveOption('.option[data-mode]', o));
    });

    // Answer mode options
    document.querySelectorAll('.option[data-answer-mode]').forEach(o => {
      addTrackedListener(o, 'click', () => setActiveOption('.option[data-answer-mode]', o));
    });

    // Answer buttons
    document.querySelectorAll('.answer').forEach(btn => {
      addTrackedListener(btn, 'click', () => {
        const value = Number(btn.dataset.answer);
        handleAnswer(value, btn);
      });
    });

    // Start button
    addTrackedListener(refs.startBtn, 'click', startGame);

    // Back to menu button
    addTrackedListener(refs.backToMenuBtn, 'click', () => {
      window.location.href = '../index.html';
    });

    // Pause/Resume button
    addTrackedListener(refs.pauseBtn, 'click', () => {
      if(state.paused){
        resumeGame();
      } else {
        pauseGame();
      }
    });

    // Resume button in pause overlay
    addTrackedListener(refs.resumeBtn, 'click', resumeGame);

    // Change Settings button in pause overlay
    addTrackedListener(refs.pauseChangeSettingsBtn, 'click', () => {
      // End the current game and return to settings
      endGame('paused');
    });

    // Sound toggle
    addTrackedListener(refs.soundToggle, 'click', () => {
      audio.soundEnabled = !audio.soundEnabled;
      refs.soundToggle.setAttribute('aria-pressed', audio.soundEnabled);
      refs.soundToggle.textContent = audio.soundEnabled ? '🔊 Sound' : '🔇 Sound';
    });

    // Music toggle
    addTrackedListener(refs.musicToggle, 'click', () => {
      const isEnabled = audio.toggleMusic();
      refs.musicToggle.setAttribute('aria-pressed', isEnabled);
      refs.musicToggle.textContent = isEnabled ? '🎵 Music: On' : '🎵 Music: Off';
    });

    // Learning mode toggle
    addTrackedListener(refs.learningToggle, 'click', () => {
      state.learningMode = !state.learningMode;
      refs.learningToggle.setAttribute('aria-pressed', state.learningMode);
      refs.learningToggle.textContent = state.learningMode ? '📖 Learning: On' : '📖 Learning Mode';
    });

    // Manual input submit button
    if(refs.submitBtn){
      addTrackedListener(refs.submitBtn, 'click', handleManualInputSubmit);
    }

    // Manual input Enter key support
    if(refs.answerInput){
      addTrackedListener(refs.answerInput, 'keydown', (e) => {
        if(e.key === 'Enter' && state.running){
          handleManualInputSubmit();
        }
      });
    }

    // Keyboard support
    addTrackedListener(document, 'keydown', (e) => {
      // Pause with P key
      if(e.key.toLowerCase() === 'p' && state.running){
        if(state.paused){
          resumeGame();
        } else {
          pauseGame();
        }
        return;
      }
      // Toggle sound with S key
      if(e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey){
        refs.soundToggle.click();
        return;
      }
      // Manual input mode: redirect alphanumeric keys to input field
      if(state.answerMode === 'input' && state.running && !state.paused){
        // Allow Enter for submit, Backspace for delete, and numbers/minus for input
        const isNumberKey = /^[0-9]$/.test(e.key);
        const isMinusKey = e.key === '-';
        const isEnterKey = e.key === 'Enter';
        const isBackspace = e.key === 'Backspace';
        
        if(isNumberKey || isMinusKey || isEnterKey || isBackspace){
          // Ensure input is focused
          if(document.activeElement !== refs.answerInput){
            refs.answerInput.focus();
          }
          // Let the default behavior handle the input
          return;
        }
      }
      // Only handle number keys in multiple choice mode during gameplay
      if(state.answerMode === 'choice' && state.running && !state.paused && ['1', '2', '3', '4'].includes(e.key)){
        const idx = parseInt(e.key) - 1;
        const btn = document.querySelectorAll('.answer')[idx];
        if(btn) btn.click();
      }
    });

    // Score screen buttons
    addTrackedListener(refs.playAgainBtn, 'click', startGame);
    addTrackedListener(refs.changeSettingsBtn, 'click', hideScoreScreen);
  }

  // Initialize game
  function init(){
    load();
    setupUI();
    updateUI();
  }

  return { init, startGame, resetGame, cleanup, state };
})();

// Start
document.addEventListener('DOMContentLoaded', () => {
  Game.init();

  // Load background music settings
  if(Game.state && Game.state.audio){
    Game.state.audio.loadSettings();
  }

  // Make changeBackgroundMusic globally accessible
  window.changeBackgroundMusic = (musicName) => {
    if(Game.state && Game.state.audio){
      Game.state.audio.changeBackgroundMusic(musicName);
    }
  };

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    Game.cleanup();
  });

  // Cleanup on page hide (for mobile browsers)
  window.addEventListener('pagehide', () => {
    Game.cleanup();
  });

  // Cleanup on visibility change (for better performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.state.running) {
      // Optionally pause game when tab is hidden
      // pauseGame();
    }
  });
});
