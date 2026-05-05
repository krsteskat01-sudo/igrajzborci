/**
 * Што прави: Иницијализира и започнува игра "Точно или Неточно"
 * Параметри: category (стринг) - избраната категорија за зборови
 * Враќа: ништо
 */
function initTrueFalse(category) {
  // Земи листа на зборови за избраната категорија
  const pool    = getWordPool(category);
  const TOTAL_Q = 20; // Вкупно прашања

  // ── Локална состојба ──
  let score = 0, qIndex = 0, streak = 0;
  let startTime = 0, timerInterval = null;
  let _advancing = false; // Заштита од повеќе кликови
  let lastTickSec = -1;
  let questions = [];
  let resultHistory = new Array(TOTAL_Q).fill(null); // Историја на одговори

  // Мотивациони пораки
  const MOTIVATIONS = [
    'Размисли добро! 🧠', 'Речникот чека! 📖', 'Ајде! 💪',
    'Ти можеш! ⭐', 'Зборот те чека! 🔍', 'Полека, сигурно! 🎯', 'Одличен избор! ✨',
  ];

  // Дополнителни ѕвезди за деца
  const childExtra = category === 'mladi'
    ? `<span class="gbg-star" style="top:48%;left:2%;font-size:38px">*</span>
       <span class="gbg-star" style="top:32%;right:2%;font-size:30px">*</span>` : '';
  const GAME_BG = `<div class="game-bg" aria-hidden="true">
    <span class="gbg-star" style="top:20%;left:3%">*</span>
    <span class="gbg-star" style="bottom:22%;right:3%">*</span>
    <div class="gbg-blob" style="width:90px;height:90px;top:10%;right:6%"></div>
    <div class="gbg-blob" style="width:60px;height:60px;bottom:15%;left:5%"></div>
    ${childExtra}
  </div>`;

  SoundFX.start();

  /**
   * Што прави: Меша низа по случаен избор
   * Параметри: arr (низа)
   * Враќа: нова измешана низа
   */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Што прави: Ги подготвува прашањата (пола точни, пола неточни дефиниции)
   * Параметри: нема
   * Враќа: измешана низа од прашања
   */
  function buildQuestions() {
    const words  = shuffle([...pool]);
    const half   = TOTAL_Q / 2;
    const result = [];
    
    for (let i = 0; i < TOTAL_Q; i++) {
      const word    = words[i % words.length];
      const correct = i < half; // Првата половина се точни
      
      if (correct) {
        result.push({ zbor: word.zbor, def: word.definicija, isCorrect: true, wordData: word });
      } else {
        const others = pool.filter(w => w.zbor !== word.zbor);
        const wrong  = others[Math.floor(Math.random() * others.length)];
        result.push({ zbor: word.zbor, def: wrong.definicija, isCorrect: false, wordData: word });
      }
    }
    return shuffle(result); // Измешај ги за да не се сите точни први
  }

  /**
   * Што прави: Го генерира HTML-от за точките за прогрес
   * Параметри: нема
   * Враќа: HTML стринг
   */
  function dotsHtml() {
    return `<div class="tf-progress">${
      Array.from({ length: TOTAL_Q }, (_, i) => {
        const r   = resultHistory[i];
        const cls = r === 'correct' ? 'd-correct'
                  : r === 'wrong'   ? 'd-wrong'
                  : i === qIndex    ? 'd-current'
                  : '';
        return `<div class="tf-dot ${cls}" data-qi="${i}"></div>`;
      }).join('')
    }</div>`;
  }

  /**
   * Што прави: Го црта тековното прашање и го стартува тајмерот
   * Параметри: нема
   * Враќа: ништо
   */
  function renderQuestion() {
    if (qIndex >= TOTAL_Q) { showResult(score, 'truefalse'); return; }

    _advancing  = false;
    lastTickSec = -1;
    const q          = questions[qIndex];
    const motivation = MOTIVATIONS[qIndex % MOTIVATIONS.length];

    document.getElementById('app').innerHTML = `
      <div class="game-wrap fade-in">
        ${GAME_BG}
        <div class="score-bar">
          <button class="exit-btn" onclick="tfExit()">✕</button>
          <span class="bar-title">Точно или Неточно</span>
          <span class="bar-stat">Поени: <strong id="tf-score">${score}</strong></span>
          <span class="bar-stat">${qIndex + 1}/${TOTAL_Q}</span>
        </div>
        <div class="tf-body">
          <div class="tf-meta">
            <span id="tf-timer" class="tf-timer">⏱ 0.0s</span>
            <span id="tf-streak" class="tf-streak ${streak >= 3 ? 'hot' : ''}">🔥 Низа: ${streak}</span>
          </div>
          <div class="tf-card card-enter" id="tf-card">
            <div class="tf-word">${q.zbor}</div>
            <div class="tf-def">&bdquo;${q.def}&ldquo;</div>
          </div>
          <div class="tf-buttons">
            <button class="btn-true"  onclick="tfAnswer(true)">✓ ТОЧНО</button>
            <button class="btn-false" onclick="tfAnswer(false)">✗ НЕТОЧНО</button>
          </div>
          <div id="tf-feedback" class="tf-feedback"></div>
          ${dotsHtml()}
          <p class="game-motivate">${motivation}</p>
        </div>
      </div>`;

    // Стартувај тајмер
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const el = document.getElementById('tf-timer');
      if (!el) { clearInterval(timerInterval); return; }
      
      const elapsed = (Date.now() - startTime) / 1000;
      el.textContent = '⏱ ' + elapsed.toFixed(1) + 's';
      
      const intSec = Math.floor(elapsed);
      if (intSec >= 5 && intSec !== lastTickSec) {
        lastTickSec = intSec;
        SoundFX.tick(); // Звук за отчукување секоја секунда после 5та
      }
    }, 100);
  }

  /**
   * Што прави: Проверува одговор (Точно/Неточно) и доделува поени
   * Параметри: answer (булова вредност) - одговорот на корисникот
   * Враќа: ништо
   */
  window.tfAnswer = function(answer) {
    if (_advancing) return;
    _advancing = true;
    clearInterval(timerInterval); // Запри го тајмерот

    const q       = questions[qIndex];
    const elapsed = (Date.now() - startTime) / 1000;
    const correct = answer === q.isCorrect;
    
    if (typeof window.onWordAnswered === 'function') window.onWordAnswered(q.zbor, q.def, correct, q.wordData);

    // Оневозможи копчиња за да спречиш повеќе кликови
    document.querySelectorAll('.btn-true, .btn-false').forEach(b => b.disabled = true);

    // Запиши во историјата и ажурирај ја точката за прогрес
    resultHistory[qIndex] = correct ? 'correct' : 'wrong';
    const thisDot = document.querySelector(`.tf-dot[data-qi="${qIndex}"]`);
    if (thisDot) {
      thisDot.classList.remove('d-current');
      thisDot.classList.add(correct ? 'd-correct' : 'd-wrong');
    }

    let pts = 0, msg = '';
    const prevScoreTF = score;

    if (correct) {
      // ── Точен одговор ──
      // Бонус поени ако се одговори брзо (под 3 или 5 секунди)
      const mult        = elapsed < 3 ? 2 : elapsed < 5 ? 1.5 : 1;
      streak++;
      const streakBonus = streak >= 3 ? 5 : 0; // Дополнителен бонус за низа
      
      pts    = Math.round(10 * mult) + streakBonus;
      score += pts;
      SoundFX.correct();
      if (streak % 5 === 0) SoundFX.streak();
      
      const card = document.getElementById('tf-card');
      if (card) { card.classList.add('pulse-correct'); launchConfetti(card); }
      popScore(document.getElementById('tf-score'));
      
      const speedTag  = mult === 2 ? ' ⚡×2' : mult === 1.5 ? ' ⚡×1.5' : '';
      const streakTag = streakBonus > 0 ? ` 🔥+${streakBonus}` : '';
      msg = `<span class="fb-correct">Точно! +${pts} поени${speedTag}${streakTag}</span>`;
      
    } else {
      // ── Погрешен одговор ──
      pts    = -3; // Губи 3 поени
      score  = Math.max(0, score + pts);
      streak = 0; // Ресетирај низа
      SoundFX.wrong();
      
      // Најди ја вистинската дефиниција за тој збор
      const realDef = pool.find(z => z.zbor === q.zbor)?.definicija || q.def;
      msg = `<span class="fb-wrong">Неточно −3 поени. „${q.zbor}": „${realDef}"</span>`;
    }
    
    if (typeof window.saveAnswerDelta === 'function') window.saveAnswerDelta(score - prevScoreTF);

    // Ажурирај UI за низа и поени
    const streakEl = document.getElementById('tf-streak');
    if (streakEl) {
      streakEl.className   = `tf-streak ${streak >= 3 ? 'hot' : ''}`;
      streakEl.textContent = `🔥 Низа: ${streak}`;
    }
    const scoreEl = document.getElementById('tf-score');
    if (scoreEl) scoreEl.textContent = score;
    const fb = document.getElementById('tf-feedback');
    if (fb) fb.innerHTML = msg;

    // Оди на следно прашање по кратка пауза
    qIndex++;
    setTimeout(renderQuestion, 1200);
  };

  /**
   * Што прави: Излегува од играта предвреме
   * Параметри: нема
   * Враќа: ништо
   */
  window.tfExit = function() { clearInterval(timerInterval); showHub(); };

  // Започни ја играта
  questions = buildQuestions();
  renderQuestion();
}
