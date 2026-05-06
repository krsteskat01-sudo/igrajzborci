/**
 * Што прави: Иницијализира и започнува квиз игра "Кој збор е тоа"
 * Параметри: category (стринг) - избраната категорија
 * Враќа: ништо
 */
function initQuiz(category) {
  // Земи листа на зборови за избраната категорија
  const pool    = getWordPool(category);
  const TOTAL_Q = 10; // Вкупно прашања

  // ── Локална состојба ──
  let score = 0, questionIndex = 0, hintUsed = false;
  let questions = [];
  let _advancing = false; // Заштита од повеќе кликови

  // Мотивациони пораки
  const MOTIVATIONS = [
    'Размисли добро! 🧠', 'Речникот чека! 📖', 'Ајде! 💪',
    'Ти можеш! ⭐', 'Зборот те чека! 🔍', 'Полека, сигурно! 🎯', 'Одличен избор! ✨',
  ];

  // Дополнителни ѕвезди за деца
  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:55%;left:2%;font-size:36px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:18%;left:3%">*</span>
    <span class="gbg-star" style="bottom:20%;right:3%">*</span>
    <div class="gbg-blob" style="width:85px;height:85px;top:8%;right:7%"></div>
    <div class="gbg-blob" style="width:55px;height:55px;bottom:14%;left:5%"></div>
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
   * Што прави: Ги генерира прашањата за квизот со точни и неточни опции
   * Параметри: нема
   * Враќа: низа од објекти со прашања
   */
  function buildQuestions() {
    const words = shuffle([...pool]).slice(0, TOTAL_Q);
    return words.map(word => {
      // Избери два други збора како неточни опции
      const others = shuffle(pool.filter(w => w.zbor !== word.zbor));
      return {
        def:      word.definicija,
        correct:  word.zbor,
        options:  shuffle([word.zbor, others[0].zbor, others[1].zbor]),
        wordData: word,
      };
    });
  }

  /**
   * Што прави: Го црта тековното прашање на екранот
   * Параметри: нема
   * Враќа: ништо
   */
  function renderQuestion() {
    if (questionIndex >= TOTAL_Q) { showResult(score, 'quiz'); return; }

    _advancing = false;
    hintUsed   = false;
    const question          = questions[questionIndex];
    const motivation = MOTIVATIONS[questionIndex % MOTIVATIONS.length];

    // Генерирај копчиња за опциите
    const optsHtml = question.options.map((option, i) =>
      `<button class="quiz-opt card-enter" style="animation-delay:${i * 70}ms"
        data-ans="${option}" onclick="quizAnswer(this)">${option}</button>`
    ).join('');

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="showHub()">✕</button>
          <span class="bar-title">Кој збор е тоа</span>
          <span class="bar-stat">Поени: <strong id="quiz-score">${score}</strong></span>
        </div>
        <div class="quiz-body">
          <div class="quiz-def card-enter">&bdquo;${question.def}&ldquo;</div>
          <div id="quiz-hint" class="quiz-hint-box"></div>
          <div class="quiz-options">${optsHtml}</div>
          <div class="quiz-counter">Прашање ${questionIndex + 1} од ${TOTAL_Q}</div>
          <button class="hint-btn" id="quiz-hint-btn" onclick="quizHint()">💡 Намек (−10 поени)</button>
          <div id="quiz-msg" class="game-msg"></div>
          <p class="game-motivate">${motivation}</p>
        </div>
      </div>`;
  }

  /**
   * Што прави: Проверува дали избраниот одговор е точен и доделува поени
   * Параметри: btn (HTML елемент) - кликнатото копче
   * Враќа: ништо
   */
  window.quizAnswer = function(btn) {
    if (_advancing) return; // Веќе се префрламе на следно
    _advancing = true;

    const answer  = btn.dataset.ans;
    const question       = questions[questionIndex];
    const correct = answer === question.correct;

    // Поени: точно +15 (или +5 со намек), погрешно −5
    const pts = correct ? (hintUsed ? 5 : 15) : -5;
    if (typeof window.onWordAnswered === 'function') window.onWordAnswered(question.correct, question.def, correct, question.wordData);

    const previousScore = score;
    score = Math.max(0, score + pts);
    if (typeof window.saveAnswerDelta === 'function') window.saveAnswerDelta(score - previousScore);

    // Обој ги копчињата за фидбек
    document.querySelectorAll('.quiz-opt').forEach(b => {
      b.disabled = true;
      if (b.dataset.ans === question.correct) b.classList.add('opt-correct');
    });
    if (!correct) btn.classList.add('opt-wrong');

    const hintBtn = document.getElementById('quiz-hint-btn');
    if (hintBtn) hintBtn.disabled = true;

    if (correct) {
      SoundFX.correct();
      launchConfetti(document.querySelector('.quiz-def'));
    } else {
      SoundFX.wrong();
    }
    popScore(document.getElementById('quiz-score'));

    const scoreEl = document.getElementById('quiz-score');
    if (scoreEl) scoreEl.textContent = score;

    const msg = document.getElementById('quiz-msg');
    if (msg) msg.innerHTML = correct
      ? `<span class="fb-correct">Точно! +${pts} поени</span>`
      : `<span class="fb-wrong">Неточно −5 поени. Точно: <strong>${question.correct}</strong></span>`;

    // Оди на следно прашање по кратка пауза
    questionIndex++;
    setTimeout(renderQuestion, 1100);
  };

  /**
   * Што прави: Прикажува намек (првата буква) со одземање поени
   * Параметри: нема
   * Враќа: ништо
   */
  window.quizHint = function() {
    if (hintUsed || _advancing) return;
    hintUsed = true;
    const question       = questions[questionIndex];
    const hintElement  = document.getElementById('quiz-hint');
    const hintBtn = document.getElementById('quiz-hint-btn');
    if (hintElement)  hintElement.textContent = `Намек: Зборот почнува со „${question.correct[0]}"`;
    if (hintBtn) hintBtn.disabled = true;
  };

  // Иницијализација на квизот
  questions = buildQuestions();
  renderQuestion();
}
