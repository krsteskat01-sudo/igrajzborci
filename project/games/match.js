// ── Игра Спој ──────────────────────────────────────────

/**
 * Што прави: Ја иницијализира и започнува играта Спојување
 * Параметри: category (стринг) - избраната категорија за зборови
 * Враќа: ништо
 */
function initMatch(category) {
  // Земи листа на зборови за избраната категорија
  const pool = getWordPool(category);

  // ── Локална состојба ──
  let score = 0, round = 1;
  const TOTAL_ROUNDS = 3; // Вкупно рунди
  let selectedWord = null, roundWords = [], busy = false;
  let _busyTimer = null; // Сигурносен тајмер против блокирање

  // Мотивациони пораки
  const MOTIVATIONS = [
    'Поврзи ги правилно! 🔗', 'Речникот чека! 📖', 'Ајде! 💪',
    'Размисли добро! 🧠', 'Одличен избор! ✨',
  ];

  // Дополнителни ѕвезди за деца
  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:50%;left:1%;font-size:34px">*</span>` : '';
  
  // HTML за позадината
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:22%;left:3%">*</span>
    <span class="gbg-star" style="bottom:20%;right:2%">*</span>
    <div class="gbg-blob" style="width:80px;height:80px;top:8%;right:5%"></div>
    <div class="gbg-blob" style="width:55px;height:55px;bottom:12%;left:4%"></div>
    ${childExtra}
  </div>`;

  // Звук за почеток
  SoundFX.start();

  // ── Помошни функции ──

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
   * Што прави: Привремено го заклучува екранот за да спречи повеќе кликови одеднаш
   * Параметри: val (булова вредност)
   * Враќа: ништо
   */
  function setBusy(val) {
    clearTimeout(_busyTimer);
    busy = val;
    if (val) {
      // Сигурносно отклучување после 1.5 сек
      _busyTimer = setTimeout(() => {
        busy = false;
        selectedWord = null;
      }, 1500);
    }
  }

  // ── Исцртување (UI) ──

  /**
   * Што прави: Го црта HTML-от за тековната рунда
   * Параметри: нема
   * Враќа: ништо
   */
  function render() {
    // Измешај ги дефинициите
    const defOrder   = shuffle(roundWords.map((_, i) => i));
    const motivation = MOTIVATIONS[(round - 1) % MOTIVATIONS.length];

    // HTML за картички со зборови
    const wordsHtml = roundWords.map((w, i) =>
      `<div class="match-card word-card card-enter" style="animation-delay:${i * 55}ms"
        data-idx="${i}" onclick="matchClickWord(${i})">${w.zbor}</div>`
    ).join('');

    // HTML за картички со дефиниции
    const defsHtml = defOrder.map((idx, i) =>
      `<div class="match-card def-card card-enter" style="animation-delay:${i * 55 + 25}ms"
        data-idx="${idx}" onclick="matchClickDef(${idx})">${roundWords[idx].definicija}</div>`
    ).join('');

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="showHub()">✕</button>
          <span class="bar-title">Спој го зборот</span>
          <span class="bar-stat">Поени: <strong id="match-score">${score}</strong></span>
          <span class="bar-stat">Рунда ${round}/${TOTAL_ROUNDS}</span>
        </div>
        <div class="match-grid">
          <div class="match-col" id="words-col">${wordsHtml}</div>
          <div class="match-col" id="defs-col">${defsHtml}</div>
        </div>
        <div id="match-msg" class="game-msg"></div>
        <p class="game-motivate">${motivation}</p>
      </div>`;
  }

  // ── Логика за интеракција ──

  /**
   * Што прави: Се повикува кога корисникот ќе кликне на картичка со збор
   * Параметри: idx (број) - индекс на зборот
   * Враќа: ништо
   */
  window.matchClickWord = function(idx) {
    if (busy) return; // Игнорирај ако моментално се проверува одговор
    
    const card = document.querySelector(`.word-card[data-idx="${idx}"]`);
    if (!card || card.classList.contains('matched')) return;
    
    // Ако го кликне веќе селектираниот збор, отселектирај
    if (selectedWord === idx) {
      card.classList.remove('selected');
      selectedWord = null;
      return;
    }
    
    // Тргни селекција од другите и селектирај го овој
    document.querySelectorAll('.word-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedWord = idx;
  };

  /**
   * Што прави: Се повикува кога корисникот ќе кликне на картичка со дефиниција
   * Параметри: idx (број) - индекс на дефиницијата
   * Враќа: ништо
   */
  window.matchClickDef = function(idx) {
    if (busy || selectedWord === null) return; // Мора прво да избере збор
    
    const defCard  = document.querySelector(`.def-card[data-idx="${idx}"]`);
    const wordCard = document.querySelector(`.word-card[data-idx="${selectedWord}"]`);
    if (!defCard || defCard.classList.contains('matched')) return;

    // Провери дали избраниот збор одговара на дефиницијата
    if (selectedWord === idx) {
      // ── Точно ──
      setBusy(true);
      score += 10;
      
      // Зачувај статистика
      if (typeof window.saveAnswerDelta === 'function') window.saveAnswerDelta(10);
      if (typeof window.onWordAnswered === 'function') window.onWordAnswered(roundWords[selectedWord].zbor, roundWords[selectedWord].definicija, true, roundWords[selectedWord]);
      
      SoundFX.correct();
      popScore(document.getElementById('match-score'));
      launchConfetti(wordCard);

      const scoreEl = document.getElementById('match-score');
      if (scoreEl) scoreEl.textContent = score;

      // Означи ги картичките како точни (зелени)
      wordCard.classList.add('matched', 'correct');
      defCard.classList.add('matched', 'correct');
      wordCard.classList.remove('selected');
      selectedWord = null;

      // Скриј ги картичките после кратко време
      setTimeout(() => {
        if (wordCard) wordCard.style.visibility = 'hidden';
        if (defCard)  defCard.style.visibility  = 'hidden';
        setBusy(false);
        checkRoundDone();
      }, 600);

    } else {
      // ── Погрешно ──
      setBusy(true);
      const previousScore = score;
      score = Math.max(0, score - 3); // Одземи поени (без да оди под 0)

      if (typeof window.saveAnswerDelta === 'function') window.saveAnswerDelta(score - previousScore);
      SoundFX.wrong();
      
      const scoreEl = document.getElementById('match-score');
      if (scoreEl) scoreEl.textContent = score;

      // Означи ги картичките како погрешни (црвени)
      wordCard.classList.add('wrong');
      defCard.classList.add('wrong');

      // Тргни ја црвената боја и селекцијата
      setTimeout(() => {
        if (wordCard) wordCard.classList.remove('wrong', 'selected');
        if (defCard)  defCard.classList.remove('wrong');
        selectedWord = null;
        setBusy(false);
      }, 650);
    }
  };

  /**
   * Што прави: Проверува дали се споени сите парови од тековната рунда
   * Параметри: нема
   * Враќа: ништо
   */
  function checkRoundDone() {
    if (document.querySelectorAll('.word-card:not(.matched)').length === 0) {
      round++;
      
      // Ако е крај, покажи резултати
      if (round > TOTAL_ROUNDS) {
        SoundFX.streak();
        setTimeout(() => showResult(score, 'match'), 400);
      } else {
        // Инаку почни нова рунда
        setTimeout(startRound, 500);
      }
    }
  }

  /**
   * Што прави: Започнува нова рунда со 4 случајни зборови
   * Параметри: нема
   * Враќа: ништо
   */
  function startRound() {
    roundWords   = shuffle(pool).slice(0, 4);
    selectedWord = null;
    setBusy(false);
    render();
  }

  // Започни прва рунда
  startRound();
}
