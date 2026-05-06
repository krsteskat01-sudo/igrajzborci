// ── Fast Typing ── Type Macedonian words from definitions before time runs out
function initFastTyping(category) {
  const pool       = getWordPool(category);
  const TIME_LIMIT = 60;

  let score = 0, multiplier = 1, correctCount = 0, answeredCount = 0;
  let timeLeft = TIME_LIMIT, timerInterval = null;
  let wordQueue = [], currentWordIndex = 0;
  let _advancing = false;

  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:50%;left:1%;font-size:34px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:20%;left:3%">*</span>
    <span class="gbg-star" style="bottom:20%;right:2%">*</span>
    <div class="gbg-blob" style="width:80px;height:80px;top:8%;right:5%"></div>
    <div class="gbg-blob" style="width:55px;height:55px;bottom:12%;left:4%"></div>
    ${childExtra}</div>`;

  SoundFX.start();

  function shuffle(arr) {
    const arrayCopy = [...arr];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
  }

  // Large shuffled queue so we never run out in 60s
  wordQueue = shuffle([...pool, ...pool]).slice(0, 50);

  function getCurrentWord() {
    return wordQueue[currentWordIndex % wordQueue.length];
  }

  // ── Render ────────────────────────────────────────────────────
  function render() {
    const word     = getCurrentWord();
    const barPct   = (timeLeft / TIME_LIMIT) * 100;
    const barColor = timeLeft > 20 ? 'var(--teal)' : timeLeft > 10 ? 'var(--orange)' : '#e53e3e';
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 100;
    const multLabel = multiplier > 1 ? `×${multiplier.toFixed(1)}` : '';

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="clearInterval(window._ftTimer);showHub()">✕</button>
          <span class="bar-title">⌨️ Fast Typing</span>
          <span class="bar-stat">⭐ <strong id="ft-score">${score}</strong></span>
          ${multiplier > 1 ? `<span class="bar-stat ft-mult-badge">${multLabel}</span>` : ''}
        </div>
        <div class="ft-body">
          <div class="ft-timer-wrap">
            <div class="ft-timer-bar" id="ft-bar" style="width:${barPct}%;background:${barColor}"></div>
          </div>
          <div class="ft-time-label${timeLeft <= 10 ? ' ft-urgent' : ''}" id="ft-time">${timeLeft}s</div>
          <div class="ft-card card-enter">
            <div class="ft-def">&bdquo;${word.definicija}&ldquo;</div>
          </div>
          <div class="ft-input-wrap">
            <input type="text" id="ft-input" class="ft-input"
              autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"
              placeholder="Напиши го зборот..."
              onkeydown="if(event.key==='Enter'){ftSubmit();}else if(event.key==='Tab'){event.preventDefault();ftSkip();}">
            <button class="ft-submit-btn" onclick="ftSubmit()">→</button>
          </div>
          <div id="ft-feedback" class="ft-feedback"></div>
          <div class="ft-stats">
            <span>✓ ${correctCount} точни</span>
            <span>📊 ${accuracy}% точност</span>
            ${multiplier > 1 ? `<span class="ft-mult-text">🔥 ×${multiplier.toFixed(1)}</span>` : ''}
          </div>
          <button class="ft-skip-btn" onclick="ftSkip()">Прескокни [Tab] →</button>
        </div>
      </div>`;

    window._ftTimer = timerInterval;
    setTimeout(() => {
      const input = document.getElementById('ft-input');
      if (input) input.focus();
    }, 40);
  }

  // ── Submit answer ─────────────────────────────────────────────
  window.ftSubmit = function() {
    if (_advancing) return;
    const input = document.getElementById('ft-input');
    if (!input) return;
    const typed    = input.value.trim().toUpperCase();
    if (!typed) return;

    _advancing = true;
    answeredCount++;

    const word     = getCurrentWord();
    const expected = word.zbor.toUpperCase();

    if (typed === expected) {
      // ── Correct ───────────────────────────────────────────────
      correctCount++;
      multiplier = parseFloat(Math.min(3, multiplier + 0.25).toFixed(2));
      const pts  = Math.round(20 * multiplier);
      score     += pts;

      if (typeof window.saveAnswerDelta === 'function')  window.saveAnswerDelta(pts);
      if (typeof window.onWordAnswered  === 'function')  window.onWordAnswered(word.zbor, word.definicija, true, word);

      SoundFX.correct();
      popScore(document.getElementById('ft-score'));
      if (multiplier >= 2.5) SoundFX.streak();

      const fb = document.getElementById('ft-feedback');
      if (fb) fb.innerHTML = `<span class="fb-correct">✓ +${pts}${multiplier >= 2 ? ` 🔥×${multiplier.toFixed(1)}` : ''}</span>`;

      currentWordIndex++;
      setTimeout(() => { _advancing = false; render(); }, 280);
    } else {
      // ── Wrong ─────────────────────────────────────────────────
      multiplier = 1;
      SoundFX.wrong();
      if (typeof window.onWordAnswered === 'function')  window.onWordAnswered(word.zbor, word.definicija, false, word);

      const fb = document.getElementById('ft-feedback');
      if (fb) fb.innerHTML = `<span class="fb-wrong">✗ Точно: <strong>${word.zbor}</strong></span>`;

      if (input) input.classList.add('ft-input-error');
      setTimeout(() => {
        _advancing = false;
        const inp = document.getElementById('ft-input');
        if (inp) { inp.value = ''; inp.classList.remove('ft-input-error'); inp.focus(); }
        const fbEl = document.getElementById('ft-feedback');
        if (fbEl) fbEl.innerHTML = '';
      }, 850);
    }
  };

  // ── Skip ──────────────────────────────────────────────────────
  window.ftSkip = function() {
    if (_advancing) return;
    multiplier = Math.max(1, parseFloat((multiplier - 0.25).toFixed(2)));
    answeredCount++;
    currentWordIndex++;
    _advancing = false;
    render();
  };

  // ── Timer ─────────────────────────────────────────────────────
  timerInterval = setInterval(() => {
    timeLeft--;
    const timeEl = document.getElementById('ft-time');
    const barEl  = document.getElementById('ft-bar');

    if (timeEl) {
      timeEl.textContent = timeLeft + 's';
      timeEl.className = 'ft-time-label' + (timeLeft <= 10 ? ' ft-urgent' : '');
    }
    if (barEl) {
      const barColor = timeLeft > 20 ? 'var(--teal)' : timeLeft > 10 ? 'var(--orange)' : '#e53e3e';
      barEl.style.width      = (timeLeft / TIME_LIMIT * 100) + '%';
      barEl.style.background = barColor;
    }

    if (timeLeft <= 5 && timeLeft > 0) SoundFX.tick();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (typeof animateCoinReward === 'function') animateCoinReward(score);
      setTimeout(() => showResult(score, 'fasttyping'), 420);
    }
  }, 1000);
  window._ftTimer = timerInterval;

  render();
}
