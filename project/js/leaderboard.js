// ── leaderboard.js ── Табела со најдобри играчи ───────────────────────────
// Поените се чуваат под users/{uid}

let _lbPlayers    = []; // Листа со играчи
let _lbTab        = 'score'; // Кое јазиче е активно
let _lbUnsubscribe = null; // Функција за исклучување на Firebase слушателот

/**
 * Што прави: Заштитува текст од HTML инјекции (XSS)
 * Параметри: str (стринг кој треба да се исчисти)
 * Враќа: безбеден стринг
 */
function escHtml(str) {
  if (!str) return '—';
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── Зачувување на најдобар резултат ─────────────────────────────────

/**
 * Што прави: Го зачувува најдобриот резултат за конкретна игра во базата
 * Параметри: game (стринг - ime на играта), gameScore (број - постигнати поени)
 * Враќа: ништо (асинхрона функција)
 */
async function syncScore(game, gameScore) {
  if (typeof db === 'undefined' || !currentUser) return;

  const uid  = currentUser.uid;
  const name = loadPlayerName();
  if (!uid || !name) return;

  const category  = loadCategory() || '';
  const bestKey   = 'best_' + game;
  const localBest = loadBest(game);

  try {
    // Ажурирај ги само основните податоци (не вкупните поени)
    const update = {
      displayName: name,
      category:    category,
      lastPlayed:  firebase.firestore.FieldValue.serverTimestamp(),
    };

    // Зачувај го резултатот само ако е подобар од претходниот
    if (gameScore > localBest) {
      update[bestKey] = gameScore;
      // Ажурирај и локално за веднаш да се види
      localStorage.setItem(`zb_${uid}_best_${game}`, String(gameScore));
    }

    // merge: true — ажурира само одредени полиња без да ги брише другите
    await db.collection('users').doc(uid).set(update, { merge: true });

  } catch (err) {
    console.warn('[Leaderboard] Грешка при зачувување:', err.code || err.message);
  }
}

// ── Зачувување на вкупни поени по секој одговор ───────────

/**
 * Што прави: Ги зголемува вкупните поени и локално и во базата веднаш по одговорот
 * Параметри: delta (број - колку поени да се додадат)
 * Враќа: ништо
 */
function saveAnswerDelta(delta) {
  if (!delta) return;

  // Секогаш ажурирај локално - работи и за гости
  const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : 'anon';
  const key = `zb_${uid}_total`;
  localStorage.setItem(key, String(Math.max(0, (parseInt(localStorage.getItem(key)) || 0) + delta)));

  // Ажурирај во Firestore само ако е најавен
  if (!currentUser || typeof db === 'undefined') return;
  db.collection('users').doc(uid)
    .set({
      score: firebase.firestore.FieldValue.increment(delta),
      lastActive: firebase.firestore.FieldValue.serverTimestamp() // Секогаш ажурирај го времето на последна активност
    }, { merge: true })
    .catch(err => console.warn('[Sync] Грешка при додавање поени:', err.code || err.message));
}
window.saveAnswerDelta = saveAnswerDelta;

/**
 * Што прави: Го исклучува слушателот за промени во табелата кога ќе излеземе
 * Параметри: нема
 * Враќа: ништо
 */
function lbDetach() {
  if (_lbUnsubscribe) { _lbUnsubscribe(); _lbUnsubscribe = null; }
}
window.lbDetach = lbDetach;

// ── Вчитување и приказ на табелата ───────────────────────────────

/**
 * Што прави: Ја отвора табелата со топ играчи и почнува да слуша за промени
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
async function showLeaderboard() {
  const cat = loadCategory();
  document.body.className = getThemeClass(cat);

  showScreen(`
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="showHub()">✕</button>
        <span class="bar-title">🏆 Топ 20 Играчи</span>
      </div>
      <div class="lb-loading">⏳ Се вчитува...</div>
    </div>`);

  try {
    if (typeof db === 'undefined') throw new Error('Firebase не е конфигуриран');

    lbDetach(); // Исчисти претходен слушател ако има

    // Следи ги топ 200 играчи во реално време (onSnapshot)
    _lbUnsubscribe = db.collection('users')
      .orderBy('score', 'desc')
      .limit(200)
      .onSnapshot(snap => {
        _lbPlayers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderLeaderboard(); // Прецртај ја табелата со новите податоци
      }, err => {
        console.warn('[Leaderboard] Грешка при вчитување во живо:', err.code || err.message);
      });
  } catch (err) {
    document.getElementById('app').innerHTML = `
      <div class="game-wrap">
        <div class="score-bar">
          <button class="exit-btn" onclick="showHub()">✕</button>
          <span class="bar-title">Табела</span>
        </div>
        <div class="lb-error">
          ⚠️ Не може да се вчита табелата.<br>
          Провери ја конфигурацијата на Firebase<br>и интернет врската.
        </div>
      </div>`;
  }
}

/**
 * Што прави: Го црта HTML-от за табелата со играчи и јазичињата
 * Параметри: нема
 * Враќа: ништо
 */
function renderLeaderboard() {
  const tabs = [
    { key: 'score',          label: 'Вкупно', icon: '🏆' },
    { key: 'best_match',     label: 'Спој',   icon: '🔗' },
    { key: 'best_truefalse', label: 'Т/Н',    icon: '✓✗' },
    { key: 'best_hangman',   label: 'Збор',   icon: '⭐' },
    { key: 'best_quiz',      label: 'Кој',    icon: '❓' },
  ];

  // Сортирај ги играчите според активното јазиче (пример: најдобри во Т/Н)
  // Филтрирај: Позитивни поени, валидно ime и активност во последните 30 дена
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const allSorted = [..._lbPlayers]
    .filter(p => {
      const hasPoints = (p[_lbTab] || 0) > 0;
      const hasName   = p.displayName && p.displayName.trim() !== '';

      // Ако нема timestamp (стари профили), претпостави дека се активни за почеток
      const lastActive = p.lastActive ? p.lastActive.toMillis() : Date.now();
      const isActive   = lastActive > thirtyDaysAgo;

      return hasPoints && hasName && isActive;
    })
    .sort((a, b) => (b[_lbTab] || 0) - (a[_lbTab] || 0));

  const top20  = allSorted.slice(0, 20); // Земи ги само првите 20
  const myUid  = currentUser ? currentUser.uid : null;

  // Најди го рангот на моменталниот корисник
  const myRankIdx = myUid ? allSorted.findIndex(p => p.id === myUid) : -1;
  const myRank    = myRankIdx + 1; // 0 значи не е најден

  // Икона за првите 3 места
  const rankLabel = i => {
    if (i === 0) return '👑';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `#${i + 1}`;
  };

  // Посебни класи за медали и за сопствениот резултат
  const rowClass = (p, i) => {
    const cls = ['lb-row'];
    if (i === 0)      cls.push('lb-top1');
    else if (i === 1) cls.push('lb-top2');
    else if (i === 2) cls.push('lb-top3');
    if (p.id === myUid) cls.push('lb-me');
    return cls.join(' ');
  };

  const tabsHtml = tabs.map(t =>
    `<button class="lb-tab${_lbTab === t.key ? ' lb-tab-active' : ''}"
      onclick="lbSwitchTab('${t.key}')">${t.icon} ${t.label}</button>`
  ).join('');

  // Ицртај ги редовите (без да се гледа е-пошта или ID)
  const rowsHtml = top20.length === 0
    ? '<div class="lb-empty">Нема резултати уште — биди прв! 🎮</div>'
    : top20.map((p, i) => `
        <div class="${rowClass(p, i)}">
          <span class="lb-rank">${rankLabel(i)}</span>
          ${playerAvatarHtml(p.displayName, p.avatarId, 30)}
          <span class="lb-name">${escHtml(p.displayName)}${p.id === myUid ? '<span class="lb-you">ти</span>' : ''}</span>
          <span class="lb-pts">${p[_lbTab] || 0}</span>
        </div>`).join('');

  // Инфо за рангот ако корисникот не е во топ 20
  let myRankHtml = '';
  if (myUid) {
    if (myRankIdx === -1) {
      myRankHtml = `<div class="lb-my-rank">🎮 Немаш поени уште — започни да играш!</div>`;
    } else if (myRank > 20) {
      myRankHtml = `<div class="lb-my-rank">📍 Ти си на место <strong>#${myRank}</strong> — продолжи да играш за да влезеш во Топ 20! 🚀</div>`;
    }
  }

  const cat = loadCategory();
  document.body.className = getThemeClass(cat);
  document.getElementById('app').innerHTML = `
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="showHub()">✕</button>
        <span class="bar-title">🏆 Топ 20 Играчи</span>
        <span class="bar-stat">${_lbPlayers.length} играчи</span>
      </div>
      <div class="lb-wrap">
        <div class="lb-list">${rowsHtml}${myRankHtml}</div>
      </div>
    </div>`;
}

/**
 * Што прави: Менува категорија (вкупно, спој, квиз итн.) во табелата
 * Параметри: tab (стринг - ime на јазичето)
 * Враќа: ништо
 */
window.lbSwitchTab = function(tab) {
  _lbTab = tab;
  renderLeaderboard();
};
