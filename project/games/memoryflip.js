// ── Memory Flip ── Flip cards to match Macedonian words with definitions
function initMemoryFlip(category) {
  const pool     = getWordPool(category);
  const NUM_PAIRS = 8;
  const GAME_TIME = 150;

  let score = 0, combo = 0, pairsFound = 0;
  let flipped   = [];       // indices of currently face-up (unmatched) cards
  let matched   = new Set(); // pairIds of matched pairs
  let isLocked  = false;
  let timeLeft  = GAME_TIME, timerInterval = null;

  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:52%;left:1%;font-size:32px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:18%;left:3%">*</span>
    <span class="gbg-star" style="bottom:18%;right:2%">*</span>
    <div class="gbg-blob" style="width:75px;height:75px;top:8%;right:5%"></div>
    <div class="gbg-blob" style="width:52px;height:52px;bottom:12%;left:4%"></div>
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

  // Build 8 word/definition pairs → 16 cards shuffled
  const wordPairs = shuffle([...pool]).slice(0, NUM_PAIRS);
  const rawCards  = [];
  wordPairs.forEach((word, pairId) => {
    rawCards.push({ pairId, type: 'word', text: word.zbor,        wordData: word });
    rawCards.push({ pairId, type: 'def',  text: word.definicija,  wordData: word });
  });
  const cards = shuffle(rawCards); // final card order

  // ── Full render ───────────────────────────────────────────────
  function render() {
    const cardsHtml = cards.map((card, idx) => {
      const isFaceUp  = flipped.includes(idx) || matched.has(card.pairId);
      const isMatched = matched.has(card.pairId);
      const backIcon  = card.type === 'word' ? '📖' : '💬';
      return `
        <div class="mf-card${isFaceUp ? ' mf-flipped' : ''}${isMatched ? ' mf-matched' : ''}"
          data-idx="${idx}" onclick="mfFlip(${idx})">
          <div class="mf-inner">
            <div class="mf-back"><span class="mf-back-icon">${backIcon}</span></div>
            <div class="mf-front"><span class="mf-card-text">${card.text}</span></div>
          </div>
        </div>`;
    }).join('');

    const comboHtml = combo >= 2
      ? `<span class="mf-combo">🔥 ${combo}× Combo!</span>` : `<span></span>`;

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="clearInterval(window._mfTimer);showHub()">✕</button>
          <span class="bar-title">🃏 Memory Flip</span>
          <span class="bar-stat">⭐ <strong id="mf-score">${score}</strong></span>
          <span class="bar-stat${timeLeft <= 20 ? ' sr-urgent' : ''}" id="mf-time">⏱ ${timeLeft}с</span>
          <span class="bar-stat">${pairsFound}/${NUM_PAIRS} пара</span>
        </div>
        <div class="mf-body">
          <div class="mf-header">
            ${comboHtml}
            <span class="mf-hint">Спои збор со дефиниција</span>
          </div>
          <div class="mf-grid" id="mf-grid">${cardsHtml}</div>
          <div id="mf-msg" class="game-msg"></div>
        </div>
      </div>`;

    window._mfTimer = timerInterval;
  }

  // ── Card flip handler ─────────────────────────────────────────
  window.mfFlip = function(idx) {
    if (isLocked) return;
    if (flipped.includes(idx)) return;
    if (matched.has(cards[idx].pairId)) return;
    if (flipped.length >= 2) return;

    flipped.push(idx);
    const cardEl = document.querySelector(`.mf-card[data-idx="${idx}"]`);
    if (cardEl) cardEl.classList.add('mf-flipped');
    SoundFX.tick();

    if (flipped.length === 2) { isLocked = true; checkPair(); }
  };

  // ── Pair check ────────────────────────────────────────────────
  function checkPair() {
    const [idx1, idx2] = flipped;
    const card1 = cards[idx1], card2 = cards[idx2];

    if (card1.pairId === card2.pairId) {
      // ── Match ─────────────────────────────────────────────────
      setTimeout(() => {
        combo++;
        const comboBonus = combo >= 2 ? (combo - 1) * 8 : 0;
        const pts = 25 + comboBonus;
        score += pts;
        pairsFound++;
        matched.add(card1.pairId);

        if (typeof window.saveAnswerDelta === 'function')  window.saveAnswerDelta(pts);
        if (typeof window.onWordAnswered  === 'function')  window.onWordAnswered(card1.wordData.zbor, card1.wordData.definicija, true, card1.wordData);

        SoundFX.correct();
        if (combo >= 3) SoundFX.streak();
        popScore(document.getElementById('mf-score'));

        [idx1, idx2].forEach(i => {
          const el = document.querySelector(`.mf-card[data-idx="${i}"]`);
          if (el) el.classList.add('mf-matched');
        });

        launchConfetti(document.getElementById('mf-grid'));

        const scoreEl = document.getElementById('mf-score');
        if (scoreEl) scoreEl.textContent = score;

        const msg = document.getElementById('mf-msg');
        if (msg) msg.innerHTML = `<span class="fb-correct">✓ +${pts}${comboBonus ? ' 🔥' : ''}</span>`;

        // Update combo badge without full re-render
        const comboBadge = document.querySelector('.mf-combo');
        if (combo >= 2) {
          if (comboBadge) comboBadge.textContent = `🔥 ${combo}× Combo!`;
          else {
            const header = document.querySelector('.mf-header');
            if (header) {
              const span = document.createElement('span');
              span.className = 'mf-combo';
              span.textContent = `🔥 ${combo}× Combo!`;
              header.prepend(span);
            }
          }
        }

        flipped   = [];
        isLocked  = false;

        if (pairsFound >= NUM_PAIRS) endGame();
      }, 480);
    } else {
      // ── No match ──────────────────────────────────────────────
      setTimeout(() => {
        combo = 0;
        SoundFX.wrong();

        [idx1, idx2].forEach(i => {
          const el = document.querySelector(`.mf-card[data-idx="${i}"]`);
          if (el) el.classList.remove('mf-flipped');
        });

        if (typeof window.onWordAnswered === 'function')  window.onWordAnswered(card1.wordData.zbor, card1.wordData.definicija, false, card1.wordData);

        const msg = document.getElementById('mf-msg');
        if (msg) msg.innerHTML = `<span class="fb-wrong">✗ Обиди се пак</span>`;

        const comboBadge = document.querySelector('.mf-combo');
        if (comboBadge) comboBadge.textContent = '';

        flipped   = [];
        isLocked  = false;
      }, 1000);
    }
  }

  // ── Timer & end ───────────────────────────────────────────────
  function endGame() {
    clearInterval(timerInterval);
    const timeBonus = Math.floor(timeLeft / 3);
    score += timeBonus;
    if (typeof animateCoinReward === 'function') animateCoinReward(score);
    setTimeout(() => showResult(score, 'memoryflip'), 500);
  }

  timerInterval = setInterval(() => {
    timeLeft--;
    const timeEl = document.getElementById('mf-time');
    if (timeEl) {
      timeEl.textContent = `⏱ ${timeLeft}с`;
      if (timeLeft <= 20) timeEl.className = 'bar-stat sr-urgent';
    }
    if (timeLeft <= 5 && timeLeft > 0) SoundFX.tick();
    if (timeLeft <= 0) endGame();
  }, 1000);
  window._mfTimer = timerInterval;

  render();
}
