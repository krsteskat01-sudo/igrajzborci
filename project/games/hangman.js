/**
 * Што прави: Иницијализира и започнува игра "Збор по збор" (Бесилка)
 * Параметри: category (стринг) - избраната категорија за зборови
 * Враќа: ништо
 */
function initHangman(category) {
  // Земи листа на зборови за избраната категорија
  const pool      = getWordPool(category);
  const MK_ALPHA  = ['А','Б','В','Г','Д','Ѓ','Е','Ж','З','Ѕ','И','Ј','К','Л','Љ','М','Н','Њ','О','П','Р','С','Т','Ќ','У','Ф','Х','Ц','Ч','Џ','Ш'];
  const TOTAL_WORDS = 8; // Вкупно зборови по игра
  const MAX_WRONG   = 5; // Максимум дозволени грешки

  // ── Локална состојба ──
  let score = 0, wordIndex = 0;
  let words = [], currentWord = '';
  let guessed = new Set(), wrongCount = 0, transitioning = false;

  const MOTIVATIONS = [
    'Буква по буква! 🔤', 'Речникот чека! 📖', 'Размисли добро! 🧠',
    'Ајде! 💪', 'Ти можеш! ⭐', 'Полека, сигурно! 🎯', 'Одличен збор! ✨',
  ];

  // Дополнителна позадина за деца
  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:50%;right:2%;font-size:34px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:18%;left:3%">*</span>
    <span class="gbg-star" style="bottom:22%;right:3%">*</span>
    <div class="gbg-blob" style="width:85px;height:85px;top:8%;right:6%"></div>
    <div class="gbg-blob" style="width:58px;height:58px;bottom:14%;left:5%"></div>
    ${childExtra}
  </div>`;

  SoundFX.start();

  /**
   * Што прави: Меша низа по случаен избор
   * Параметри: arr (низа)
   * Враќа: нова измешана низа
   */
  function shuffle(arr) {
    const arrayCopy = [...arr];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
  }

  /**
   * Што прави: Го црта HTML-от за тековниот екран на играта
   * Параметри: msgHtml (стринг) - опционална порака за прикажување
   * Враќа: ништо
   */
  function render(msgHtml) {
    const starsLeft = MAX_WRONG - wrongCount;
    // HTML за преостанати животи (ѕвезди)
    const starsHtml =
      '<span class="star-on">⭐</span>'.repeat(starsLeft) +
      '<span class="star-lost">☆</span>'.repeat(wrongCount);

    // HTML за буквите од зборот
    const tilesHtml = currentWord.split('').map(letter => {
      const revealed = guessed.has(letter);
      return `<span class="hm-tile${revealed ? ' revealed' : ''}">${revealed ? letter : ''}</span>`;
    }).join('');

    // HTML за тастатурата
    const keyHtml = MK_ALPHA.map(letter => {
      const used = guessed.has(letter);
      const hit  = used && currentWord.includes(letter);
      const miss = used && !currentWord.includes(letter);
      return `<button class="key-btn${hit ? ' key-hit' : ''}${miss ? ' key-miss' : ''}"
        data-ch="${letter}" ${used || transitioning ? 'disabled' : ''}
        onclick="hmGuess(this.dataset.ch)">${letter}</button>`;
    }).join('');

    const motivation = MOTIVATIONS[wordIndex % MOTIVATIONS.length];

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="hmExit()">✕</button>
          <span class="bar-title">Збор по збор</span>
          <span class="bar-stat">Поени: <strong>${score}</strong></span>
          <span class="bar-stat">Збор ${wordIndex + 1}/${TOTAL_WORDS}</span>
        </div>
        <div class="hm-body">
          <div class="hm-stars">${starsHtml}</div>
          <div class="hm-def">${words[wordIndex].definicija}</div>
          <div class="hm-tiles">${tilesHtml}</div>
          <div class="hm-keyboard">${keyHtml}</div>
          ${msgHtml ? `<div class="hm-msg">${msgHtml}</div>` : '<div class="hm-msg"></div>'}
          <p class="game-motivate">${motivation}</p>
        </div>
      </div>`;
  }

  /**
   * Што прави: Проверува дали избраната буква е точна
   * Параметри: ch (карактер) - кликнатата буква
   * Враќа: ништо
   */
  window.hmGuess = function(letter) {
    if (transitioning) return;
    guessed.add(letter);

    if (currentWord.includes(letter)) {
      // ── Точна буква ──
      const allRevealed = currentWord.split('').every(c => guessed.has(c));
      if (allRevealed) {
        // Зборот е целосно погоден
        transitioning = true;
        const starsLeft = MAX_WRONG - wrongCount;
        const pts = [5, 8, 12, 16, 20][starsLeft - 1] || 5;
        score += pts;
        
        if (typeof window.saveAnswerDelta === 'function') window.saveAnswerDelta(pts);
        SoundFX.streak();
        launchConfetti(document.querySelector('.hm-tiles'));
        if (typeof window.onWordAnswered === 'function') window.onWordAnswered(words[wordIndex].zbor, words[wordIndex].definicija, true, words[wordIndex]);
        
        render(`<span class="fb-correct">Точно! +${pts} поени ${'⭐'.repeat(starsLeft)}</span>`);
        wordIndex++;
        setTimeout(startWord, 1600);
      } else {
        // Уште букви фалат
        SoundFX.correct();
        render(null);
      }
    } else {
      // ── Погрешна буква ──
      wrongCount++;
      SoundFX.wrong();
      if (wrongCount >= MAX_WRONG) {
        // Изгубени сите животи
        transitioning = true;
        if (typeof window.onWordAnswered === 'function') window.onWordAnswered(words[wordIndex].zbor, words[wordIndex].definicija, false, words[wordIndex]);
        render(`<span class="fb-wrong">Зборот беше: <strong>${currentWord}</strong></span>`);
        wordIndex++;
        setTimeout(startWord, 2000);
      } else {
        render(null);
      }
    }
  };

  // Keyboard support — Macedonian letters trigger hmGuess directly
  function _hmKey(e) {
    if (transitioning) return;
    const key = e.key.toUpperCase();
    if (MK_ALPHA.includes(key) && !guessed.has(key)) {
      e.preventDefault();
      window.hmGuess(key);
    }
  }
  document.addEventListener('keydown', _hmKey);

  window.hmExit = function() {
    document.removeEventListener('keydown', _hmKey);
    clearInterval(window._hmTimer);
    showResult(score, 'hangman');
  };

  function startWord() {
    if (wordIndex >= TOTAL_WORDS) {
      document.removeEventListener('keydown', _hmKey);
      showResult(score, 'hangman');
      return;
    }
    currentWord   = words[wordIndex].zbor.toUpperCase();
    guessed       = new Set();
    wrongCount    = 0;
    transitioning = false;
    render(null);
  }

  // Измешај зборови и започни
  words = shuffle(pool).slice(0, TOTAL_WORDS);
  startWord();
}
