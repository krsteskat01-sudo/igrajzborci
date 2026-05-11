// ── Word Builder ── Reassemble scrambled word tiles to match the definition
function initWordBuilder(category) {
  const pool = getWordPool(category);
  const TOTAL_WORDS = 10;
  const GAME_TIME   = 90;

  let score = 0, combo = 0, wordsDone = 0;
  let timeLeft = GAME_TIME, timerInterval = null;
  let wordQueue = [], currentWord = null;
  let tiles = [], slotValues = [], correctTiles = [];
  let wordStartTime = 0, _checking = false;

  // Game-specific background decoration
  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:50%;left:1%;font-size:34px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:20%;left:3%">*</span>
    <span class="gbg-star" style="bottom:18%;right:2%">*</span>
    <div class="gbg-blob" style="width:80px;height:80px;top:8%;right:5%"></div>
    <div class="gbg-blob" style="width:55px;height:55px;bottom:12%;left:4%"></div>
    ${childExtra}</div>`;

  SoundFX.start();

  // ── Helpers ──────────────────────────────────────────────────
  function shuffle(arr) {
    const arrayCopy = [...arr];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
  }

  // Syllabify a Macedonian word into сложуви (syllables)
  // Every syllable needs a vowel; consonants attach to the following vowel.
  // For clusters, the longest valid Macedonian onset from the end goes with the next vowel.
  function syllabifyMk(word) {
    const isVowel = c => 'аеиоуАЕИОУ'.includes(c);

    // Valid 3- and 2-consonant syllable onsets in Macedonian (lowercase Cyrillic)
    const O3 = new Set(['стр','скр','спр','здр','збр','згр']);
    const O2 = new Set([
      'бл','бр','вл','вр','гл','гр','дв','дн','др',
      'зб','зг','зм','зр','кл','кн','кр','мн','пл','пн','пр',
      'св','ск','сл','см','сн','сп','ср','ст','тр','фр','цр','чр','шт',
    ]);

    const chars = [...word];
    const len = chars.length;

    // Collect vowel positions
    const vpos = chars.reduce((acc, c, i) => (isVowel(c) ? [...acc, i] : acc), []);
    if (vpos.length <= 1) return [word]; // mono-syllabic or no vowel — return as-is

    // Build syllable start boundaries
    const bounds = [0];
    for (let vi = 0; vi < vpos.length - 1; vi++) {
      const v1 = vpos[vi];       // current vowel index
      const v2 = vpos[vi + 1];   // next vowel index
      const gap = v2 - v1 - 1;   // number of consonants between the two vowels

      let splitAt;
      if (gap === 0) {
        splitAt = v2;             // adjacent vowels → split right before next vowel
      } else if (gap === 1) {
        splitAt = v1 + 1;         // single consonant → belongs to next syllable
      } else {
        // Multiple consonants: find longest valid Macedonian onset from the cluster end
        const cluster = chars.slice(v1 + 1, v2).map(c => c.toLowerCase()).join('');
        let onsetLen = 1;         // default: last consonant is the onset
        if (gap >= 3 && O3.has(cluster.slice(-3))) onsetLen = 3;
        else if (gap >= 2 && O2.has(cluster.slice(-2))) onsetLen = 2;
        splitAt = v2 - onsetLen;
      }
      bounds.push(splitAt);
    }

    // Slice the original word at each boundary
    return bounds.map((start, i) => {
      const end = i + 1 < bounds.length ? bounds[i + 1] : len;
      return chars.slice(start, end).join('');
    });
  }

  // ── Game flow ─────────────────────────────────────────────────
  wordQueue = shuffle(pool).slice(0, TOTAL_WORDS);

  function loadNextWord() {
    if (wordsDone >= TOTAL_WORDS) { endGame(); return; }
    currentWord  = wordQueue[wordsDone];
    correctTiles = syllabifyMk(currentWord.zbor.toUpperCase());
    tiles        = shuffle(correctTiles).map((text, idx) => ({ text, idx, used: false, slotIdx: -1 }));
    slotValues   = new Array(correctTiles.length).fill(null);
    wordStartTime = Date.now();
    _checking     = false;
    render();
  }

  function render() {
    const tilesHtml = tiles.map((tile, i) => `
      <button class="wb-tile${tile.used ? ' wb-tile-used' : ''}"
        data-tile="${i}" onclick="wbClickTile(${i})"
        ${tile.used ? 'disabled' : ''}>${tile.text}</button>`
    ).join('');

    const slotsHtml = slotValues.map((val, i) => `
      <div class="wb-slot${val !== null ? ' wb-slot-filled' : ''}"
        data-slot="${i}" onclick="wbClickSlot(${i})">${val !== null ? val : ''}</div>`
    ).join('');

    const comboHtml = combo >= 3
      ? `<span class="wb-combo">🔥 ×${Math.min(combo, 5)} Combo</span>` : '';

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="clearInterval(window._wbTimer);showHub()">✕</button>
          <span class="bar-title">🧩 Word Builder</span>
          <span class="bar-stat">⭐ <strong id="wb-score">${score}</strong></span>
          <span class="bar-stat${timeLeft <= 15 ? ' sr-urgent' : ''}" id="wb-time">⏱ ${timeLeft}с</span>
          <span class="bar-stat">${wordsDone + 1}/${TOTAL_WORDS}</span>
        </div>
        <div class="wb-body">
          <div class="wb-def">&bdquo;${currentWord.definicija}&ldquo;</div>
          <div class="wb-meta">
            ${comboHtml}
            <span class="wb-instruction">Сложи го зборот</span>
          </div>
          <div class="wb-answer-row" id="wb-slots">${slotsHtml}</div>
          <div id="wb-msg" class="game-msg"></div>
          <div class="wb-tiles-row" id="wb-tiles">${tilesHtml}</div>
        </div>
      </div>`;
  }

  // ── Tile & slot interaction ───────────────────────────────────
  window.wbClickTile = function(tileIdx) {
    if (_checking) return;
    const tile = tiles[tileIdx];
    if (!tile || tile.used) return;

    const emptySlot = slotValues.findIndex(v => v === null);
    if (emptySlot === -1) return;

    tile.used     = true;
    tile.slotIdx  = emptySlot;
    slotValues[emptySlot] = tile.text;

    _refreshDOM();
    if (!slotValues.includes(null)) { _checking = true; checkAnswer(); }
  };

  window.wbClickSlot = function(slotIdx) {
    if (_checking) return;
    if (slotValues[slotIdx] === null) return;

    const text = slotValues[slotIdx];
    slotValues[slotIdx] = null;

    const tile = tiles.find(t => t.used && t.slotIdx === slotIdx);
    if (tile) { tile.used = false; tile.slotIdx = -1; }

    _refreshDOM();
  };

  function _refreshDOM() {
    const slotsEl = document.getElementById('wb-slots');
    const tilesEl = document.getElementById('wb-tiles');
    if (slotsEl) slotsEl.innerHTML = slotValues.map((val, i) =>
      `<div class="wb-slot${val !== null ? ' wb-slot-filled' : ''}"
        data-slot="${i}" onclick="wbClickSlot(${i})">${val !== null ? val : ''}</div>`
    ).join('');
    if (tilesEl) tilesEl.innerHTML = tiles.map((tile, i) =>
      `<button class="wb-tile${tile.used ? ' wb-tile-used' : ''}"
        data-tile="${i}" onclick="wbClickTile(${i})"
        ${tile.used ? 'disabled' : ''}>${tile.text}</button>`
    ).join('');
  }

  // ── Answer check ──────────────────────────────────────────────
  function checkAnswer() {
    const assembled = slotValues.join('');
    const isCorrect  = assembled === correctTiles.join('');

    if (isCorrect) {
      const elapsed = (Date.now() - wordStartTime) / 1000;
      const speedBonus = elapsed < 6 ? 10 : 0;
      combo++;
      const comboBonus = combo >= 3 ? 15 : 0;
      const pts = 25 + speedBonus + comboBonus;
      score += pts;

      if (typeof window.saveAnswerDelta === 'function')  window.saveAnswerDelta(pts);
      if (typeof window.onWordAnswered  === 'function')  window.onWordAnswered(currentWord.zbor, currentWord.definicija, true, currentWord);

      SoundFX.correct();
      if (combo % 3 === 0) SoundFX.streak();
      popScore(document.getElementById('wb-score'));

      const slotsEl = document.getElementById('wb-slots');
      if (slotsEl) slotsEl.classList.add('wb-correct-glow');
      launchConfetti(slotsEl);

      const scoreEl = document.getElementById('wb-score');
      if (scoreEl) scoreEl.textContent = score;

      let msgParts = [`<span class="fb-correct">✓ Точно! +${pts}</span>`];
      if (speedBonus) msgParts.push(`<span class="fb-correct"> ⚡ Брзо!</span>`);
      if (comboBonus) msgParts.push(`<span class="fb-correct"> 🔥 Combo!</span>`);
      const msg = document.getElementById('wb-msg');
      if (msg) msg.innerHTML = msgParts.join('');

      wordsDone++;
      setTimeout(() => {
        if (wordsDone >= TOTAL_WORDS) endGame();
        else loadNextWord();
      }, 950);
    } else {
      const prevScore = score;
      score = Math.max(0, score - 5);
      if (typeof window.saveAnswerDelta === 'function')  window.saveAnswerDelta(score - prevScore);
      combo = 0;
      SoundFX.wrong();

      const slotsEl = document.getElementById('wb-slots');
      if (slotsEl) slotsEl.classList.add('wb-wrong-shake');
      const msg = document.getElementById('wb-msg');
      if (msg) msg.innerHTML = `<span class="fb-wrong">✗ Обиди се пак! −5. Збор: <strong>${currentWord.zbor}</strong></span>`;

      setTimeout(() => {
        slotValues.fill(null);
        tiles.forEach(t => { t.used = false; t.slotIdx = -1; });
        _checking = false;
        _refreshDOM();
        if (slotsEl) slotsEl.classList.remove('wb-wrong-shake');
        if (msg) msg.innerHTML = '';
      }, 750);
    }
  }

  // ── Timer & end ───────────────────────────────────────────────
  function endGame() {
    clearInterval(timerInterval);
    if (typeof animateCoinReward === 'function') animateCoinReward(score);
    setTimeout(() => showResult(score, 'wordbuilder'), 450);
  }

  timerInterval = setInterval(() => {
    timeLeft--;
    const timeEl = document.getElementById('wb-time');
    if (timeEl) {
      timeEl.textContent = `⏱ ${timeLeft}с`;
      if (timeLeft <= 15) timeEl.style.color = '#e53e3e';
    }
    if (timeLeft <= 5 && timeLeft > 0) SoundFX.tick();
    if (timeLeft <= 0) endGame();
  }, 1000);
  window._wbTimer = timerInterval;

  loadNextWord();
}
