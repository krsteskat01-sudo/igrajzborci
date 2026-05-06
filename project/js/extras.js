// ── extras.js ── Дополнителни функционалности ───────────────────────────────────────────────
// Додава нови опции без да ги менува оригиналните фајлови преку "monkey-patching".
// Мора да се вчита ПОСЛЕДЕН (по features.js).

// ── Локална состојба ──────────────────────────────────────────────────────
let _savedWords = []; // Зачувани зборови
let _mistakes   = []; // Направени грешки

// ── Тежина на игра ─────────────────────────────────────────────────

/**
 * Што прави: Вчитува избрана тежина (лесно, нормално, тешко)
 * Параметри: нема
 * Враќа: стринг (тежина)
 */
function loadDifficulty()    { return localStorage.getItem('zb_difficulty') || 'normal'; }

/**
 * Што прави: Зачувува тежина локално
 * Параметри: d (стринг)
 * Враќа: ништо
 */
function saveDifficulty(d)   { localStorage.setItem('zb_difficulty', d); }

// Ги пресретнуваме оригиналните функции за да додадеме филтер по тежина
const _originalGetWordPool = getWordPool;

/**
 * Што прави: Враќа зборови според избраната категорија и тежина
 * Параметри: category (стринг)
 * Враќа: низа со објекти (зборови)
 */
window.getWordPool = function(category) {
  const baseWordPool = _originalGetWordPool(category);
  const difficultyLevel = loadDifficulty();
  // Ако е лесно, дај ги само лесните (тежина 1)
  if (difficultyLevel === 'easy') { const easyWords = baseWordPool.filter(w => w.težina === 1); return easyWords.length >= 4 ? easyWords : baseWordPool; }
  // Ако е тешко, дај ги сите зборови од базата без филтер
  if (difficultyLevel === 'hard') return ZBOROVI;
  return baseWordPool; // нормално
};

/**
 * Што прави: Менува тежина и го ажурира визуелниот изглед на копчињата
 * Параметри: d (стринг)
 * Враќа: ништо
 */
window.extSetDifficulty = function(d) {
  saveDifficulty(d);
  document.querySelectorAll('.diff-btn').forEach(difficultyButton => {
    const map = { easy: 'Лесно', normal: 'Нормално', hard: 'Тешко' };
    difficultyButton.classList.toggle('diff-active', difficultyButton.textContent.trim() === map[d]);
  });
};

// ── Кука за одговор на прашање ────────────────────────────────────────
// Игрите го повикуваат ова по секој одговор: onWordAnswered(zbor, def, isCorrect, wordData)

/**
 * Што прави: Ги бележи грешките по секој одговор
 * Параметри: zbor (стринг), def (стринг), isCorrect (булова вредност), wordData (објект)
 * Враќа: ништо
 */
window.onWordAnswered = function(wordText, definition, isCorrect, wordData) {
  if (!isCorrect) _extTrackMistake(wordText, definition);
};

// ── Колекција на зборови ────────────────────────────────────────────

/**
 * Што прави: Додава збор во колекцијата на зачувани зборови
 * Параметри: zbor (стринг)
 * Враќа: ништо
 */
window.extSaveWord = function(wordText) {
  if (_savedWords.some(savedWord => savedWord.zbor === wordText)) return;
  const wd = ZBOROVI.find(savedWord => savedWord.zbor === wordText);
  if (!wd) return;
  _savedWords.push({ zbor: wd.zbor, def: wd.definicija, fact: wd.fact || '' });

  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .set({ savedWords: firebase.firestore.FieldValue.arrayUnion(wordText) }, { merge: true })
      .catch(() => {});
  }
  _extToast('💾 Зборот е зачуван!');
};

/**
 * Што прави: Го прикажува екранот со зачувани зборови
 * Параметри: нема
 * Враќа: ништо
 */
window.showCollection = function() {
  document.body.className = getThemeClass(loadCategory());
  if (_savedWords.length === 0) {
    showScreen(`<div class="game-wrap"><div class="score-bar">
      <button class="exit-btn" onclick="showHub()">✕</button>
      <span class="bar-title">💾 Мои Зборови</span>
    </div><div class="collection-empty">
      <div class="ce-icon">📚</div>
      <p>Нема зачувани зборови.<br>Играј и зачувај ги интересните!</p>
    </div></div>`);
    return;
  }
  const html = _savedWords.map(savedWord => `
    <div class="collection-item">
      <div class="ci-word">${escHtml(savedWord.zbor)}</div>
      <div class="ci-def">${escHtml(savedWord.def)}</div>
      ${savedWord.fact ? `<div class="ci-fact">✦ ${escHtml(savedWord.fact)}</div>` : ''}
      <button class="ci-remove" onclick="extRemoveWord('${savedWord.zbor.replace(/'/g,"\\'")}')">✕</button>
    </div>`).join('');
  showScreen(`<div class="game-wrap"><div class="score-bar">
    <button class="exit-btn" onclick="showHub()">✕</button>
    <span class="bar-title">💾 Мои Зборови</span>
    <span class="bar-stat">${_savedWords.length} зборови</span>
  </div><div class="collection-list">${html}</div></div>`);
};

/**
 * Што прави: Брише збор од колекцијата
 * Параметри: zbor (стринг)
 * Враќа: ништо
 */
window.extRemoveWord = function(wordText) {
  _savedWords = _savedWords.filter(savedWord => savedWord.zbor !== wordText);
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .set({ savedWords: firebase.firestore.FieldValue.arrayRemove(wordText) }, { merge: true })
      .catch(() => {});
  }
  window.showCollection();
};

/**
 * Што прави: Ги вчитува зачуваните зборови од базата
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function _extLoadSavedWords() {
  if (!currentUser || typeof db === 'undefined') return;
  try {
    const firestoreSnapshot = await db.collection('users').doc(currentUser.uid).get();
    if (!firestoreSnapshot.exists) return;
    _savedWords = (firestoreSnapshot.data().savedWords || [])
      .map(savedWordId => ZBOROVI.find(wordEntry => wordEntry.zbor === savedWordId)).filter(Boolean)
      .map(wordEntry => ({ zbor: wordEntry.zbor, def: wordEntry.definicija, fact: wordEntry.fact || '' }));
  } catch (e) {}
}

// ── Листа на грешки ──────────────────────────────────────────────

/**
 * Што прави: Бележи погрешно одговорен збор
 * Параметри: zbor (стринг), def (стринг)
 * Враќа: ништо
 */
function _extTrackMistake(wordText, definition) {
  if (_mistakes.some(mistake => mistake.zbor === wordText)) return;
  _mistakes.unshift({ zbor: wordText, def: definition }); // Додај на почеток
  if (_mistakes.length > 30) _mistakes.pop(); // Чувај само последните 30

  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .set({ mistakes: _mistakes.slice(0, 20).map(mistake => ({ zbor: mistake.zbor, def: mistake.def })) }, { merge: true })
      .catch(() => {});
  }
}

/**
 * Што прави: Го прикажува екранот со грешки
 * Параметри: нема
 * Враќа: ништо
 */
window.showMistakes = function() {
  document.body.className = getThemeClass(loadCategory());
  if (_mistakes.length === 0) {
    showScreen(`<div class="game-wrap"><div class="score-bar">
      <button class="exit-btn" onclick="showHub()">✕</button>
      <span class="bar-title">✗ Грешки</span>
    </div><div class="collection-empty">
      <div class="ce-icon">🎯</div>
      <p>Нема грешки — одлично! 🎉</p>
    </div></div>`);
    return;
  }
  const html = _mistakes.map(mistake => `
    <div class="collection-item mistakes-item">
      <div class="ci-word">${escHtml(mistake.zbor)}</div>
      <div class="ci-def">${escHtml(mistake.def)}</div>
    </div>`).join('');
  showScreen(`<div class="game-wrap"><div class="score-bar">
    <button class="exit-btn" onclick="showHub()">✕</button>
    <span class="bar-title">✗ Грешки</span>
    <span class="bar-stat">${_mistakes.length}</span>
  </div><div class="collection-list">${html}</div></div>`);
};

/**
 * Што прави: Ги вчитува грешките од базата
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function _extLoadMistakes() {
  if (!currentUser || typeof db === 'undefined') return;
  try {
    const firestoreSnapshot = await db.collection('users').doc(currentUser.uid).get();
    if (!firestoreSnapshot.exists) return;
    _mistakes = (firestoreSnapshot.data().mistakes || []).map(mistake => ({ zbor: mistake.zbor, def: mistake.def }));
  } catch (e) {}
}

// ── Екран за статистики ─────────────────────────────────────────────────

/**
 * Што прави: Прикажува детален профил и статистики за корисникот
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.showStats = async function() {
  document.body.className = getThemeClass(loadCategory());
  showScreen(`<div class="game-wrap"><div class="score-bar">
    <button class="exit-btn" onclick="showHub()">✕</button>
    <span class="bar-title">📊 Статистики</span>
  </div><div class="lb-loading">⏳ Се вчитува...</div></div>`);
  let userData = {};
  if (currentUser && typeof db !== 'undefined') {
    try { const userSnapshot = await db.collection('users').doc(currentUser.uid).get(); if (userSnapshot.exists) userData = userSnapshot.data(); }
    catch (e) {}
  }
  document.getElementById('app').innerHTML = `
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="showHub()">✕</button>
        <span class="bar-title">📊 Статистики</span>
      </div>
      <div class="stats-screen">
        <div class="stats-profile">
          ${playerAvatarHtml(loadPlayerName(), loadAvatarId(), 64)}
          <div class="stats-profile-name">${escHtml(loadPlayerName() || '')}</div>
        </div>
        <div class="stats-grid">
          <div class="stat-box stat-primary"><div class="sb-val">${userData.score||0}</div><div class="sb-label">Вкупно поени</div></div>
          <div class="stat-box"><div class="sb-val">${userData.streak||0}</div><div class="sb-label">🔥 Денови по ред</div></div>
          <div class="stat-box"><div class="sb-val">${Math.max(userData.best_match||0,userData.best_truefalse||0,userData.best_hangman||0,userData.best_quiz||0,userData.best_speedround||0)}</div><div class="sb-label">⭐ Најдобар резултат</div></div>
          <div class="stat-box"><div class="sb-val">${(userData.savedWords||[]).length}</div><div class="sb-label">💾 Зачувани зборови</div></div>
        </div>
        <div class="stats-section-title">Рекорди по игра</div>
        <div class="stats-grid">
          <div class="stat-box"><div class="sb-val">${userData.best_match||0}</div><div class="sb-label">🔗 Спој</div></div>
          <div class="stat-box"><div class="sb-val">${userData.best_truefalse||0}</div><div class="sb-label">✓✗ Точно/Неточно</div></div>
          <div class="stat-box"><div class="sb-val">${userData.best_hangman||0}</div><div class="sb-label">⭐ Збор по збор</div></div>
          <div class="stat-box"><div class="sb-val">${userData.best_quiz||0}</div><div class="sb-label">❓ Кој збор</div></div>
          <div class="stat-box"><div class="sb-val">${userData.best_speedround||0}</div><div class="sb-label">⚡ Брза Рунда</div></div>
          <div class="stat-box"><div class="sb-val">${(userData.mistakes||[]).length}</div><div class="sb-label">✗ Грешки</div></div>
        </div>
        <div class="stats-section-title">Напредни игри</div>
        <div class="stats-grid">
          <div class="stat-box"><div class="sb-val">${userData.best_wordbuilder||0}</div><div class="sb-label">🧩 Word Builder</div></div>
          <div class="stat-box"><div class="sb-val">${userData.best_memoryflip||0}</div><div class="sb-label">🃏 Memory Flip</div></div>
          <div class="stat-box"><div class="sb-val">${userData.best_fasttyping||0}</div><div class="sb-label">⌨️ Fast Typing</div></div>
        </div>
      </div>
    </div>`;
};

// ── Неделна табела ─────────────────────────────────────────

/**
 * Што прави: Враќа датум на почетокот на тековната недела (понеделник)
 * Параметри: нема
 * Враќа: стринг (YYYY-MM-DD)
 */
function _extGetWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // пресметај разлика до понеделник
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() + daysUntilMonday);
  return mondayDate.toISOString().split('T')[0];
}

/**
 * Што прави: Додава поени на неделниот резултат
 * Параметри: uid (стринг - ID на корисник), gameScore (број)
 * Враќа: ништо (асинхрона функција)
 */
async function _extUpdateWeeklyScore(uid, gameScore) {
  if (!uid || typeof db === 'undefined') return;
  const weekStart = _extGetWeekStart();
  const userDocRef = db.collection('users').doc(uid);
  try {
    // Користи трансакција за безбедно ажурирање
    await db.runTransaction(async t => {
      const userDoc = await t.get(userDocRef);
      const userData = userDoc.exists ? userDoc.data() : {};
      if ((userData.weeklyResetDate || '') !== weekStart) {
        // Ресетирај за нова недела
        t.set(userDocRef, { weeklyScore: gameScore, weeklyResetDate: weekStart }, { merge: true });
      } else {
        // Додај на постоечка недела
        t.update(userDocRef, { weeklyScore: firebase.firestore.FieldValue.increment(gameScore) });
      }
    });
  } catch (e) { console.warn('[Extras] Weekly score:', e.message); }
}

const _tabDefinitions = [
  { key: 'score',            label: 'Вкупно',  icon: '🏆' },
  { key: 'best_match',       label: 'Спој',    icon: '🔗' },
  { key: 'best_truefalse',   label: 'Т/Н',     icon: '✓✗' },
  { key: 'best_hangman',     label: 'Збор',    icon: '⭐' },
  { key: 'best_quiz',        label: 'Кој',     icon: '❓' },
  { key: 'best_speedround',  label: 'Брза',    icon: '⚡' },
  { key: 'best_wordbuilder', label: 'Builder', icon: '🧩' },
  { key: 'best_memoryflip',  label: 'Flip',    icon: '🃏' },
  { key: 'best_fasttyping',  label: 'Typing',  icon: '⌨️' },
  { key: 'weeklyScore',      label: 'Недела',  icon: '📅' },
];

/**
 * Што прави: Го црта јазичето за неделната табела
 * Параметри: нема
 * Враќа: ништо
 */
function _extRenderWeeklyTab() {
  const weekStart   = _extGetWeekStart();
  const weekPlayers = [..._lbPlayers]
    .filter(player => player.weeklyResetDate === weekStart && (player.weeklyScore || 0) > 0)
    .sort((a, b) => (b.weeklyScore || 0) - (a.weeklyScore || 0));
  const topPlayers  = weekPlayers.slice(0, 20);
  const currentUserId  = currentUser ? currentUser.uid : null;
  const currentUserIndex  = currentUserId ? weekPlayers.findIndex(player => player.id === currentUserId) : -1;
  const rankLabel = rankIndex => rankIndex === 0 ? '👑' : rankIndex === 1 ? '🥈' : rankIndex === 2 ? '🥉' : `#${rankIndex+1}`;

  const rowsHtml = topPlayers.length === 0
    ? '<div class="lb-empty">Нема резултати оваа недела 🗓</div>'
    : topPlayers.map((player, rankIndex) =>
        typeof _lbBuildRow === 'function'
          ? _lbBuildRow(player, rankIndex, currentUserId, 'weeklyScore')
          : `<div class="lb-row">
               <span class="lb-rank">${rankLabel(rankIndex)}</span>
               ${playerAvatarHtml(player.displayName, player.avatarId, 30)}
               <span class="lb-name">${escHtml(player.displayName||'')}</span>
               <span class="lb-pts">${player.weeklyScore||0}</span>
             </div>`
      ).join('');
  let myRankHtml = '';
  if (currentUserId && currentUserIndex === -1) myRankHtml = '<div class="lb-my-rank">🎮 Играј оваа недела за да влезеш!</div>';
  else if (currentUserId && currentUserIndex + 1 > 20) myRankHtml = `<div class="lb-my-rank">📍 Ти си #${currentUserIndex+1} — продолжи!</div>`;

  const tabsHtml = _tabDefinitions.map(tabDefinition =>
    `<button class="lb-tab${_lbTab===tabDefinition.key?' lb-tab-active':''}" onclick="lbSwitchTab('${tabDefinition.key}')">${tabDefinition.icon} ${tabDefinition.label}</button>`
  ).join('');

  document.body.className = getThemeClass(loadCategory());
  document.getElementById('app').innerHTML = `
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="showHub()">✕</button>
        <span class="bar-title">🏆 Топ 20 Играчи</span>
        <span class="bar-stat">${weekPlayers.length} оваа недела</span>
      </div>
      <div class="lb-wrap">
        <div class="lb-tabs">${tabsHtml}</div>
        <div class="lb-list">${rowsHtml}${myRankHtml}</div>
      </div>
    </div>`;
}

// ── Ажурирање на табелата (monkey patch) ───────────────────────────────────
const _originalRenderLeaderboard = renderLeaderboard;

/**
 * Што прави: Ги црта новите јазичиња (Брза рунда, Недела) во табелата
 * Параметри: нема
 * Враќа: ништо
 */
window.renderLeaderboard = function() {
  if (_lbTab === 'weeklyScore') {
    _extRenderWeeklyTab();
  } else {
    _originalRenderLeaderboard();
    // Вметни ги новите јазичиња откако ќе се исцрта основата
    const tabsEl = document.querySelector('.lb-tabs');
    if (tabsEl && !tabsEl.querySelector('[data-ext-tab]')) {
      const extraTabKeys = ['best_speedround','best_wordbuilder','best_memoryflip','best_fasttyping','weeklyScore'];
      if (extraTabKeys.includes(_lbTab)) {
        tabsEl.querySelectorAll('.lb-tab-active').forEach(button => button.classList.remove('lb-tab-active'));
      }
      [
        { key:'best_speedround',  label:'Брза',    icon:'⚡' },
        { key:'best_wordbuilder', label:'Builder', icon:'🧩' },
        { key:'best_memoryflip',  label:'Flip',    icon:'🃏' },
        { key:'best_fasttyping',  label:'Typing',  icon:'⌨️' },
        { key:'weeklyScore',      label:'Недела',  icon:'📅' },
      ]
        .forEach(tabDefinition => {
          const button = document.createElement('button');
          button.className = 'lb-tab' + (_lbTab === tabDefinition.key ? ' lb-tab-active' : '');
          button.setAttribute('data-ext-tab', tabDefinition.key);
          button.onclick = () => lbSwitchTab(tabDefinition.key);
          button.textContent = tabDefinition.icon + ' ' + tabDefinition.label;
          tabsEl.appendChild(button);
        });
    }
  }
};

// ── Форма за предлози ────────────────────────────────────────────

/**
 * Што прави: Го прикажува екранот за предлагање нови зборови
 * Параметри: нема
 * Враќа: ништо
 */
window.showSuggestionForm = function() {
  document.body.className = getThemeClass(loadCategory());
  showScreen(`
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="showHub()">✕</button>
        <span class="bar-title">* Предложи Збор</span>
      </div>
      <div class="suggestion-screen">
        <p class="suggestion-intro">Знаеш некој нов збор? Предложи го!</p>
        <div class="suggestion-form">
          <input type="text" id="sug-zbor" class="name-input" placeholder="Зборот..." maxlength="40" autocomplete="off">
          <textarea id="sug-def" class="suggestion-textarea" placeholder="Дефиниција..." maxlength="200"></textarea>
          <textarea id="sug-fact" class="suggestion-textarea" placeholder="Интересен факт (незадолжително)..." maxlength="200"></textarea>
          <button class="btn-primary" id="sug-btn" onclick="extSubmitSuggestion()">Испрати →</button>
          <div id="sug-msg" class="game-msg"></div>
        </div>
      </div>
    </div>`);
  setTimeout(() => document.getElementById('sug-zbor')?.focus(), 80);
};

/**
 * Што прави: Испраќа предлог за збор во базата
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.extSubmitSuggestion = async function() {
  const wordText = (document.getElementById('sug-zbor')?.value || '').trim();
  const definition  = (document.getElementById('sug-def')?.value  || '').trim();
  const randomFact = (document.getElementById('sug-fact')?.value || '').trim();
  const feedbackMessage  = document.getElementById('sug-msg');
  const submitButton  = document.getElementById('sug-btn');

  if (!wordText || !definition) { if (feedbackMessage) feedbackMessage.innerHTML = '<span class="fb-wrong">Внеси збор и дефиниција.</span>'; return; }

  if (submitButton) { submitButton.disabled = true; submitButton.textContent = '⏳'; }
  try {
    if (typeof db !== 'undefined') {
      await db.collection('suggestions').add({
        zbor: wordText, def: definition, fact: randomFact || '',
        uid: currentUser ? currentUser.uid : 'anon',
        displayName: loadPlayerName() || 'Анонимно',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (feedbackMessage) feedbackMessage.innerHTML = '<span class="fb-correct">✓ Благодариме! Ќе го разгледаме.</span>';
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Испрати уште →'; }
    ['sug-zbor','sug-def','sug-fact'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    if (feedbackMessage) feedbackMessage.innerHTML = '<span class="fb-wrong">Грешка — обиди се пак.</span>';
    if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Испрати →'; }
  }
};

// ── Збор на неделата ───────────────────────────────────────────────

/**
 * Што прави: Вметнува картичка за "Збор на неделата" во менито
 * Параметри: нема
 * Враќа: ништо
 */
function _extInjectWordOfWeek() {
  if (document.querySelector('.wow-card')) return;
  const grid = document.querySelector('.games-grid');
  if (!grid) return;

  const currentDate = new Date();
  const yearStartDate = new Date(currentDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((currentDate - yearStartDate) / 86400000 + yearStartDate.getDay() + 1) / 7);
  const word = ZBOROVI[weekNumber % ZBOROVI.length];

  const card = document.createElement('div');
  card.className = 'wow-card';
  card.innerHTML = `
    <div class="wow-label">⭐ Збор на неделата</div>
    <div class="wow-word">${word.zbor}</div>
    <div class="wow-def">${word.definicija}</div>`;
  grid.insertAdjacentElement('beforebegin', card);
}

// ── Дополнителни копчиња ───────────────────────────────────────

/**
 * Што прави: Ги вметнува копчињата за додатни екрани (статистика, грешки...) во менито
 * Параметри: нема
 * Враќа: ништо
 */
function _extInjectHubButtons() {
  if (document.querySelector('.extras-btns')) return;
  const footer = document.querySelector('.hub-footer');
  if (!footer) return;
  const wrap = document.createElement('div');
  wrap.className = 'extras-btns';
  wrap.innerHTML = `
    <button class="extras-btn" onclick="showStats()">📊 Статистики</button>
    <button class="extras-btn" onclick="showCollection()">💾 Зачувани</button>
    <button class="extras-btn" onclick="showMistakes()">✗ Грешки</button>
    <button class="extras-btn" onclick="showSuggestionForm()">* Предложи</button>`;
  footer.insertAdjacentElement('beforebegin', wrap);
}

// ── Избирач на тежина ────────────────────────────────────────

/**
 * Што прави: Вметнува копчиња за избор на тежина под игрите
 * Параметри: нема
 * Враќа: ништо
 */
function _extInjectDifficulty() {
  if (document.querySelector('.difficulty-wrap')) return;
  const grid = document.querySelector('.games-grid');
  if (!grid) return;

  const curr = loadDifficulty();
  const wrap = document.createElement('div');
  wrap.className = 'difficulty-wrap';
  wrap.innerHTML = `
    <span class="diff-label">Тежина:</span>
    ${[['easy','Лесно'],['normal','Нормално'],['hard','Тешко']].map(([v,l]) =>
      `<button class="diff-btn${curr===v?' diff-active':''}" onclick="extSetDifficulty('${v}')">${l}</button>`
    ).join('')}`;
  grid.insertAdjacentElement('afterend', wrap);
}

// ── Известување за серија поени ─────────────────────────────────────────

const _originalUpdateStreak = updateStreak;

/**
 * Што прави: Ги ажурира деновите по ред и дава бонус поени
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.updateStreak = async function() {
  const previousStreak = _streakDays;
  await _originalUpdateStreak();
  if (_streakDays > previousStreak && _streakDays > 1) {
    _extStreakBonusToast(_streakDays);
    if (currentUser && typeof db !== 'undefined') {
      db.collection('users').doc(currentUser.uid)
        .update({ score: firebase.firestore.FieldValue.increment(20) })
        .catch(() => {});
    }
  }
};

/**
 * Што прави: Прикажува порака (toast) за освоени бонус поени од серија
 * Параметри: streak (број - колку денови по ред)
 * Враќа: ништо
 */
function _extStreakBonusToast(streak) {
  const toastElement = document.createElement('div');
  toastElement.className = 'streak-bonus-toast';
  toastElement.innerHTML = `🔥 ${streak} дена по ред! <strong>+20 бонус поени</strong>`;
  document.body.appendChild(toastElement);
  setTimeout(() => toastElement.classList.add('sbt-show'), 10);
  setTimeout(() => { toastElement.classList.remove('sbt-show'); setTimeout(() => toastElement.remove(), 400); }, 3200);
}

// ── Проверка за нови достигнувања ───────────────────────────────────

/**
 * Што прави: Проверува дали корисникот освоил некоја нова значка
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function _extCheckAchievements() {
  if (!currentUser || typeof db === 'undefined') return;
  try {
    const ref  = db.collection('users').doc(currentUser.uid);
    const snap = await ref.get();
    if (!snap.exists) return;
    const userData   = snap.data();
    const achievements = userData.achievements || {};
    const achievementUpdates = {};
    if (!achievements.kolekcioner && (userData.savedWords||[]).length >= 5)  achievementUpdates['achievements.kolekcioner'] = true;
    if (!achievements.brzinec     && (userData.best_speedround||0) > 0)      achievementUpdates['achievements.brzinec']     = true;
    if (!achievements.nedelen     && (userData.streak||0) >= 7)              achievementUpdates['achievements.nedelen']     = true;
    if (Object.keys(achievementUpdates).length > 0) await ref.update(achievementUpdates);
  } catch (e) {}
}

// ── Помошник за известувања (Toast) ───────────────────────────────────────────────

/**
 * Што прави: Прикажува мало скокачко известување
 * Параметри: msg (стринг - пораката)
 * Враќа: ништо
 */
function _extToast(msg) {
  let toastElement = document.querySelector('.badge-toast');
  if (toastElement) toastElement.remove();
  toastElement = document.createElement('div');
  toastElement.className = 'badge-toast';
  toastElement.textContent = msg;
  document.body.appendChild(toastElement);
  setTimeout(() => toastElement.classList.add('bt-show'), 10);
  setTimeout(() => { toastElement.classList.remove('bt-show'); setTimeout(() => toastElement.remove(), 300); }, 2200);
}

// ── Ажурирање на зачувувањето поени ────────────────────────────────────────────

const _originalSyncScore = syncScore;

/**
 * Што прави: Зачувува поени и истовремено проверува неделни поени и значки
 * Параметри: game (стринг), score (број)
 * Враќа: ништо (асинхрона функција)
 */
window.syncScore = async function(game, score) {
  await _originalSyncScore(game, score);
  if (currentUser) {
    await _extUpdateWeeklyScore(currentUser.uid, score);
    await _extCheckAchievements();
  }
};

// ── Ажурирање на менито (Hub) ──────────────────────────────────────────────

const _originalShowHub = showHub;

/**
 * Што прави: Го отвора главното мени и вметнува нови елементи (збор на недела, копчиња)
 * Параметри: нема
 * Враќа: ништо
 */
window.showHub = function() {
  _originalShowHub();
  _extLoadSavedWords().catch(() => {});
  _extLoadMistakes().catch(() => {});

  // Вметни додатни делови откако ќе се исцрта основата
  setTimeout(() => {
    _extInjectWordOfWeek();
    // _extInjectHubButtons(); // Отстрането по барање
    _extInjectDifficulty();
    // if (typeof chatInject === 'function') chatInject(); // Отстрането по барање
  }, 150);
};
