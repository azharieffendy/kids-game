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

  const refs = {
    question: $('#question'), answers: $('#answers'), feedback: $('#feedback'),
    score: $('#score'), wrong: $('#wrong'), time: $('#time'), qnum: $('#qnum'),
    startBtn: $('#startBtn'), learningToggle: $('#learningToggle'), musicToggle: $('#musicToggle'),
    pauseBtn: $('#pauseBtn'), soundToggle: $('#soundToggle'), backToMenuBtn: $('#backToMenuBtn'),
    mascot: $('#mascotSvg'), rewardPopup: $('#rewardPopup'), questionCard: document.querySelector('.question-card'),
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
        this.bgAudioElement.addEventListener('ended', () => {
          // This will trigger when audio ends
          // With loop=true, this shouldn't happen, but ensures it loops
          this.bgAudioElement.currentTime = 0;
          this.bgAudioElement.play();
        });
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
          this.bgAudioElement.play().then(() => {
            // Music playing successfully
          }).catch(e => {
            // Could not play background music - silent fail
          });
        }
      }catch(e){
        // Music not available - silent fail
      }
    }
    
    stopMusic(){
      if(this.bgAudioElement){
        this.bgAudioElement.pause();
        this.bgAudioElement.currentTime = 0;
      }
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
  
  // Helper to reset mascot and enable buttons after delay
  function resetToNeutralState(delay = 600){
    setTimeout(() => {
      setMascotMood('neutral');
      setButtonsEnabled(true);
    }, delay);
  }
  
  // Helper to set active option in a group
  function setActiveOption(selector, clickedElement){
    document.querySelectorAll(selector).forEach(x => x.classList.remove('active'));
    clickedElement.classList.add('active');
  }

  // Create mascot based on theme
  function createMascotForTheme(theme){
    const face = document.querySelector('#face');
    if(!face) return;
    
    // Clear existing content
    face.innerHTML = '';
    
    // Get current theme if not provided
    if(!theme) theme = document.body.getAttribute('data-theme') || 'space';
    
    // Update mascot description (same length for consistency)
    const descriptions = {
      'lavender-fields': 'Mascot reacts to answers!',
      'hydrangea': 'Mascot reacts to answers!',
      'lush-forest': 'Mascot reacts to answers!',
      'stormy-morning': 'Mascot reacts to answers!'
    };
    const descEl = document.querySelector('.mascot-description');
    if(descEl) descEl.textContent = descriptions[theme] || 'Mascot reacts to your answers!';
    
    let mascotHTML = '';
    
    if(theme === 'lavender-fields'){
      // Butterfly
      mascotHTML = `
        <!-- Left wing -->
        <ellipse cx="30" cy="35" rx="18" ry="24" fill="#c39bd3" stroke="#8e44ad" stroke-width="2" />
        <ellipse cx="28" cy="32" rx="10" ry="14" fill="#e8daef" opacity="0.8" />
        <circle cx="26" cy="28" r="3" fill="#9b59b6" />
        <!-- Right wing -->
        <ellipse cx="70" cy="35" rx="18" ry="24" fill="#c39bd3" stroke="#8e44ad" stroke-width="2" />
        <ellipse cx="72" cy="32" rx="10" ry="14" fill="#e8daef" opacity="0.8" />
        <circle cx="74" cy="28" r="3" fill="#9b59b6" />
        <!-- Body -->
        <ellipse cx="50" cy="40" rx="8" ry="28" fill="#7d3c98" />
        <!-- Head -->
        <circle cx="50" cy="20" r="10" fill="#8e44ad" />
        <!-- Antennae -->
        <path d="M 46,12 Q 42,8 40,6" stroke="#8e44ad" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M 54,12 Q 58,8 60,6" stroke="#8e44ad" stroke-width="2" fill="none" stroke-linecap="round" />
        <circle cx="40" cy="6" r="3" fill="#c39bd3" />
        <circle cx="60" cy="6" r="3" fill="#c39bd3" />
        <g id="eyes"></g>
        <g id="mouth"></g>
      `;
    } else if(theme === 'hydrangea'){
      // Flower
      mascotHTML = `
        <!-- Stem (shortened) -->
        <rect x="47" y="48" width="6" height="18" fill="#27ae60" rx="3" />
        <!-- Leaves (adjusted) -->
        <ellipse cx="38" cy="56" rx="8" ry="5" fill="#2ecc71" transform="rotate(-30 38 56)" />
        <ellipse cx="62" cy="56" rx="8" ry="5" fill="#2ecc71" transform="rotate(30 62 56)" />
        <!-- Petals (5 petals in circle) -->
        <ellipse cx="50" cy="22" rx="11" ry="14" fill="#f0b4e4" stroke="#b565d8" stroke-width="2" />
        <ellipse cx="64" cy="31" rx="11" ry="14" fill="#e89dd8" stroke="#b565d8" stroke-width="2" transform="rotate(72 64 31)" />
        <ellipse cx="59" cy="48" rx="11" ry="14" fill="#d885c8" stroke="#b565d8" stroke-width="2" transform="rotate(144 59 48)" />
        <ellipse cx="41" cy="48" rx="11" ry="14" fill="#d885c8" stroke="#b565d8" stroke-width="2" transform="rotate(216 41 48)" />
        <ellipse cx="36" cy="31" rx="11" ry="14" fill="#e89dd8" stroke="#b565d8" stroke-width="2" transform="rotate(288 36 31)" />
        <!-- Center circle (face) -->
        <circle cx="50" cy="36" r="13" fill="#7e5bb5" stroke="#5e3b8f" stroke-width="2" />
        <g id="eyes"></g>
        <g id="mouth"></g>
      `;
    } else if(theme === 'lush-forest'){
      // Deer
      mascotHTML = `
        <!-- Antlers (adjusted) -->
        <path d="M 36,20 L 32,14 L 30,18 M 32,14 L 29,11" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d="M 64,20 L 68,14 L 70,18 M 68,14 L 71,11" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round" />
        <!-- Head -->
        <ellipse cx="50" cy="40" rx="26" ry="28" fill="#a16207" stroke="#78350f" stroke-width="3" />
        <!-- Snout -->
        <ellipse cx="50" cy="52" rx="15" ry="12" fill="#d4a574" />
        <!-- Nose -->
        <ellipse cx="50" cy="58" rx="5" ry="4" fill="#4a3020" />
        <!-- Ears -->
        <ellipse cx="32" cy="28" rx="7" ry="12" fill="#a16207" stroke="#78350f" stroke-width="2" transform="rotate(-20 32 28)" />
        <ellipse cx="68" cy="28" rx="7" ry="12" fill="#a16207" stroke="#78350f" stroke-width="2" transform="rotate(20 68 28)" />
        <ellipse cx="32" cy="29" rx="3.5" ry="7" fill="#d4a574" transform="rotate(-20 32 29)" />
        <ellipse cx="68" cy="29" rx="3.5" ry="7" fill="#d4a574" transform="rotate(20 68 29)" />
        <!-- Spots -->
        <circle cx="40" cy="34" r="2.5" fill="#f0f0f0" opacity="0.8" />
        <circle cx="60" cy="34" r="2.5" fill="#f0f0f0" opacity="0.8" />
        <circle cx="50" cy="38" r="2" fill="#f0f0f0" opacity="0.8" />
        <g id="eyes"></g>
        <g id="mouth"></g>
      `;
    } else if(theme === 'stormy-morning'){
      // Cloud
      mascotHTML = `
        <!-- Cloud body (multiple circles) -->
        <circle cx="35" cy="38" r="15" fill="#aeb6bf" stroke="#5d6d7e" stroke-width="2" />
        <circle cx="50" cy="33" r="17" fill="#d5dbdb" stroke="#5d6d7e" stroke-width="2" />
        <circle cx="65" cy="38" r="15" fill="#aeb6bf" stroke="#5d6d7e" stroke-width="2" />
        <circle cx="50" cy="45" r="13" fill="#85929e" stroke="#5d6d7e" stroke-width="2" />
        <!-- Rain drops (shortened) -->
        <ellipse cx="38" cy="58" rx="2.5" ry="5" fill="#5d6d7e" opacity="0.6" />
        <ellipse cx="50" cy="62" rx="2.5" ry="5" fill="#5d6d7e" opacity="0.6" />
        <ellipse cx="62" cy="58" rx="2.5" ry="5" fill="#5d6d7e" opacity="0.6" />
        <!-- Lightning (optional accent) -->
        <path d="M 54,50 L 52,54 L 53,54 L 51,58" stroke="#f39c12" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.8" />
        <g id="eyes"></g>
        <g id="mouth"></g>
      `;
    } else {
      // Default (current smiley)
      mascotHTML = `
        <circle cx="50" cy="34" r="30" fill="#ffd166" stroke="#f59e0b" stroke-width="2" />
        <g id="eyes"></g>
        <g id="mouth"></g>
      `;
    }
    
    face.innerHTML = mascotHTML;
  }
  
  // Mascot reactions (change SVG mouth/eyes)
  function setMascotMood(mood='neutral'){
    try{
      const mascot = document.querySelector('.mascot');
      const face = document.querySelector('#face');
      const eyes = document.querySelector('#eyes');
      const mouth = document.querySelector('#mouth');
      if(!face || !eyes || !mouth) return;
      
      // Get current theme for position adjustments
      const theme = document.body.getAttribute('data-theme') || 'space';
      
      // Position adjustments per theme
      let eyeY = 32, mouthY = 44, mouthYSad = 52;
      if(theme === 'lavender-fields') { eyeY = 18; mouthY = 24; mouthYSad = 28; } // Butterfly (head)
      else if(theme === 'hydrangea') { eyeY = 34; mouthY = 40; mouthYSad = 44; } // Flower (center)
      else if(theme === 'lush-forest') { eyeY = 36; mouthY = 48; mouthYSad = 52; } // Deer (snout area)
      else if(theme === 'stormy-morning') { eyeY = 34; mouthY = 42; mouthYSad = 46; } // Cloud
      else { eyeY = 32; mouthY = 44; mouthYSad = 52; } // default
      
      // Remove all mood classes
      mascot.classList.remove('mood-happy', 'mood-sad', 'mood-excited');
      
      // clear
      eyes.innerHTML=''; mouth.innerHTML='';
      
      if(mood==='happy'){
        mascot.classList.add('mood-happy');
        eyes.innerHTML = `<circle cx="36" cy="${eyeY}" r="5" fill="#111" /><circle cx="64" cy="${eyeY}" r="5" fill="#111" />`;
        mouth.innerHTML = `<path d="M36,${mouthY} Q50,${mouthY+16} 64,${mouthY}" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round" />`;
      }else if(mood==='sad'){
        mascot.classList.add('mood-sad');
        eyes.innerHTML = `<path d="M33,${eyeY-3} q6,8 12,0" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" /> <path d="M61,${eyeY-3} q6,8 12,0" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" />`;
        mouth.innerHTML = `<path d="M36,${mouthYSad} Q50,${mouthYSad-10} 64,${mouthYSad}" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round" />`;
      }else if(mood==='surprised'){
        eyes.innerHTML = `<circle cx="36" cy="${eyeY}" r="6" fill="#111" /><circle cx="64" cy="${eyeY}" r="6" fill="#111" />`;
        mouth.innerHTML = `<circle cx="50" cy="${mouthY+2}" r="8" fill="#111" />`;
      }else if(mood==='excited'){
        mascot.classList.add('mood-excited');
        eyes.innerHTML = `<circle cx="36" cy="${eyeY}" r="5" fill="#111" /><circle cx="64" cy="${eyeY}" r="5" fill="#111" /><circle cx="33" cy="${eyeY-2}" r="2" fill="#fff" /><circle cx="61" cy="${eyeY-2}" r="2" fill="#fff" />`;
        mouth.innerHTML = `<path d="M36,${mouthY-2} Q50,${mouthY+18} 64,${mouthY-2}" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round" />`;
      }else if(mood==='thinking'){
        eyes.innerHTML = `<circle cx="36" cy="${eyeY}" r="4" fill="#111" /><circle cx="64" cy="${eyeY}" r="4" fill="#111" />`;
        mouth.innerHTML = `<path d="M36,${mouthY+4} Q44,${mouthY+8} 52,${mouthY+4}" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round" />`;
      }else{
        // neutral
        eyes.innerHTML = `<circle cx="36" cy="${eyeY}" r="4" fill="#111" /><circle cx="64" cy="${eyeY}" r="4" fill="#111" />`;
        mouth.innerHTML = `<path d="M36,${mouthY+2} Q50,${mouthY+8} 64,${mouthY+2}" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round" />`;
      }
    }catch(e){}
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

  // Store button handlers
  const buttonHandlers = new Map();

  // Generate answer options (4 options now)
  function generateQuestion(){
    const q = genNumbers(); state.currentAnswer = q.ans; state.qnum++;
    document.getElementById('q-top').textContent = q.num1;
    document.getElementById('q-bottom-number').textContent = q.num2;
    document.getElementById('q-op').textContent = q.op;
    
    // Show thinking mood when new question appears
    if(state.qnum > 1) setMascotMood('thinking');

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
      
      // Reuse existing buttons - just update text and handler
      const buttons = $$('.answer');
      buttons.forEach((btn, index) => {
        const value = arr[index];
        
        // Remove old listener if exists
        if(buttonHandlers.has(btn)) {
          btn.removeEventListener('click', buttonHandlers.get(btn));
        }
        
        // Update button
        btn.textContent = value;
        btn.className = 'answer';
        btn.disabled = false;
        
        // Add new listener
        const handler = ()=> handleAnswer(value, btn);
        buttonHandlers.set(btn, handler);
        btn.addEventListener('click', handler);
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
      setTimeout(() => refs.answerInput.classList.remove('error'), 500);
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
      setTimeout(() => audio.playSfx('streak'), 200);
    }
    
    // Show excited mood on streak milestones
    const mood = (state.streak > 0 && state.streak % 3 === 2) ? 'excited' : 'happy';
    setMascotMood(mood);
    
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
    
    setTimeout(() => {
      setMascotMood('neutral');
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
    setMascotMood('sad');
    audio.playSfx('wrong');
    state.wrong++; 
    state.streak = 0; 
    state.combo = 1;
    
    // Track statistics
    state.wrongAnswers++;
    state.totalQuestions++;
    
    showFeedback(false);
    
    if(state.learningMode){
      setTimeout(() => {
        if(btn) btn.classList.remove('wrong');
        setMascotMood('neutral');
        setButtonsEnabled(true);
        // Re-enable input for manual mode
        if(isManualInput){
          refs.answerInput.disabled = false;
          refs.submitBtn.disabled = false;
        }
        refs.feedback.textContent = 'Try again — you got this!';
      }, 700);
    } else {
      setTimeout(() => {
        if(state.wrong >= 5){
          endGame('wrong');
        } else {
          if(btn) btn.classList.remove('wrong');
          setMascotMood('neutral');
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
      setMascotMood('neutral');
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
    
    // Mascot mood based on performance
    if(accuracy >= 80){
      setMascotMood('excited');
    } else if(accuracy >= 50){
      setMascotMood('happy');
    } else {
      setMascotMood('thinking');
    }
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
    // Reset mascot to neutral
    setMascotMood('neutral');
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
    setTimeout(() => {
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
      setTimeout(()=>el.remove(),fall+50);
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
      setTimeout(() => particle.remove(), 1200);
    }
    
    // Spawn sparkles
    for(let i=0;i<12;i++){
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.left = (x + rand(-40, 40)) + 'px';
      sparkle.style.top = (y + rand(-40, 40)) + 'px';
      document.body.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 1000);
    }
  }

  // Event wiring for UI controls
  function setupUI(){
    // Difficulty options
    document.querySelectorAll('.option[data-difficulty]').forEach(o => {
      o.addEventListener('click', () => setActiveOption('.option[data-difficulty]', o));
    });
    
    // Mode options
    document.querySelectorAll('.option[data-mode]').forEach(o => {
      o.addEventListener('click', () => setActiveOption('.option[data-mode]', o));
    });

    // Answer mode options
    document.querySelectorAll('.option[data-answer-mode]').forEach(o => {
      o.addEventListener('click', () => setActiveOption('.option[data-answer-mode]', o));
    });

    // Theme picker
    document.querySelectorAll('.theme').forEach(t => {
      t.addEventListener('click', () => {
        const themeName = t.dataset.theme;
        document.body.setAttribute('data-theme', themeName);
        setActiveOption('.theme', t);
        // Change mascot based on theme
        createMascotForTheme(themeName);
        setMascotMood('neutral');
      });
    });

    // Start button
    refs.startBtn.addEventListener('click', startGame);

    // Back to menu button
    refs.backToMenuBtn.addEventListener('click', () => {
      window.location.href = '../index.html';
    });

    // Pause/Resume button
    refs.pauseBtn.addEventListener('click', () => {
      if(state.paused){
        resumeGame();
      } else {
        pauseGame();
      }
    });

    // Resume button in pause overlay
    refs.resumeBtn.addEventListener('click', resumeGame);

    // Change Settings button in pause overlay
    refs.pauseChangeSettingsBtn.addEventListener('click', () => {
      // End the current game and return to settings
      endGame('paused');
    });

    // Sound toggle
    refs.soundToggle.addEventListener('click', () => {
      audio.soundEnabled = !audio.soundEnabled;
      refs.soundToggle.setAttribute('aria-pressed', audio.soundEnabled);
      refs.soundToggle.textContent = audio.soundEnabled ? '🔊 Sound' : '🔇 Sound';
    });

    // Music toggle
    refs.musicToggle.addEventListener('click', () => {
      const isEnabled = audio.toggleMusic();
      refs.musicToggle.setAttribute('aria-pressed', isEnabled);
      refs.musicToggle.textContent = isEnabled ? '🎵 Music: On' : '🎵 Music';
    });
    
    // Learning mode toggle
    refs.learningToggle.addEventListener('click', () => {
      state.learningMode = !state.learningMode;
      refs.learningToggle.setAttribute('aria-pressed', state.learningMode);
      refs.learningToggle.textContent = state.learningMode ? '📖 Learning: On' : '📖 Learning Mode';
    });

    // Manual input submit button
    if(refs.submitBtn){
      refs.submitBtn.addEventListener('click', handleManualInputSubmit);
    }
    
    // Manual input Enter key support
    if(refs.answerInput){
      refs.answerInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && state.running){
          handleManualInputSubmit();
        }
      });
    }

    // Keyboard support
    document.addEventListener('keydown', (e) => {
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
    refs.playAgainBtn.addEventListener('click', startGame);
    refs.changeSettingsBtn.addEventListener('click', hideScoreScreen);
  }

  // Initialize game
  function init(){
    load();
    setupUI();
    updateUI();
    
    // Set active theme based on current body data-theme
    const currentTheme = document.body.getAttribute('data-theme') || 'lavender-fields';
    const activeThemeBtn = document.querySelector(`.theme[data-theme="${currentTheme}"]`);
    if(activeThemeBtn) activeThemeBtn.classList.add('active');
    
    // Create mascot for current theme and set mood
    createMascotForTheme(currentTheme);
    setMascotMood('neutral');
  }

  return { init, startGame, resetGame, state };
})();

// Start
document.addEventListener('DOMContentLoaded', ()=>{ 
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
});
