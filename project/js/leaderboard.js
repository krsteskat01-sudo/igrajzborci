// ── leaderboard.js ── Табела со најдобри играчи ───────────────────────────
// Поените се чуваат под users/{uid}

let _lbPlayers    = []; // Листа со играчи
let _lbTab        = 'score'; // Кое јазиче е активно
let _lbUnsubscribe = null; // Функција за исклучување на Firebase слушателот

// ── Cosmetic theme → subtle row tint mapping ─────────────────
const LB_THEME_TINTS = {
  'ohrid-sunset':       'rgba(255,180,120,.08)',
  'skopje-neon':        'rgba(0,245,224,.07)',
  'retro-yugoslav':     'rgba(192,136,42,.08)',
  'balkan-folklore':    'rgba(255,215,0,.08)',
  'mountain-village':   'rgba(74,138,74,.08)',
  'macedonian-bazaar':  'rgba(212,98,10,.08)',
  'lake-night':         'rgba(74,160,212,.08)',
};

// ── Achievement icon map for expand panels ───────────────────
const LB_ACH_DEFS = {
  prv_zbor:    { icon: '🏅', name: 'Прв збор' },
  sto_poeni:   { icon: '⭐', name: '100 поени' },
  streak7:     { icon: '🔥', name: '7 дена' },
  majstor:     { icon: '🧠', name: 'Мајстор' },
  sovrsheno:   { icon: '🎯', name: 'Совршено' },
  kolekcioner: { icon: '📚', name: 'Колекционер' },
  brzinec:     { icon: '⚡', name: 'Брзинец' },
  nedelen:     { icon: '📅', name: 'Неделен' },
};

// ── Per-player avatar with folk-avatar support ───────────────
function _lbAvatarHtml(player, size) {
  const sz = size || 34;
  // Always show the real photo — Google photo or SVG registration avatar.
  // Folk avatar cosmetic is applied as a ring on the wrapper in _lbBuildRow.
  if (player.googlePhotoUrl) {
    const escapedName = (player.displayName || '').replace(/"/g, '&quot;');
    return `<span class="avatar-circle avatar-google-photo" style="--av-sz:${sz}px;background-image:url('${player.googlePhotoUrl}')" aria-label="${escapedName}"></span>`;
  }
  return playerAvatarHtml(player.displayName, player.avatarId || '', sz);
}

// ── Tiny theme-swatch bar under the username ─────────────────
function _lbThemeBar(themeId) {
  if (!themeId || themeId === 'default') return '';
  const cat  = typeof COSMETIC_CATALOG !== 'undefined' ? (COSMETIC_CATALOG.themes || []) : [];
  const item = cat.find(t => t.id === themeId);
  return `<div class="lb-theme-bar swatch-${themeId}" title="${item ? item.name : themeId}"></div>`;
}

// ── Achievement mini-badges visible directly in the row ──────
// Shows up to 4 earned achievements as labelled pills next to the player name.
// Full achievement names are repeated in the expand panel for clarity.
function _lbMiniBadgesHtml(player) {
  const ach    = player.achievements || {};
  const earned = Object.entries(LB_ACH_DEFS).filter(([key]) => ach[key]);
  if (!earned.length) return '';
  const shown = earned.slice(0, 4);
  const rest  = earned.length - shown.length;
  const pills = shown.map(([key, def]) =>
    `<span class="lb-mini-badge lb-ach-${key}" title="${def.name}">${def.icon}<span class="lb-ach-lbl">${def.name}</span></span>`
  ).join('');
  const more = rest > 0 ? `<span class="lb-mini-badge lb-ach-more" title="${rest} повеќе">+${rest}</span>` : '';
  return `<div class="lb-mini-badges">${pills}${more}</div>`;
}

// ── Expandable cosmetics + achievement panel ─────────────────
function _lbBuildExpandPanel(player) {
  const settings = player.cosmeticSettings || {};
  const catalog  = typeof COSMETIC_CATALOG !== 'undefined' ? COSMETIC_CATALOG : { themes:[], frames:[], avatars:[] };

  const findName = (cat, id) => (catalog[cat] || []).find(i => i.id === id)?.name || id;

  const cosmeticsHtml = [
    settings.theme  && settings.theme  !== 'default' ? `<span class="lbep-chip lbep-theme">🎨 ${findName('themes',  settings.theme)}</span>`  : '',
    settings.frame  && settings.frame  !== 'none'    ? `<span class="lbep-chip lbep-frame">✨ ${findName('frames',  settings.frame)}</span>`  : '',
    settings.avatar && settings.avatar !== 'none'    ? `<span class="lbep-chip lbep-avatar">👤 ${findName('avatars', settings.avatar)}</span>` : '',
  ].filter(Boolean).join('');

  const ach = player.achievements || {};
  const achHtml = Object.entries(LB_ACH_DEFS)
    .filter(([key]) => ach[key])
    .map(([key, def]) => `
      <span class="lbep-ach lb-ach-${key}" title="${def.name}">
        <span class="lbep-ach-icon">${def.icon}</span>
        <span class="lbep-ach-name">${def.name}</span>
      </span>`)
    .join('');

  if (!cosmeticsHtml && !achHtml) return '<div class="lbep-empty">Нема козметика уште</div>';
  return `
    ${cosmeticsHtml ? `<div class="lbep-cosmetics">${cosmeticsHtml}</div>` : ''}
    ${achHtml       ? `<div class="lbep-achievements">${achHtml}</div>`    : ''}`;
}

// ── Build one full leaderboard row + collapsible panel ────────
function _lbBuildRow(player, rankIndex, myUid, scoreKey) {
  const settings   = player.cosmeticSettings || {};
  const frameId    = (settings.frame  && settings.frame  !== 'none') ? settings.frame  : null;
  const themeId    = (settings.theme  && settings.theme  !== 'default') ? settings.theme : null;
  const folkAvId   = (settings.avatar && settings.avatar !== 'none') ? settings.avatar : null;
  const frameClass = frameId  ? 'frame-' + frameId  : '';
  const folkClass  = folkAvId ? 'folk-' + folkAvId  : '';
  // Don't apply tintBg on top-3 rows — it overrides their solid orange/teal/lavender backgrounds
  const tintBg     = (themeId && rankIndex >= 3) ? LB_THEME_TINTS[themeId] || '' : '';
  const tintBorder = themeId ? `border-left:3px solid ${_lbThemeBorderColor(themeId)};` : '';

  const isMe      = player.id === myUid;
  const rankIcons = ['👑','🥈','🥉'];
  const rankDisp  = rankIndex < 3 ? rankIcons[rankIndex] : `#${rankIndex + 1}`;

  const rowClasses = ['lb-row', 'lb-row-cosm'];
  if (rankIndex === 0) rowClasses.push('lb-top1');
  else if (rankIndex === 1) rowClasses.push('lb-top2');
  else if (rankIndex === 2) rowClasses.push('lb-top3');
  if (isMe) rowClasses.push('lb-me');
  if (frameId === 'gold-ornament')  rowClasses.push('lb-prestige-gold');
  if (frameId === 'neon-glow')      rowClasses.push('lb-prestige-neon');
  if (frameId === 'folklore-weave') rowClasses.push('lb-prestige-folklore');

  const expandId  = `lb-exp-${player.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  return `
    <div class="${rowClasses.join(' ')}" data-uid="${player.id}"
      onclick="lbToggleExpand('${expandId}')"
      style="${tintBg ? `background:${tintBg};` : ''}${tintBorder}">
      <span class="lb-rank">${rankDisp}</span>
      <div class="avatar-frame-wrap ${frameClass} ${folkClass} lb-av-wrap" style="flex-shrink:0;">
        ${_lbAvatarHtml(player, 34)}
      </div>
      <div class="lb-name-col">
        <div class="lb-name-row">
          <span class="lb-name">${escHtml(player.displayName || '')}</span>
          ${isMe ? '<span class="lb-you">ти</span>' : ''}
        </div>
        ${_lbMiniBadgesHtml(player)}
        ${_lbThemeBar(themeId)}
      </div>
      <span class="lb-pts">${player[scoreKey] || 0}</span>
      <span class="lb-expand-arrow">›</span>
    </div>
    <div class="lb-expand-panel" id="${expandId}">
      ${_lbBuildExpandPanel(player)}
    </div>`;
}

function _lbThemeBorderColor(themeId) {
  const map = {
    'ohrid-sunset': '#FF8C42', 'skopje-neon': '#00F5E0', 'retro-yugoslav': '#C0882A',
    'balkan-folklore': '#FFD700', 'mountain-village': '#4A8A4A',
    'macedonian-bazaar': '#D4620A', 'lake-night': '#4A9FD4',
  };
  return map[themeId] || 'transparent';
}

// Toggle expand panel visibility
window.lbToggleExpand = function(expandId) {
  const panel = document.getElementById(expandId);
  if (!panel) return;
  const isOpen = panel.classList.contains('lb-exp-open');
  // Close all others
  document.querySelectorAll('.lb-expand-panel.lb-exp-open').forEach(p => p.classList.remove('lb-exp-open'));
  document.querySelectorAll('.lb-expand-arrow.lb-exp-rotated').forEach(a => a.classList.remove('lb-exp-rotated'));
  if (!isOpen) {
    panel.classList.add('lb-exp-open');
    const row = panel.previousElementSibling;
    if (row) row.querySelector('.lb-expand-arrow')?.classList.add('lb-exp-rotated');
  }
};

/**
 * Што прави: Заштитува текст од HTML инјекции (XSS)
 * Параметри: str (стринг кој треба да се исчисти)
 * Враќа: безбеден стринг
 */
function escHtml(htmlString) {
  if (!htmlString) return '—';
  return String(htmlString).replace(/[&<>"']/g, c =>
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
    // Only sync avatarId / googlePhotoUrl if localStorage has real values
    const localAvId   = typeof loadAvatarId      === 'function' ? loadAvatarId()      : '';
    const localGpUrl  = typeof loadGooglePhotoUrl === 'function' ? loadGooglePhotoUrl() : '';
    if (localAvId)  update.avatarId       = localAvId;
    if (localGpUrl) update.googlePhotoUrl = localGpUrl;

    // Sync public cosmetics so leaderboard always reflects current loadout
    if (typeof loadCosmeticSettings === 'function') {
      const cs = loadCosmeticSettings();
      if (cs && Object.keys(cs).length > 0) {
        update.cosmeticSettings = cs;
        update.selectedSkin    = cs.theme  || 'default';
        update.selectedBadge   = cs.badge  || 'none';
        update.selectedFrame   = cs.frame  || 'none';
        update.selectedAvatar  = cs.avatar || 'none';
      }
    }

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

    // Eagerly push the current user's avatar/photo into Firestore so every viewer
    // sees the correct avatar — not just the owner seeing their own patched row.
    if (currentUser) {
      const _avId  = typeof loadAvatarId      === 'function' ? loadAvatarId()      : '';
      const _gpUrl = typeof loadGooglePhotoUrl === 'function' ? loadGooglePhotoUrl() : '';
      if (_avId || _gpUrl) {
        const _upd = {};
        if (_avId)  _upd.avatarId       = _avId;
        if (_gpUrl) _upd.googlePhotoUrl = _gpUrl;
        db.collection('users').doc(currentUser.uid).update(_upd).catch(() => {});
      }
    }

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
    .filter(player => {
      const hasPoints = (player[_lbTab] || 0) > 0;
      const hasName   = player.displayName && player.displayName.trim() !== '';

      // Ако нема timestamp (стари профили), претпостави дека се активни за почеток
      const lastActive = player.lastActive ? player.lastActive.toMillis() : Date.now();
      const isActive   = lastActive > thirtyDaysAgo;

      return hasPoints && hasName && isActive;
    })
    .sort((a, b) => (b[_lbTab] || 0) - (a[_lbTab] || 0));

  const currentUserId    = currentUser ? currentUser.uid : null;
  // For the current user, fill in avatar/photo from localStorage if Firestore doc is missing
  // them (race condition during signup, or account predating the fields).
  // For the current user, localStorage is always the most up-to-date source for
  // avatarId and googlePhotoUrl (synced from Firestore on login, set on signup).
  // Firestore may lag behind or be missing these fields due to signup race conditions.
  const localAvId  = currentUserId && typeof loadAvatarId      === 'function' ? loadAvatarId()      : '';
  const localGpUrl = currentUserId && typeof loadGooglePhotoUrl === 'function' ? loadGooglePhotoUrl() : '';
  const topPlayers = allSorted.slice(0, 20).map(player => {
    if (currentUserId && player.id === currentUserId) {
      const patched = { ...player };
      if (localAvId)  patched.avatarId       = localAvId;   // always trust local
      if (localGpUrl) patched.googlePhotoUrl = localGpUrl;
      return patched;
    }
    return player;
  });
  const currentUserRankIndex = currentUserId ? allSorted.findIndex(player => player.id === currentUserId) : -1;
  const myRank           = currentUserRankIndex + 1;

  const tabsHtml = tabs.map(t =>
    `<button class="lb-tab${_lbTab === t.key ? ' lb-tab-active' : ''}"
      onclick="lbSwitchTab('${t.key}')">${t.icon} ${t.label}</button>`
  ).join('');

  // Ицртај ги редовите со козметика (без да се гледа е-пошта или ID)
  const rowsHtml = topPlayers.length === 0
    ? '<div class="lb-empty">Нема резултати уште — биди прв! 🎮</div>'
    : topPlayers.map((player, rankIndex) =>
        _lbBuildRow(player, rankIndex, currentUserId, _lbTab)
      ).join('');

  // Инфо за рангот ако корисникот не е во топ 20
  let myRankHtml = '';
  if (currentUserId) {
    if (currentUserRankIndex === -1) {
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
