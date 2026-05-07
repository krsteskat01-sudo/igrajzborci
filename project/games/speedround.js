/**
 * Што прави: Иницијализира и започнува игра "Брза Рунда"
 * Параметри: category (стринг) - избраната категорија за зборови
 * Враќа: ништо
 */
function initSpeedRound(category) {
  // Земи листа на зборови за избраната категорија
  const pool = getWordPool(category);
  const TIME_LIMIT = 60; // Време за игра во секунди

  // ── Локална состојба ──
  let score = 0, answered = 0, correct = 0;
  let timeLeft = TIME_LIMIT;
  let timerInterval = null;
  let currentQuestion = null;
  let _advancing = false;

  // Дополнителна позадина за деца
  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:50%;left:1%;font-size:34px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:22%;left:3%">*</span>
    <span class="gbg-star" style="bottom:20%;right:2%">*</span>
    <div class="gbg-blob" style="width:75px;height:75px;top:8%;right:5%"></div>
    <div class="gbg-blob" style="width:50px;height:50px;bottom:12%;left:4%"></div>
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
   * Што прави: Подготвува следно прашање со точна или погрешна дефиниција
   * Параметри: нема
   * Враќа: ништо
   */
  function nextQuestion() {
    const shuffled = shuffle(pool);
    const word = shuffled[0];
    const isCorrect = Math.random() > 0.5; // 50% шанса да е точна дефиницијата
    
    const others = pool.filter(w => w.zbor !== word.zbor);
    const definition = isCorrect
      ? word.definicija
      : others[Math.floor(Math.random() * others.length)].definicija;

    currentQuestion = { zbor: word.zbor, def: definition, isCorrect, wordData: word };
  }

  /**
   * Што прави: Го црта тековното прашање и тајмерот на екранот
   * Параметри: нема
   * Враќа: ништо
   */
  function render() {
    const barPercent = (timeLeft / TIME_LIMIT) * 100;
    // Бојата се менува како што истекува времето
    const barColor = timeLeft > 20 ? 'var(--teal)' : timeLeft > 10 ? 'var(--orange)' : '#e53e3e';

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="srExit()">✕</button>
          <span class="bar-title">⚡ Брза Рунда</span>
          <span class="bar-stat">Поени: <strong id="sr-score">${score}</strong></span>
        </div>
        <div class="sr-body">
          <div class="sr-timer-wrap">
            <div class="sr-timer-bar" id="sr-bar" style="width:${barPercent}%;background:${barColor}"></div>
          </div>
          <div class="sr-time-label${timeLeft <= 10 ? ' sr-urgent' : ''}" id="sr-time">${timeLeft}s</div>
          <div class="sr-card card-enter">
            <div class="sr-word">${currentQuestion.zbor}</div>
            <div class="sr-def">&bdquo;${currentQuestion.def}&ldquo;</div>
          </div>
          <div class="tf-buttons">
            <button class="btn-true"  onclick="srAnswer(true)">✓ ТОЧНО</button>
            <button class="btn-false" onclick="srAnswer(false)">✗ НЕТОЧНО</button>
          </div>
          <div id="sr-feedback" class="tf-feedback"></div>
          <div class="sr-stats">✓ ${correct} точни &nbsp;|&nbsp; ${answered} вкупно</div>
        </div>
      </div>`;
  }

  /**
   * Што прави: Проверува одговор (Точно/Неточно) и доделува поени
   * Параметри: answer (булова вредност) - одговорот на корисникот
   * Враќа: ништо
   */
  window.srAnswer = function(answer) {
    if (_advancing) return;
    _advancing = true;
    
    const question = currentQuestion;
    const isCorrect = answer === question.isCorrect;
    document.querySelectorAll('.btn-true, .btn-false').forEach(b => b.disabled = true);
    answered++;

    const previousScore = score;
    const feedbackElement = document.getElementById('sr-feedback');
    
    if (isCorrect) {
      score += 10;
      correct++;
      SoundFX.correct();
      popScore(document.getElementById('sr-score'));

      const scoreEl = document.getElementById('sr-score');
      if (scoreEl) scoreEl.textContent = score;
      if (feedbackElement) feedbackElement.innerHTML = '<span class="fb-correct">✓ +10</span>';
    } else {
      score = Math.max(0, score - 3);
      SoundFX.wrong();

      const scoreEl = document.getElementById('sr-score');
      if (scoreEl) scoreEl.textContent = score;
      if (feedbackElement) feedbackElement.innerHTML = '<span class="fb-wrong">✗ −3</span>';
    }

    if (typeof window.saveAnswerDelta === 'function') window.saveAnswerDelta(score - previousScore);
    if (typeof window.onWordAnswered === 'function') {
      window.onWordAnswered(question.zbor, question.def, isCorrect, question.wordData);
    }
    
    nextQuestion();
    setTimeout(() => { _advancing = false; render(); }, 350);
  };

  /**
   * Што прави: Излегува од играта предвреме
   * Параметри: нема
   * Враќа: ништо
   */
  window.srExit = function() { clearInterval(timerInterval); showHub(); };

  /**
   * Што прави: Се извршува секоја секунда за да го намали времето
   * Параметри: нема
   * Враќа: ништо
   */
  function tickTimer() {
    timeLeft--;
    const timerElement = document.getElementById('sr-time');
    const progressBar  = document.getElementById('sr-bar');

    if (timerElement) {
      timerElement.textContent = timeLeft + 's';
      timerElement.className = 'sr-time-label' + (timeLeft <= 10 ? ' sr-urgent' : '');
    }

    const barColor = timeLeft > 20 ? 'var(--teal)' : timeLeft > 10 ? 'var(--orange)' : '#e53e3e';
    if (progressBar) {
      progressBar.style.width = (timeLeft / TIME_LIMIT * 100) + '%';
      progressBar.style.background = barColor;
    }
    
    if (timeLeft <= 5 && timeLeft > 0) SoundFX.tick();
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      SoundFX.streak();
      setTimeout(() => showResult(score, 'speedround'), 400);
    }
  }

  // Започни ја играта
  nextQuestion();
  render();
  timerInterval = setInterval(tickTimer, 1000);
}
