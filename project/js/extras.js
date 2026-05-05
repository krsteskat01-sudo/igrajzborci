// ── extras.js ── Дополнителни функционалности ───────────────────────────────────────────────
// Додава нови опции без да ги менува оригиналните фајлови преку "monkey-patching".
// Мора да се вчита ПОСЛЕДЕН (по features.js).

// ── Локална состојба ──────────────────────────────────────────────────────
let _extSavedWords = []; // Зачувани зборови
let _extMistakes   = []; // Направени грешки

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
const _extBaseGetWordPool = getWordPool;

/**
 * Што прави: Враќа зборови според избраната категорија и тежина
 * Параметри: category (стринг)
 * Враќа: низа со објекти (зборови)
 */
window.getWordPool = function(category) {
  const base = _extBaseGetWordPool(category);
  const diff = loadDifficulty();
  // Ако е лесно, дај ги само лесните (тежина 1)
  if (diff === 'easy') { const f = base.filter(w => w.težina === 1); return f.length >= 4 ? f : base; }
  // Ако е тешко, дај ги сите зборови од базата без филтер
  if (diff === 'hard') return ZBOROVI;
  return base; // нормално
};

/**
 * Што прави: Менува тежина и го ажурира визуелниот изглед на копчињата
 * Параметри: d (стринг)
 * Враќа: ништо
 */
window.extSetDifficulty = function(d) {
  saveDifficulty(d);
  document.querySelectorAll('.diff-btn').forEach(b => {
    const map = { easy: 'Лесно', normal: 'Нормално', hard: 'Тешко' };
    b.classList.toggle('diff-active', b.textContent.trim() === map[d]);
  });
};

// ── Кука за одговор на прашање ────────────────────────────────────────
// Игрите го повикуваат ова по секој одговор: onWordAnswered(zbor, def, isCorrect, wordData)

/**
 * Што прави: Ги бележи грешките по секој одговор
 * Параметри: zbor (стринг), def (стринг), isCorrect (булова вредност), wordData (објект)
 * Враќа: ништо
 */
window.onWordAnswered = function(zbor, def, isCorrect, wordData) {
  if (!isCorrect) _extTrackMistake(zbor, def);
};

// ── Колекција на зборови ────────────────────────────────────────────

/**
 * Што прави: Додава збор во колекцијата на зачувани зборови
 * Параметри: zbor (стринг)
 * Враќа: ништо
 */
window.extSaveWord = function(zbor) {
  if (_extSavedWords.some(w => w.zbor === zbor)) return;
  const wd = ZBOROVI.find(w => w.zbor === zbor);
  if (!wd) return;
  _extSavedWords.push({ zbor: wd.zbor, def: wd.definicija, fact: wd.fact || '' });

  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .set({ savedWords: firebase.firestore.FieldValue.arrayUnion(zbor) }, { merge: true })
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
  if (_extSavedWords.length === 0) {
    showScreen(`<div class="game-wrap"><div class="score-bar">
      <button class="exit-btn" onclick="showHub()">✕</button>
      <span class="bar-title">💾 Мои Зборови</span>
    </div><div class="collection-empty">
      <div class="ce-icon">📚</div>
      <p>Нема зачувани зборови.<br>Играј и зачувај ги интересните!</p>
    </div></div>`);
    return;
  }
  const html = _extSavedWords.map(w => `
    <div class="collection-item">
      <div class="ci-word">${escHtml(w.zbor)}</div>
      <div class="ci-def">${escHtml(w.def)}</div>
      ${w.fact ? `<div class="ci-fact">✦ ${escHtml(w.fact)}</div>` : ''}
      <button class="ci-remove" onclick="extRemoveWord('${w.zbor.replace(/'/g,"\\'")}')">✕</button>
    </div>`).join('');
  showScreen(`<div class="game-wrap"><div class="score-bar">
    <button class="exit-btn" onclick="showHub()">✕</button>
    <span class="bar-title">💾 Мои Зборови</span>
    <span class="bar-stat">${_extSavedWords.length} зборови</span>
  </div><div class="collection-list">${html}</div></div>`);
};

/**
 * Што прави: Брише збор од колекцијата
 * Параметри: zbor (стринг)
 * Враќа: ништо
 */
window.extRemoveWord = function(zbor) {
  _extSavedWords = _extSavedWords.filter(w => w.zbor !== zbor);
  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .set({ savedWords: firebase.firestore.FieldValue.arrayRemove(zbor) }, { merge: true })
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
    const snap = await db.collection('users').doc(currentUser.uid).get();
    if (!snap.exists) return;
    _extSavedWords = (snap.data().savedWords || [])
      .map(z => ZBOROVI.find(w => w.zbor === z)).filter(Boolean)
      .map(w => ({ zbor: w.zbor, def: w.definicija, fact: w.fact || '' }));
  } catch (e) {}
}

// ── Листа на грешки ──────────────────────────────────────────────

/**
 * Што прави: Бележи погрешно одговорен збор
 * Параметри: zbor (стринг), def (стринг)
 * Враќа: ништо
 */
function _extTrackMistake(zbor, def) {
  if (_extMistakes.some(m => m.zbor === zbor)) return;
  _extMistakes.unshift({ zbor, def }); // Додај на почеток
  if (_extMistakes.length > 30) _extMistakes.pop(); // Чувај само последните 30

  if (currentUser && typeof db !== 'undefined') {
    db.collection('users').doc(currentUser.uid)
      .set({ mistakes: _extMistakes.slice(0, 20).map(m => ({ zbor: m.zbor, def: m.def })) }, { merge: true })
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
  if (_extMistakes.length === 0) {
    showScreen(`<div class="game-wrap"><div class="score-bar">
      <button class="exit-btn" onclick="showHub()">✕</button>
      <span class="bar-title">✗ Грешки</span>
    </div><div class="collection-empty">
      <div class="ce-icon">🎯</div>
      <p>Нема грешки — одлично! 🎉</p>
    </div></div>`);
    return;
  }
  const html = _extMistakes.map(m => `
    <div class="collection-item mistakes-item">
      <div class="ci-word">${escHtml(m.zbor)}</div>
      <div class="ci-def">${escHtml(m.def)}</div>
    </div>`).join('');
  showScreen(`<div class="game-wrap"><div class="score-bar">
    <button class="exit-btn" onclick="showHub()">✕</button>
    <span class="bar-title">✗ Грешки</span>
    <span class="bar-stat">${_extMistakes.length}</span>
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
    const snap = await db.collection('users').doc(currentUser.uid).get();
    if (!snap.exists) return;
    _extMistakes = (snap.data().mistakes || []).map(m => ({ zbor: m.zbor, def: m.def }));
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
  let d = {};
  if (currentUser && typeof db !== 'undefined') {
    try { const s = await db.collection('users').doc(currentUser.uid).get(); if (s.exists) d = s.data(); }
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
          <div class="stat-box stat-primary"><div class="sb-val">${d.score||0}</div><div class="sb-label">Вкупно поени</div></div>
          <div class="stat-box"><div class="sb-val">${d.streak||0}</div><div class="sb-label">🔥 Денови по ред</div></div>
          <div class="stat-box"><div class="sb-val">${Math.max(d.best_match||0,d.best_truefalse||0,d.best_hangman||0,d.best_quiz||0,d.best_speedround||0)}</div><div class="sb-label">⭐ Најдобар резултат</div></div>
          <div class="stat-box"><div class="sb-val">${(d.savedWords||[]).length}</div><div class="sb-label">💾 Зачувани зборови</div></div>
        </div>
        <div class="stats-section-title">Рекорди по игра</div>
        <div class="stats-grid">
          <div class="stat-box"><div class="sb-val">${d.best_match||0}</div><div class="sb-label">🔗 Спој</div></div>
          <div class="stat-box"><div class="sb-val">${d.best_truefalse||0}</div><div class="sb-label">✓✗ Точно/Неточно</div></div>
          <div class="stat-box"><div class="sb-val">${d.best_hangman||0}</div><div class="sb-label">⭐ Збор по збор</div></div>
          <div class="stat-box"><div class="sb-val">${d.best_quiz||0}</div><div class="sb-label">❓ Кој збор</div></div>
          <div class="stat-box"><div class="sb-val">${d.best_speedround||0}</div><div class="sb-label">⚡ Брза Рунда</div></div>
          <div class="stat-box"><div class="sb-val">${(d.mistakes||[]).length}</div><div class="sb-label">✗ Грешки</div></div>
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
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // пресметај разлика до понеделник
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.toISOString().split('T')[0];
}

/**
 * Што прави: Додава поени на неделниот резултат
 * Параметри: uid (стринг - ID на корисник), gameScore (број)
 * Враќа: ништо (асинхрона функција)
 */
async function _extUpdateWeeklyScore(uid, gameScore) {
  if (!uid || typeof db === 'undefined') return;
  const weekStart = _extGetWeekStart();
  const ref = db.collection('users').doc(uid);
  try {
    // Користи трансакција за безбедно ажурирање
    await db.runTransaction(async t => {
      const doc = await t.get(ref);
      const d = doc.exists ? doc.data() : {};
      if ((d.weeklyResetDate || '') !== weekStart) {
        // Ресетирај за нова недела
        t.set(ref, { weeklyScore: gameScore, weeklyResetDate: weekStart }, { merge: true });
      } else {
        // Додај на постоечка недела
        t.update(ref, { weeklyScore: firebase.firestore.FieldValue.increment(gameScore) });
      }
    });
  } catch (e) { console.warn('[Extras] Weekly score:', e.message); }
}

const _extAllTabDefs = [
  { key: 'score',           label: 'Вкупно', icon: '🏆' },
  { key: 'best_match',      label: 'Спој',   icon: '🔗' },
  { key: 'best_truefalse',  label: 'Т/Н',    icon: '✓✗' },
  { key: 'best_hangman',    label: 'Збор',   icon: '⭐' },
  { key: 'best_quiz',       label: 'Кој',    icon: '❓' },
  { key: 'best_speedround', label: 'Брза',   icon: '⚡' },
  { key: 'weeklyScore',     label: 'Недела', icon: '📅' },
];

/**
 * Што прави: Го црта јазичето за неделната табела
 * Параметри: нема
 * Враќа: ништо
 */
function _extRenderWeeklyTab() {
  const weekStart   = _extGetWeekStart();
  const weekPlayers = [..._lbPlayers]
    .filter(p => p.weeklyResetDate === weekStart && (p.weeklyScore || 0) > 0)
    .sort((a, b) => (b.weeklyScore || 0) - (a.weeklyScore || 0));
  const top20  = weekPlayers.slice(0, 20);
  const myUid  = currentUser ? currentUser.uid : null;
  const myIdx  = myUid ? weekPlayers.findIndex(p => p.id === myUid) : -1;
  const rankLabel = i => i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;

  const rowsHtml = top20.length === 0
    ? '<div class="lb-empty">Нема резултати оваа недела 🗓</div>'
    : top20.map((p, i) => {
        const isMe = p.id === myUid;
        const cls  = ['lb-row', i===0?'lb-top1':i===1?'lb-top2':i===2?'lb-top3':'', isMe?'lb-me':''].filter(Boolean).join(' ');
        return `<div class="${cls}">
          <span class="lb-rank">${rankLabel(i)}</span>
          ${playerAvatarHtml(p.displayName, p.avatarId, 30)}
          <span class="lb-name">${escHtml(p.displayName||'')}${isMe?'<span class="lb-you">ти</span>':''}</span>
          <span class="lb-pts">${p.weeklyScore||0}</span>
        </div>`;
      }).join('');
  let myRankHtml = '';
  if (myUid && myIdx === -1) myRankHtml = '<div class="lb-my-rank">🎮 Играј оваа недела за да влезеш!</div>';
  else if (myUid && myIdx + 1 > 20) myRankHtml = `<div class="lb-my-rank">📍 Ти си #${myIdx+1} — продолжи!</div>`;

  const tabsHtml = _extAllTabDefs.map(t =>
    `<button class="lb-tab${_lbTab===t.key?' lb-tab-active':''}" onclick="lbSwitchTab('${t.key}')">${t.icon} ${t.label}</button>`
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
const _extBaseRenderLB = renderLeaderboard;

/**
 * Што прави: Ги црта новите јазичиња (Брза рунда, Недела) во табелата
 * Параметри: нема
 * Враќа: ништо
 */
window.renderLeaderboard = function() {
  if (_lbTab === 'weeklyScore') {
    _extRenderWeeklyTab();
  } else {
    _extBaseRenderLB();
    // Вметни ги новите јазичиња откако ќе се исцрта основата
    const tabsEl = document.querySelector('.lb-tabs');
    if (tabsEl && !tabsEl.querySelector('[data-ext-tab]')) {
      if (['best_speedround','weeklyScore'].includes(_lbTab)) {
        tabsEl.querySelectorAll('.lb-tab-active').forEach(b => b.classList.remove('lb-tab-active'));
      }
      [{ key:'best_speedround', label:'Брза', icon:'⚡' }, { key:'weeklyScore', label:'Недела', icon:'📅' }]
        .forEach(t => {
          const btn = document.createElement('button');
          btn.className = 'lb-tab' + (_lbTab === t.key ? ' lb-tab-active' : '');
          btn.setAttribute('data-ext-tab', t.key);
          btn.onclick = () => lbSwitchTab(t.key);
          btn.textContent = t.icon + ' ' + t.label;
          tabsEl.appendChild(btn);
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
  const zbor = (document.getElementById('sug-zbor')?.value || '').trim();
  const def  = (document.getElementById('sug-def')?.value  || '').trim();
  const fact = (document.getElementById('sug-fact')?.value || '').trim();
  const msg  = document.getElementById('sug-msg');
  const btn  = document.getElementById('sug-btn');

  if (!zbor || !def) { if (msg) msg.innerHTML = '<span class="fb-wrong">Внеси збор и дефиниција.</span>'; return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    if (typeof db !== 'undefined') {
      await db.collection('suggestions').add({
        zbor, def, fact: fact || '',
        uid: currentUser ? currentUser.uid : 'anon',
        displayName: loadPlayerName() || 'Анонимно',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (msg) msg.innerHTML = '<span class="fb-correct">✓ Благодариме! Ќе го разгледаме.</span>';
    if (btn) { btn.disabled = false; btn.textContent = 'Испрати уште →'; }
    ['sug-zbor','sug-def','sug-fact'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    if (msg) msg.innerHTML = '<span class="fb-wrong">Грешка — обиди се пак.</span>';
    if (btn) { btn.disabled = false; btn.textContent = 'Испрати →'; }
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

  const now = new Date();
  const soy = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - soy) / 86400000 + soy.getDay() + 1) / 7);
  const word = ZBOROVI[weekNum % ZBOROVI.length];

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

const _extBaseUpdateStreak = updateStreak;

/**
 * Што прави: Ги ажурира деновите по ред и дава бонус поени
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.updateStreak = async function() {
  const prev = _featStreak;
  await _extBaseUpdateStreak();
  if (_featStreak > prev && _featStreak > 1) {
    _extStreakBonusToast(_featStreak);
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
  const t = document.createElement('div');
  t.className = 'streak-bonus-toast';
  t.innerHTML = `🔥 ${streak} дена по ред! <strong>+20 бонус поени</strong>`;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('sbt-show'), 10);
  setTimeout(() => { t.classList.remove('sbt-show'); setTimeout(() => t.remove(), 400); }, 3200);
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
    const d   = snap.data();
    const ach = d.achievements || {};
    const upd = {};
    if (!ach.kolekcioner && (d.savedWords||[]).length >= 5)  upd['achievements.kolekcioner'] = true;
    if (!ach.brzinec     && (d.best_speedround||0) > 0)      upd['achievements.brzinec']     = true;
    if (!ach.nedelen     && (d.streak||0) >= 7)              upd['achievements.nedelen']     = true;
    if (Object.keys(upd).length > 0) await ref.update(upd);
  } catch (e) {}
}

// ── Помошник за известувања (Toast) ───────────────────────────────────────────────

/**
 * Што прави: Прикажува мало скокачко известување
 * Параметри: msg (стринг - пораката)
 * Враќа: ништо
 */
function _extToast(msg) {
  let t = document.querySelector('.badge-toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'badge-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('bt-show'), 10);
  setTimeout(() => { t.classList.remove('bt-show'); setTimeout(() => t.remove(), 300); }, 2200);
}

// ── Ажурирање на зачувувањето поени ────────────────────────────────────────────

const _extBaseSyncScore = syncScore;

/**
 * Што прави: Зачувува поени и истовремено проверува неделни поени и значки
 * Параметри: game (стринг), score (број)
 * Враќа: ништо (асинхрона функција)
 */
window.syncScore = async function(game, score) {
  await _extBaseSyncScore(game, score);
  if (currentUser) {
    await _extUpdateWeeklyScore(currentUser.uid, score);
    await _extCheckAchievements();
  }
};

// ── Ажурирање на менито (Hub) ──────────────────────────────────────────────

const _extBaseShowHub = showHub;

/**
 * Што прави: Го отвора главното мени и вметнува нови елементи (збор на недела, копчиња)
 * Параметри: нема
 * Враќа: ништо
 */
window.showHub = function() {
  _extBaseShowHub();
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
