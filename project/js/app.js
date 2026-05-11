// ── app.js ────────────────────────────────────────────────────

/**
 * Што прави: Враќа листа на зборови според избраната категорија на тежина
 * Параметри: category (стринг - 'mladi', 'sredno', или друго за 'pro')
 * Враќа: низа од објекти (зборови)
 */
function getWordPool(category) {
  if (category === 'mladi')  return ZBOROVI.filter(z => z.težina === 1);
  if (category === 'sredno') return ZBOROVI.filter(z => z.težina <= 2);
  return ZBOROVI; // Врати ги сите зборови за 'pro'
}

/**
 * Што прави: Ја враќа CSS класата за соодветната категорија (тема на изглед)
 * Параметри: category (стринг)
 * Враќа: стринг (ime на CSS класа)
 */
function getThemeClass(category) {
  if (category === 'mladi')  return 'mladi-zborcari';
  if (category === 'sredno') return 'sredno';
  return 'pro';
}

/**
 * Што прави: Прикажува одреден HTML на екранот
 * Параметри: html (стринг со HTML код)
 * Враќа: ништо
 */
function showScreen(html) {
  document.getElementById('app').innerHTML = html;
}

// ── Аватар логика ────────────────────────────────────────────
const AVATAR_IDS = ['avatar1','avatar2','avatar3','avatar4','avatar5','avatar6'];

/**
 * Што прави: Креира едноставен аватар од првата буква на името со различна боја
 * Параметри: name (стринг - ime), size (број - големина во пиксели)
 * Враќа: стринг (HTML за аватарот)
 */
function _createInitialAvatar(name, size) {
  const letter  = ((name || '?')[0] || '?').toUpperCase();
  const palette = ['#3B1F3A','#1A7A6E','#E8641A','#8B7AB8','#2D6A4F','#C9442B'];
  const bg      = palette[((name || '?').charCodeAt(0) || 0) % palette.length];
  return `<span class="initial-avatar" style="--av-sz:${size}px;background:${bg}">${letter}</span>`;
}

/**
 * Што прави: Генерира HTML за аватар на играчот (или слика или почетна буква)
 * Параметри: name (стринг), avatarId (стринг - ID на слика), size (број)
 * Враќа: стринг (HTML за аватарот)
 */
// photoUrl is an optional explicit URL — never read localStorage here because
// this function is also called for OTHER players (leaderboard) where localStorage
// only contains the *viewing* user's photo, not the player being rendered.
function playerAvatarHtml(name, avatarId, size, photoUrl) {
  size = size || 36;
  const escapedName = (name || '').replace(/"/g, '&quot;');
  if (avatarId && AVATAR_IDS.includes(avatarId)) {
    return `<span class="avatar-circle av-${avatarId}" style="--av-sz:${size}px" aria-label="${escapedName}"></span>`;
  }
  if (photoUrl) {
    return `<span class="avatar-circle avatar-google-photo" style="--av-sz:${size}px;background-image:url('${photoUrl}')" aria-label="${escapedName}"></span>`;
  }
  return _createInitialAvatar(name, size);
}

// ── Логика за најава и одјава ────────────────────────────────

/**
 * Што прави: Прикажува дијалог за потврда пред одјавување
 * Параметри: нема
 * Враќа: ништо
 */
window._showLogoutConfirm = function() {
  const overlayDialog = document.createElement('div');
  overlayDialog.className = 'confirm-dialog-overlay';
  overlayDialog.innerHTML = `
    <div class="confirm-dialog">
      <div class="confirm-dialog-icon">👋</div>
      <div class="confirm-dialog-title">Сигурен/а си?</div>
      <div class="confirm-dialog-msg">Ќе излезеш од твојата сметка.</div>
      <div class="confirm-dialog-btns">
        <button class="btn-secondary" onclick="document.querySelector('.confirm-dialog-overlay').remove()">Откажи</button>
        <button class="btn-primary" onclick="window._doLogOut()">Да, излез</button>
      </div>
    </div>`;
  // Затвори го дијалогот ако се кликне надвор од него
  overlayDialog.addEventListener('click', event => { if (event.target === overlayDialog) overlayDialog.remove(); });
  document.body.appendChild(overlayDialog);
};

/**
 * Што прави: Го одјавува корисникот и ги брише локалните податоци
 * Параметри: нема
 * Враќа: ништо
 */
window._doLogOut = function() {
  document.querySelector('.confirm-dialog-overlay')?.remove();

  // Исклучи други системи ако се активни
  if (typeof chatStop === 'function') chatStop();
  if (typeof lbDetach === 'function') lbDetach();

  const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : null;
  if (uid) {
    clearUserLocalStorage(uid); // Избриши ги податоците од LocalStorage
    firebase.auth().signOut();  // Одјави се од Firebase
  } else {
    // Режим за гости — нема сесија, само врати се на екранот за најава
    showAuthScreen('login');
  }
};

/**
 * Што прави: Прикажува дијалог за потврда пред бришење на профилот
 * Параметри: нема
 * Враќа: ништо
 */
window._showDeleteAccountConfirm = function() {
  const overlayDialog = document.createElement('div');
  overlayDialog.className = 'confirm-dialog-overlay';
  overlayDialog.innerHTML = `
    <div class="confirm-dialog">
      <div class="confirm-dialog-icon">⚠️</div>
      <div class="confirm-dialog-title">Избриши профил?</div>
      <div class="confirm-dialog-msg">Твоите поени и коментари ќе бидат трајно избришани. Ова не може да се врати.</div>
      <div class="confirm-dialog-btns">
        <button class="btn-secondary" onclick="document.querySelector('.confirm-dialog-overlay').remove()">Откажи</button>
        <button class="btn-danger" onclick="window._doDeleteAccount()">Да, избриши сè</button>
      </div>
    </div>`;
  // Затвори го дијалогот ако се кликне надвор од него
  overlayDialog.addEventListener('click', event => { if (event.target === overlayDialog) overlayDialog.remove(); });
  document.body.appendChild(overlayDialog);
};

/**
 * Што прави: Трајно го брише профилот на корисникот од Firestore и Auth
 * Параметри: нема
 * Враќа: ништо
 */
window._doDeleteAccount = async function() {
  if (!currentUser) return;
  const uid = currentUser.uid;
  document.querySelector('.confirm-dialog-overlay')?.remove();

  try {
    // 1. Избриши ги податоците од Firestore
    await db.collection('users').doc(uid).delete();

    // 2. Исчисти LocalStorage
    clearUserLocalStorage(uid);

    // 3. Избриши ја самата сметка од Firebase Auth
    await currentUser.delete();

    // 4. Освежи ја страницата за да се врати на почеток
    location.reload();
  } catch (err) {
    // Ако корисникот не се најавил скоро, Firebase бара повторна најава за оваа акција
    if (err.code === 'auth/requires-recent-login') {
      alert('За да ја избришете сметката, мора повторно да се најавите поради безбедност.');
      firebase.auth().signOut();
    } else {
      console.error('Account deletion failed:', err);
      alert('Грешка при бришење: ' + err.message);
    }
  }
};

// ── Внесување и промена на ime ────────────────────────────────────

/**
 * Што прави: Прикажува екран за внесување или промена на името на играчот
 * Параметри: fromHub (булова вредност - дали се повикува од главното мени)
 * Враќа: ништо
 */
function showNameEntry(fromHub) {
  const existing = loadPlayerName();
  // Постави ја темата според возраста ако се менува ime од менито
  if (fromHub) document.body.className = getThemeClass(loadCategory());
  else document.body.className = '';

  showScreen(`
    <div class="name-entry">
      <div class="logo-wrap">
        <h1 class="logo">${LOGO}</h1>
        <p class="logo-sub">Македонски зборови &mdash; учи преку игра</p>
      </div>
      <div class="name-form">
        <p class="name-label">${fromHub ? 'Промени го твоето ime' : 'Внеси го твоето ime'}</p>
        <input type="text" id="name-input" class="name-input"
          placeholder="Твоето ime..."
          maxlength="20" autocomplete="off" spellcheck="false"
          value="${escHtml(existing)}"
          onkeydown="if(event.key==='Enter') submitName(${fromHub})">
        <button class="btn-primary" onclick="submitName(${fromHub})">
          ${fromHub ? 'Зачувај' : 'Продолжи →'}
        </button>
        ${fromHub ? `<button class="btn-secondary" onclick="showHub()">Откажи</button>` : ''}
      </div>
    </div>`);

  // Фокусирај го полето за текст после кратко време
  setTimeout(() => {
    const nameInput = document.getElementById('name-input');
    if (nameInput) { nameInput.focus(); nameInput.select(); }
  }, 80);
}

/**
 * Што прави: Го зачувува внесеното ime и продолжува понатаму
 * Параметри: fromHub (булова вредност)
 * Враќа: ништо
 */
function submitName(fromHub) {
  const input = document.getElementById('name-input');
  const name  = input ? input.value.trim() : '';

  // Додади грешка ако името е празно
  if (!name) {
    if (input) input.classList.add('input-error');
    return;
  }

  savePlayerName(name);

  // Ажурирај го името во Firestore само (не ги допирај поените)
  if (typeof db !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid)
      .update({ displayName: name })
      .catch(err => console.warn('Failed to update displayName:', err));
  }

  // Оди на соодветниот екран
  if (fromHub) showHub(); else showAgeSelect();
}

// ── Избор на возраст ────────────────────────────────────────────────

/**
 * Што прави: Прикажува екран за избор на возрасна група (тежина на зборови)
 * Параметри: нема
 * Враќа: ништо
 */
function showAgeSelect() {
  document.body.className = '';
  showScreen(`
    <div class="age-select">
      <div class="logo-wrap">
        <h1 class="logo">${LOGO}</h1>
        <p class="logo-sub">Македонски зборови &mdash; учи преку игра</p>
      </div>
      <p class="age-label"><span class="star-accent">*</span> Избери ја твојата група</p>
      <div class="age-cards">
        <div class="age-card mladi-card" onclick="selectAge('mladi')">
          <div class="age-icon">🌱</div>
          <div class="age-title">Мали Зборчари</div>
          <div class="age-range">6 – 10 години</div>
          <div class="age-desc">Лесни зборови</div>
        </div>
        <div class="age-card sredno-card" onclick="selectAge('sredno')">
          <div class="age-icon">🌿</div>
          <div class="age-title">Млади Зборчари</div>
          <div class="age-range">11 – 15 години</div>
          <div class="age-desc">Лесни и средни зборови</div>
        </div>
        <div class="age-card pro-card" onclick="selectAge('pro')">
          <div class="age-icon">🌳</div>
          <div class="age-title">Зборчари Про</div>
          <div class="age-range">16+ години</div>
          <div class="age-desc">Сите зборови</div>
        </div>
      </div>
    </div>`);
}

/**
 * Што прави: Ја зачувува избраната возраст и го ажурира профилот
 * Параметри: cat (стринг - категорија)
 * Враќа: ништо
 */
function selectAge(cat) {
  saveCategory(cat);
  document.body.className = getThemeClass(cat);

  // Ажурирај ја категоријата во базата
  if (typeof db !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid)
      .set({ category: cat }, { merge: true })
      .catch(err => console.warn('Failed to update category:', err));
  }

  showHub(); // Оди на главното мени
}

// ── Главно мени (Hub) ───────────────────────────────────────────────────────

/**
 * Што прави: Го прикажува главното мени со сите достапни игри
 * Параметри: нема
 * Враќа: ништо
 */
function showHub() {
  if (typeof lbDetach === 'function') lbDetach(); // Исклучи ја табелата
  const cat        = loadCategory();
  const playerName = loadPlayerName();
  const total      = loadTotal();
  document.body.className = getThemeClass(cat);

  // Листа на игри со бои и икони
  const games = [
    { id: 'match',     color: 'card-teal',     icon: '🔗', name: 'Спој го зборот',    desc: 'Поврзи збор со дефиниција' },
    { id: 'truefalse', color: 'card-lavender',  icon: '✓✗', name: 'Точно или Неточно', desc: 'Одлучи дали е точно' },
    { id: 'hangman',   color: 'card-dark',      icon: '⭐', name: 'Збор по збор',       desc: 'Погоди го зборот' },
    { id: 'quiz',       color: 'card-orange',   icon: '❓', name: 'Кој збор е тоа',     desc: 'Избери точен одговор' },
    { id: 'speedround', color: 'card-speed',    icon: '⚡', name: 'Брза Рунда',          desc: '60 секунди — колку побрзо!' },
  ];

  // Генерирај HTML картички за игрите
  const cardsHtml = games.map(gameCard => {
    const best = loadBest(gameCard.id); // Вчитај го најдобриот резултат
    return `
      <div class="game-card ${gameCard.color}" onclick="startGame('${gameCard.id}')">
        <div class="game-icon">${gameCard.icon}</div>
        <div class="game-name">${gameCard.name}</div>
        <div class="game-desc">${gameCard.desc}</div>
        <div class="game-best">${best > 0 ? '* ' + best + ' поени' : '— нема рекорд'}</div>
      </div>`;
  }).join('');

  showScreen(`
    <div class="hub">
      <div class="hub-header">
        <button class="back-btn" onclick="showAgeSelect()">← Назад</button>
        <h2 class="hub-logo">${LOGO}</h2>
        <div class="hub-coins" id="hub-coins-display">🪙 <strong id="hub-coins-val">${typeof loadCoins === 'function' ? loadCoins() : 0}</strong></div>
        <button class="how-to-hub-btn" onclick="showHowToPlay()" title="Правила и упатство">❓</button>
        <button class="cosmetics-hub-btn" onclick="showCosmeticsShop('themes')">🎨</button>
        <button class="logout-btn" onclick="handleLogOut()">Излез</button>
      </div>
      <div class="hub-body">
      <div class="hub-player">
        <div class="avatar-frame-wrap ${typeof getActiveFrameClass === 'function' ? getActiveFrameClass() : ''}">
          ${playerAvatarHtml(playerName, loadAvatarId(), 36, typeof loadGooglePhotoUrl === 'function' ? loadGooglePhotoUrl() : '')}
        </div>
        <strong>${escHtml(playerName)}</strong>
        <button class="change-name-btn" onclick="showNameEntry(true)">Промени</button>
        ${currentUser ? `<button class="delete-acc-btn" onclick="_showDeleteAccountConfirm()">Избриши профил</button>` : ''}
      </div>
      ${!currentUser ? `<div class="guest-banner">
        <span>🎮 Играш без сметка — резултатите не се зачувуваат во табелата</span>
        <button class="guest-reg-btn" onclick="showAuthScreen('signup')">Регистрирај се →</button>
      </div>` : ''}
      <p class="hub-sub"><span class="star-accent">*</span> Избери игра</p>
      <button class="hub-lb-card" onclick="showLeaderboard()">
        <span class="hlb-icon">🏆</span>
        <span class="hlb-text">Табела на резултати</span>
        <span class="hlb-arrow">→</span>
      </button>
      <div class="games-grid">${cardsHtml}</div>

      <div class="premium-section">
        <p class="premium-label">
          <span class="star-accent">✦</span> Напредни Игри
          <span class="premium-score">⭐ ${total} поени</span>
        </p>
        <div class="games-grid">
          ${typeof PREMIUM_GAMES !== 'undefined'
            ? PREMIUM_GAMES.map(g => typeof premiumCardHtml === 'function' ? premiumCardHtml(g) : '').join('')
            : ''}
        </div>
      </div>

      <div class="hub-footer">
        <button class="lb-open-btn" onclick="showLeaderboard()">* Табела на резултати</button>
      </div>

      <footer class="social-footer">
        <div class="social-divider"><span>*</span></div>
        <div class="social-links">
          <a class="social-link" href="https://www.facebook.com/profile.php?id=61558280367554&locale=sk_SK"
            target="_blank" rel="noopener noreferrer">
            <svg class="social-icon" viewBox="0 0 24 24" aria-label="Facebook"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z"/></svg>
            <span>Facebook</span>
          </a>
          <a class="social-link" href="https://www.instagram.com/zborci.zborki?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
            target="_blank" rel="noopener noreferrer">
            <svg class="social-icon" viewBox="0 0 24 24" aria-label="Instagram"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span>Instagram</span>
          </a>
          <a class="social-link suggest-link"
            href="https://docs.google.com/forms/d/e/1FAIpQLSdm67o9SdU01zsX2PusxeIT-sIwaZYUKJrj-Fi2I7r703Vg4Q/viewform"
            target="_blank" rel="noopener noreferrer">
            <span class="suggest-star">*</span> Предложи збор
          </a>
        </div>
      </footer>
      </div>
    </div>`);
}

// ── Стартување на игри ─────────────────────────────────────────────

/**
 * Што прави: Повикува соодветна функција за почеток на играта
 * Параметри: gameId (стринг - која игра да се стартува)
 * Враќа: ништо
 */
function startGame(gameId) {
  const cat = loadCategory();
  // Провери кое ID е избрано и пушти ја играта
  if      (gameId === 'match')       initMatch(cat);
  else if (gameId === 'truefalse')   initTrueFalse(cat);
  else if (gameId === 'hangman')     initHangman(cat);
  else if (gameId === 'quiz')        initQuiz(cat);
  else if (gameId === 'speedround')  initSpeedRound(cat);
  else if (gameId === 'wordbuilder') initWordBuilder(cat);
  else if (gameId === 'memoryflip')  initMemoryFlip(cat);
  else if (gameId === 'fasttyping')  initFastTyping(cat);
}

// ── Резултати ────────────────────────────────────────────────────

/**
 * Што прави: Прикажува екран со резултатот од завршената игра
 * Параметри: score (број - освоени поени), game (стринг - која игра)
 * Враќа: ништо
 */
function showResult(score, game) {
  const prev  = loadBest(game);
  const isNew = score > prev; // Провери дали е поставен нов рекорд

  syncScore(game, score); // Ажурирај најдобар резултат во база
  saveBest(game, score);

  // ── Earn coins ──────────────────────────────────────────────
  const premiumIds    = ['wordbuilder', 'memoryflip', 'fasttyping'];
  const isPremium     = premiumIds.includes(game);
  const coinsEarned   = Math.max(1, Math.floor(score / (isPremium ? 3 : 5)));
  if (typeof addCoins === 'function') addCoins(coinsEarned);

  const names = {
    match:       'Спој го зборот',
    truefalse:   'Точно или Неточно',
    hangman:     'Збор по збор',
    quiz:        'Кој збор е тоа',
    speedround:  'Брза Рунда',
    wordbuilder: 'Слогалица',
    memoryflip:  'Меморија',
    fasttyping:  'Брзопис',
  };

  // Постави различно емоџи зависно од освоените поени
  const resultEmoji = score >= 100 ? '🏆' : score >= 50 ? '⭐' : '💪';

  showScreen(`
    <div class="result-screen">
      <div class="result-emoji">${resultEmoji}</div>
      <h2 class="result-title">Играта заврши!</h2>
      <div class="result-game">${names[game] || game}</div>
      <div class="result-score">${score}<span class="pts-label"> поени</span></div>
      ${isNew
        ? '<div class="result-new">* Нов рекорд!</div>'
        : `<div class="result-prev">Твој рекорд: ${prev} поени</div>`}
      <div class="result-coins-earned" id="result-coins-earned">+${coinsEarned} 🪙 монети</div>
      <div class="result-btns">
        <button class="btn-primary"   onclick="startGame('${game}')">Играј повторно</button>
        <button class="btn-secondary" onclick="showHub()">Кон игри</button>
      </div>
    </div>`);

  // Animate coin reward after render
  setTimeout(() => {
    const earnedEl = document.getElementById('result-coins-earned');
    if (typeof animateCoinReward === 'function') animateCoinReward(coinsEarned, earnedEl);
  }, 350);
}

// ── Правила и упатство ────────────────────────────────────────────────────
window.showHowToPlay = function() {
  const cat = loadCategory && loadCategory();
  if (cat) {
    const wasDark = document.body.classList.contains('theme-dark');
    document.body.className = getThemeClass(cat);
    if (wasDark) document.body.classList.add('theme-dark');
  }
  showScreen(`
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="(typeof currentUser!=='undefined'&&currentUser)?showHub():showAuthScreen('login')">✕</button>
        <span class="bar-title">❓ Правила &amp; Упатство</span>
      </div>
      <div class="how-to-screen">

        <div class="htp-intro">
          <div class="htp-logo">${LOGO}</div>
          <p class="htp-tagline">Учи македонски зборови &mdash; играј, освојувај, напредувај!</p>
        </div>

        <div class="htp-section">
          <h3 class="htp-heading">🎮 Режими на игра</h3>
          <div class="htp-games">
            <div class="htp-game">
              <span class="htp-icon card-teal">🔗</span>
              <div class="htp-game-info">
                <strong>Спој го зборот</strong>
                <p>Поврзи ги зборовите со нивните дефиниции пред да истече времето. Колку побрзо — толку повеќе поени!</p>
              </div>
            </div>
            <div class="htp-game">
              <span class="htp-icon card-lavender">✓✗</span>
              <div class="htp-game-info">
                <strong>Точно или Неточно</strong>
                <p>Прочитај го зборот и дефиницијата — одлучи дали е точно или неточно за 60 секунди.</p>
              </div>
            </div>
            <div class="htp-game">
              <span class="htp-icon card-dark">⭐</span>
              <div class="htp-game-info">
                <strong>Збор по збор</strong>
                <p>Погоди го скриениот збор буква по буква. Имаш само 6 обиди — грешките бројат!</p>
              </div>
            </div>
            <div class="htp-game">
              <span class="htp-icon card-orange">❓</span>
              <div class="htp-game-info">
                <strong>Кој збор е тоа</strong>
                <p>Прочитај ја дефиницијата и избери точниот збор меѓу 4 понудени одговори.</p>
              </div>
            </div>
            <div class="htp-game">
              <span class="htp-icon card-speed">⚡</span>
              <div class="htp-game-info">
                <strong>Брза Рунда</strong>
                <p>60 секунди, максимален темпо! Одговори Точно/Неточно — колку поодговори, толку повеќе поени.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="htp-section">
          <h3 class="htp-heading">🔒 Игри за отклучување со монети</h3>
          <p class="htp-unlock-note">Собирај монети играјќи ги основните игри и отклучи ги овие напредни режими!</p>
          <div class="htp-games">
            <div class="htp-game">
              <span class="htp-icon card-gold">🧩</span>
              <div class="htp-game-info">
                <strong>Слогалица <span class="htp-cost">🪙 30</span></strong>
                <p>Сложи ги слоговите во точниот редослед за да го формираш зборот според дефиницијата. Брзината носи бонус поени!</p>
              </div>
            </div>
            <div class="htp-game">
              <span class="htp-icon card-crimson">🃏</span>
              <div class="htp-game-info">
                <strong>Меморија <span class="htp-cost">🪙 60</span></strong>
                <p>Свртувај карти и спарувај зборови со нивните дефиниции. Тестирај ја меморијата — помалку свртувања, повеќе поени!</p>
              </div>
            </div>
            <div class="htp-game">
              <span class="htp-icon card-electric">⌨️</span>
              <div class="htp-game-info">
                <strong>Брзопис <span class="htp-cost">🪙 100</span></strong>
                <p>Напиши го зборот во 60 секунди, колку побрзо — толку повеќе поени. Секоја точна буква е важна!</p>
              </div>
            </div>
          </div>
        </div>

        <div class="htp-section">
          <h3 class="htp-heading">📊 Поени, монети и напредок</h3>
          <div class="htp-tips">
            <div class="htp-tip"><span class="htp-tip-icon">⭐</span><span>Освојуваш <strong>поени</strong> со секој точен одговор — рекордот се чува автоматски</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">🪙</span><span>Добиваш <strong>монети</strong> по секоја игра — трошете ги за теми, рамки и нови игри</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">🔥</span><span>Играј секој ден за да го зголемиш <strong>стрикот</strong> и да освоиш бонус монети</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">🏆</span><span>Споредувај ги своите резултати со другите на <strong>Табелата</strong></span></div>
          </div>
        </div>

        <div class="htp-section">
          <h3 class="htp-heading">📚 Категории на тежина</h3>
          <div class="htp-tips">
            <div class="htp-tip"><span class="htp-tip-icon">🌱</span><span><strong>Млади (7–12)</strong> — едноставни зборови за деца</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">📖</span><span><strong>Средно (13–17)</strong> — зборови со средна тежина</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">🧠</span><span><strong>Напредно (18+)</strong> — потешки македонски зборови</span></div>
          </div>
        </div>

        <div class="htp-section">
          <h3 class="htp-heading">🎨 Козметика и теми</h3>
          <div class="htp-tips">
            <div class="htp-tip"><span class="htp-tip-icon">🎨</span><span>Отклучи <strong>уникатни теми</strong> — од Охриd до Ноќно Езеро</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">✨</span><span>Купи <strong>рамки</strong> за твојот аватар со монети</span></div>
            <div class="htp-tip"><span class="htp-tip-icon">👤</span><span>Избери <strong>фолклорен аватар</strong> за уникатен идентитет</span></div>
          </div>
        </div>

        <div class="htp-cta">
          <button class="btn-primary htp-start-btn" onclick="(typeof currentUser!=='undefined'&&currentUser)?showHub():showAuthScreen('login')">
            🎮 Кон игрите →
          </button>
        </div>
      </div>
    </div>`);
};

// ── Почетно стартување ─────────────────────────────────────────────────────
initAuth();
