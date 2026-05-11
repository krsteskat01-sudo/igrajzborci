// ── features.js — Дополнителни интерактивни UI опции ─────────────────
// Ги менува глобалните функции БЕЗ да ги менува оригиналните фајлови.
// Користи: currentUser, db, ZBOROVI, loadCategory, showHub, syncScore, initQuiz

// ── Зачувани податоци за опциите ────────────────────────────────────────
let _streakDays              = 0; // Денови по ред
let _totalScore              = 0; // Вкупни поени
let _achievements            = {}; // Освоени значки
let _isDailyChallengeComplete = false; // Дали е решен зборот на денот

// ── Помошни функции ────────────────────────────────────────────────────

/**
 * Што прави: Враќа денешен датум во формат YYYY-MM-DD
 * Параметри: нема
 * Враќа: стринг
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Што прави: Избира еден збор на денот (ист за сите играчи на тој ден)
 * Параметри: нема
 * Враќа: објект (збор од базата)
 */
function getDailyWord() {
  const dailyWordIndex = Math.floor(Date.now() / 86400000) % ZBOROVI.length;
  return ZBOROVI[dailyWordIndex];
}

// ── Вчитување на податоци ────────────────────────────────────────────────────

/**
 * Што прави: Ги вчитува податоците (значки, денови) од базата при отворање на менито
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function loadFeaturesData() {
  if (!currentUser || typeof db === 'undefined') return;
  try {
    const snap = await db.collection('users').doc(currentUser.uid).get();
    if (!snap.exists) return;
    const userData = snap.data();
    _streakDays              = userData.streak       || 0;
    _totalScore              = userData.score        || 0;
    _achievements            = userData.achievements || {};
    _isDailyChallengeComplete = ((userData.dailyChallenge || {})[todayStr()]) === true;
  } catch (err) {
    console.warn('[Features] Грешка при вчитување:', err.code || err.message);
  }
}

// ── Денови по ред (Streak) ────────────────────────────────────────────────────

/**
 * Што прави: Го ажурира бројот на денови по ред што играчот играл
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function updateStreak() {
  if (!currentUser || typeof db === 'undefined') return;
  try {
    const ref  = db.collection('users').doc(currentUser.uid);
    const snap = await ref.get();
    if (!snap.exists) return;
    const userData         = snap.data();
    const today     = todayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastDate  = userData.lastPlayDate || '';
    if (lastDate === today) return; // Веќе е изброено денес

    // Ако играл вчера, зголеми за 1, инаку почни од почеток (1)
    const newStreak = lastDate === yesterday ? (userData.streak || 0) + 1 : 1;
    await ref.update({ streak: newStreak, lastPlayDate: today });
    _streakDays = newStreak;
  } catch (err) {
    console.warn('[Features] Грешка при ажурирање денови:', err.code || err.message);
  }
}

// ── Проверка за значки ────────────────────────────────────────────────────

/**
 * Што прави: Проверува дали се исполнети услови за некоја нова значка по секоја игра
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function checkAchievements() {
  if (!currentUser || typeof db === 'undefined') return;
  try {
    const ref  = db.collection('users').doc(currentUser.uid);
    const snap = await ref.get();
    if (!snap.exists) return;
    const userData   = snap.data();
    const achievements = userData.achievements || {};
    const highestScore = Math.max(userData.best_match || 0, userData.best_truefalse || 0, userData.best_hangman || 0, userData.best_quiz || 0);
    const updates = {};

    const totalScore   = userData.score || 0;
    const allGameBest  = Math.max(
      userData.best_match || 0, userData.best_truefalse || 0,
      userData.best_hangman || 0, userData.best_quiz || 0,
      userData.best_speedround || 0
    );
    const premiumBest  = Math.max(
      userData.best_wordbuilder || 0, userData.best_memoryflip || 0, userData.best_fasttyping || 0
    );
    const mainGamesPlayed = [
      userData.best_match, userData.best_truefalse, userData.best_hangman,
      userData.best_quiz, userData.best_speedround
    ].filter(v => (v || 0) > 0).length;

    // Услови за значки
    if (!achievements.prv_zbor        && totalScore > 0)                       updates['achievements.prv_zbor']        = true;
    if (!achievements.sto_poeni       && totalScore >= 100)                    updates['achievements.sto_poeni']       = true;
    if (!achievements.streak7         && _streakDays >= 7)                     updates['achievements.streak7']         = true;
    if (!achievements.majstor         && totalScore >= 500)                    updates['achievements.majstor']         = true;
    if (!achievements.sovrsheno       && highestScore >= 80)                   updates['achievements.sovrsheno']       = true;
    if (!achievements.hiljada         && totalScore >= 1000)                   updates['achievements.hiljada']         = true;
    if (!achievements.brzac           && (userData.best_speedround || 0) >= 50) updates['achievements.brzac']          = true;
    if (!achievements.mesec           && _streakDays >= 30)                    updates['achievements.mesec']           = true;
    if (!achievements.pet_igri        && mainGamesPlayed >= 5)                 updates['achievements.pet_igri']        = true;
    if (!achievements.premium_igrach  && premiumBest > 0)                      updates['achievements.premium_igrach'] = true;
    if (!achievements.virtuoz         && allGameBest >= 200)                   updates['achievements.virtuoz']         = true;

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
      Object.keys(updates).forEach(achievementKey => {
        _achievements[achievementKey.replace('achievements.', '')] = true;
      });
    }
  } catch (err) {
    console.warn('[Features] Грешка при проверка значки:', err.code || err.message);
  }
}

// ── Monkey Patching (Замена на оригиналните функции) ───────────────────

const _baseSyncScore = syncScore;

/**
 * Што прави: Го заменува оригиналното зачувување поени за да додаде проверка на значки
 * Параметри: game (стринг), score (број)
 * Враќа: ништо (асинхрона функција)
 */
window.syncScore = async function(game, score) {
  await _baseSyncScore(game, score);
  if (currentUser) {
    await updateStreak();
    await checkAchievements();
  }
};

const _baseShowHub = showHub;

/**
 * Што прави: Го отвора главното мени и додава нови UI елементи
 * Параметри: нема
 * Враќа: ништо
 */
window.showHub = function() {
  _baseShowHub();          // оригинално цртање
  _fixEmptyState();        // синхрона поправка на текстот
  loadFeaturesData().then(() => {
    injectStreakBar();
    injectDailyChallenge();
    injectAchievements();
    addAnimatedBackground();
  });
};

// Додаваме скокачко балонче за интересни факти на секоја игра
['initMatch', 'initTrueFalse', 'initHangman', 'initQuiz'].forEach(functionName => {
  const originalFunction = window[functionName];
  if (!originalFunction) return;
  window[functionName] = function(...args) { originalFunction(...args); addFunFactsBubble(); };
});

// Отстрани го балончето кога ќе се прикаже резултатот
const _baseShowResult = showResult;
window.showResult = function(score, game) {
  removeFunFactsBubble();
  _baseShowResult(score, game);
};

// ═══════════════════════════════════════════════════════════════
// ФИЧУР 1 — Збор на денот (Дневен предизвик)
// ═══════════════════════════════════════════════════════════════

/**
 * Што прави: Ја вметнува картичката за Збор на денот на главниот екран
 * Параметри: нема
 * Враќа: ништо
 */
function injectDailyChallenge() {
  if (document.querySelector('.daily-challenge-card')) return;
  const hubSub = document.querySelector('.hub-sub');
  if (!hubSub) return;

  const dailyWord    = getDailyWord();
  const done = _isDailyChallengeComplete;
  const card = document.createElement('div');
  card.className = 'daily-challenge-card' + (done ? ' daily-done' : '');
  card.innerHTML = `
    <!-- НОВО: Дневен предизвик -->
    <div class="daily-label"><span class="dc-star">*</span> Збор на денот</div>
    <div class="daily-word">${dailyWord.zbor}</div>
    <div class="daily-def">${dailyWord.definicija}</div>
    ${done
      ? '<div class="daily-badge">✓ Решено денес!</div>'
      : '<button class="daily-btn" onclick="startDailyChallenge()">Погоди →</button>'}`;
  hubSub.insertAdjacentElement('afterend', card);
}

/**
 * Што прави: Ја започнува играта за дневен предизвик и го бележи како решен
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.startDailyChallenge = async function() {
  if (currentUser && typeof db !== 'undefined') {
    try {
      await db.collection('users').doc(currentUser.uid)
        .set({ dailyChallenge: { [todayStr()]: true } }, { merge: true });
      _isDailyChallengeComplete = true;
    } catch (err) {
      console.warn('[Features] Грешка дневен предизвик:', err.message);
    }
  }
  initQuiz(loadCategory());
};

// ═══════════════════════════════════════════════════════════════
// ФИЧУР 2 — Лента за Денови по ред и Поени
// ═══════════════════════════════════════════════════════════════

/**
 * Што прави: Ја црта лентата со поени под аватарот на играчот
 * Параметри: нема
 * Враќа: ништо
 */
function injectStreakBar() {
  if (document.querySelector('.streak-bar')) return;
  const hubPlayer = document.querySelector('.hub-player');
  if (!hubPlayer) return;

  const bar = document.createElement('div');
  bar.className = 'streak-bar';
  bar.innerHTML = `
    <!-- НОВО: Лента со поени -->
    <span class="sb-item">🔥 <strong id="feat-streak">0</strong> дена по ред</span>
    <span class="sb-sep">·</span>
    <span class="sb-item">⭐ <strong id="feat-score">0</strong> поени</span>`;
  hubPlayer.insertAdjacentElement('afterend', bar);

  countUp('feat-streak', _streakDays, 500);
  countUp('feat-score',  _totalScore,  500);
}

/**
 * Што прави: Прави анимација на броење нагоре за поените
 * Параметри: id (ID на елементот), target (до кој број), duration (траење)
 * Враќа: ништо
 */
function countUp(id, target, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  if (target === 0) { el.textContent = '0'; return; }
  const step = target / (duration / 16);
  let currentCount = 0;
  const countUpTimer = setInterval(() => {
    currentCount = Math.min(currentCount + step, target);
    el.textContent = Math.round(currentCount);
    if (currentCount >= target) clearInterval(countUpTimer);
  }, 16);
}

// ═══════════════════════════════════════════════════════════════
// ФИЧУР 3 — Лебдечко балонче со Интересни Факти
// ═══════════════════════════════════════════════════════════════

const FUN_FACTS = [
  'Зборци е прва асоцијација во Македонија која создава нови зборови за современи поими.',
  '„Риломанија" е нов македонски збор за зависност од кратки видеа на социјалните мрежи.',
  '„Каспероса" опишува прекинување на врска со ненадејно и молчешкото повлекување.',
  '„Деносонува" значи будно сонување и лесно навлегување во сопствената мечта.',
  'Зборцата збирка расте секоја недела со нови предлози од заедницата.',
];

/**
 * Што прави: Додава копче за интересни факти додека се игра
 * Параметри: нема
 * Враќа: ништо
 */
function addFunFactsBubble() {
  if (document.querySelector('.fun-facts-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'fun-facts-btn';
  btn.setAttribute('aria-label', 'Интересни факти');
  btn.innerHTML = '💬';
  btn.onclick = window.toggleFunFacts;
  document.body.appendChild(btn);
}

/**
 * Што прави: Го отстранува копчето за факти
 * Параметри: нема
 * Враќа: ништо
 */
function removeFunFactsBubble() {
  document.querySelector('.fun-facts-btn')?.remove();
  document.querySelector('.fun-facts-popup')?.remove();
}

/**
 * Што прави: Го отвора или затвора балончето со случаен факт
 * Параметри: нема
 * Враќа: ништо
 */
window.toggleFunFacts = function() {
  const existing = document.querySelector('.fun-facts-popup');
  if (existing) {
    existing.classList.remove('ff-open');
    setTimeout(() => existing.remove(), 250);
    return;
  }
  const selectedFact  = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  const popup = document.createElement('div');
  popup.className = 'fun-facts-popup';
  popup.innerHTML = `
    <!-- НОВО: Балонче со факти -->
    <button class="ff-close" onclick="window.toggleFunFacts()">✕</button>
    <div class="ff-title">✦ Знаеше ли?</div>
    <p class="ff-text">${selectedFact}</p>`;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add('ff-open'), 10);

  // Затвори кога ќе кликнеш надвор
  const handler = (e) => {
    const popup = document.querySelector('.fun-facts-popup');
    const button = document.querySelector('.fun-facts-btn');
    if (!popup) { document.removeEventListener('click', handler); return; }
    if (!popup.contains(e.target) && !(button && button.contains(e.target))) {
      popup.classList.remove('ff-open');
      setTimeout(() => { popup.remove(); document.removeEventListener('click', handler); }, 250);
    }
  };
  setTimeout(() => document.addEventListener('click', handler), 80);
};

// ═══════════════════════════════════════════════════════════════
// ФИЧУР 4 — Значки (Достигнувања)
// ═══════════════════════════════════════════════════════════════

const BADGES = [
  { key: 'prv_zbor',       icon: '🏅', label: 'Прв збор',    tip: 'Одиграј ја прва игра' },
  { key: 'sto_poeni',      icon: '⭐', label: '100 поени',    tip: 'Освои 100 вкупни поени' },
  { key: 'streak7',        icon: '🔥', label: '7 дена',       tip: '7 дена по ред' },
  { key: 'sovrsheno',      icon: '🎯', label: 'Совршено',     tip: 'Освои 80+ поени во игра' },
  { key: 'majstor',        icon: '🧠', label: 'Мајстор',      tip: 'Освои 500 вкупни поени' },
  { key: 'hiljada',        icon: '🏆', label: '1000 поени',   tip: 'Освои 1000 вкупни поени' },
  { key: 'brzac',          icon: '⚡', label: 'Брзак',         tip: 'Освои 50+ поени во Брза Рунда' },
  { key: 'pet_igri',       icon: '🎮', label: 'Мултиплеер',   tip: 'Одиграј ги сите 5 основни игри' },
  { key: 'premium_igrach', icon: '💎', label: 'Премиум',      tip: 'Одиграј напредна отклучена игра' },
  { key: 'virtuoz',        icon: '🌟', label: 'Виртуоз',      tip: 'Освои 200+ поени во една игра' },
  { key: 'mesec',          icon: '🌙', label: 'Месечар',       tip: '30 дена стрик по ред' },
];

/**
 * Што прави: Ги исцртува значките на главното мени
 * Параметри: нема
 * Враќа: ништо
 */
function injectAchievements() {
  if (document.querySelector('.achievements-section')) return;
  const hubFooter = document.querySelector('.hub-footer');
  if (!hubFooter) return;

  const badgesHtml = BADGES.map(badge => {
    const unlocked = !!_achievements[badge.key];
    return `
      <div class="badge-card ${unlocked ? 'badge-unlocked' : 'badge-locked'}"
           onclick="showBadgeTip('${badge.tip}')">
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-name">${badge.label}</div>
        ${unlocked ? '' : '<div class="badge-lock">🔒</div>'}
      </div>`;
  }).join('');

  const section = document.createElement('section');
  section.className = 'achievements-section';
  section.innerHTML = `
    <!-- НОВО: Значки -->
    <button class="ach-toggle" onclick="toggleAchievements()">
      <span class="star-accent">*</span> Достигнувања
      <span id="ach-chevron" class="ach-chev">▾</span>
    </button>
    <div class="badges-row" id="badges-row">${badgesHtml}</div>`;
  hubFooter.insertAdjacentElement('beforebegin', section);
}

/**
 * Што прави: Ги отвора/затвора значките
 * Параметри: нема
 * Враќа: ништо
 */
window.toggleAchievements = function() {
  const row  = document.getElementById('badges-row');
  const chevronIcon = document.getElementById('ach-chevron');
  if (!row) return;
  const open = row.style.display !== 'none';
  row.style.display = open ? 'none' : 'flex';
  if (chevronIcon) chevronIcon.textContent = open ? '▸' : '▾';
};

/**
 * Што прави: Прикажува совет за kako да се освои значка
 * Параметри: tip (стринг)
 * Враќа: ништо
 */
window.showBadgeTip = function(tip) {
  let toastElement = document.querySelector('.badge-toast');
  if (toastElement) toastElement.remove();
  toastElement = document.createElement('div');
  toastElement.className = 'badge-toast';
  toastElement.textContent = tip;
  document.body.appendChild(toastElement);
  setTimeout(() => toastElement.classList.add('bt-show'), 10);
  setTimeout(() => { toastElement.classList.remove('bt-show'); setTimeout(() => toastElement.remove(), 300); }, 2600);
};

// ═══════════════════════════════════════════════════════════════
// ФИЧУР 5 — Анимирана позадина (Само на главното мени)
// ═══════════════════════════════════════════════════════════════

/**
 * Што прави: Додава форми кои се движат во позадината
 * Параметри: нема
 * Враќа: ништо
 */
function addAnimatedBackground() {
  if (document.querySelector('.animated-bg')) return;
  const hub = document.querySelector('.hub');
  if (!hub) return;

  const bg = document.createElement('div');
  bg.className  = 'animated-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = `
    <!-- НОВО: Анимирана позадина -->
    <span class="bg-shape bg-circle" style="--sz:110px;--x:8%;--y:12%;--dur:28s;--delay:0s"></span>
    <span class="bg-shape bg-star"   style="--sz:36px;--x:82%;--y:18%;--dur:35s;--delay:-8s">*</span>
    <span class="bg-shape bg-circle" style="--sz:50px;--x:88%;--y:42%;--dur:32s;--delay:-3s"></span>
    <span class="bg-shape bg-star"   style="--sz:44px;--x:45%;--y:30%;--dur:38s;--delay:-20s">*</span>`;
  hub.appendChild(bg);
}

// ═══════════════════════════════════════════════════════════════
// ФИЧУР 7 — Поправка на празен текст
// ═══════════════════════════════════════════════════════════════

/**
 * Што прави: Го заменува текстот "нема рекорд" со попријатен текст
 * Параметри: нема
 * Враќа: ништо
 */
function _fixEmptyState() {
  document.querySelectorAll('.game-best').forEach(gameScoreElement => {
    if (gameScoreElement.textContent.includes('нема рекорд')) {
      gameScoreElement.innerHTML = '<span class="empty-cta">🚀 Ајде, започни!</span>';
    }
  });
}
