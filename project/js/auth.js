// ── auth.js — Firebase Authentication ────────────────────────
// Глобален корисник — се користи во повеќе фајлови
let currentUser = null;

// HTML за логото — се користи на повеќе екрани
const LOGO = `<span class="logo-zbor">Збор</span><span class="logo-ci">ци<span class="logo-star">*</span></span>`;

// Редоследен број — спречува конфликти при брзо логирање/одјавување
let _authSeq = 0;
let _signupSelectedAvatar = '';

// ── Грешки на македонски јазик ──────────────────────────────
const AUTH_ERRORS = {
  'auth/email-already-in-use':  'Оваа е-пошта е веќе регистрирана.',
  'auth/weak-password':          'Лозинката е прекратка.',
  'auth/wrong-password':         'Погрешна лозинка.',
  'auth/user-not-found':         'Нема корисник со оваа е-пошта.',
  'auth/invalid-email':          'Невалидна е-пошта адреса.',
  'auth/too-many-requests':      'Премногу обиди. Почекај малку и обиди се пак.',
  'auth/network-request-failed': 'Проблем со интернет врска.',
  'auth/invalid-credential':     'Погрешна е-пошта или лозинка.',
  'auth/missing-password':       'Внеси лозинка.',
  'auth/user-disabled':          'Оваа сметка е деактивирана.',
  'auth/operation-not-allowed':  'Оваа метода за пристап не е дозволена.',
  'auth/requires-recent-login':  'За ова треба да се логираш повторно.',
};

/**
 * Што прави: Враќа порака за грешка на македонски според кодот од Firebase
 * Параметри: code (стринг - код на грешка)
 * Враќа: стринг (порака за грешка)
 */
function authErrorMsg(code) {
  return AUTH_ERRORS[code] || 'Нешто тргна наопаку. Обиди се пак.';
}

// ── Валидации ───────────────────────────────────────

/**
 * Што прави: Проверува дали е-поштата е во валиден формат
 * Параметри: email (стринг)
 * Враќа: булова вредност (дали е точна)
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

/**
 * Што прави: Проверува дали лозинката има барем 8 знаци и 1 број
 * Параметри: pw (стринг - лозинка)
 * Враќа: булова вредност (дали е јака)
 */
function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && /\d/.test(pw);
}

// ── Иницијализација ───────────────────────────

/**
 * Што прави: Следи дали корисникот е најавен преку Firebase
 * Параметри: нема
 * Враќа: ништо
 */
function initAuth() {
  firebase.auth().onAuthStateChanged(async (user) => {
    // Бележиме редоследен број за овој настан
    const seq = ++_authSeq;

    if (user) {
      // Постави го корисникот веднаш
      currentUser = user;

      // Вчитај ги основните податоци од Firebase
      await loadUserFromFirestore(user.uid);

      // Прекини ако меѓувреме се случил нов настан
      if (seq !== _authSeq) return;

      // Оди во мени ако веќе има избрано категорија
      if (loadCategory()) {
        showHub();
      } else {
        showAgeSelect();
      }
    } else {
      currentUser = null;
      if (seq !== _authSeq) return;
      if (typeof chatStop === 'function') chatStop();
      showAuthScreen('login');
    }
  });
}

// ── Вчитување од база ──────────────────────────────────

/**
 * Што прави: Вчитува профил и поени од Firestore и ги чува локално
 * Параметри: uid (стринг - ID на корисник)
 * Враќа: ништо (асинхрона функција)
 */
async function loadUserFromFirestore(uid) {
  // Исчисти стари податоци за да не се мешаат
  clearUserLocalStorage(uid);

  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const d = doc.data();
      if (d.displayName) savePlayerName(d.displayName);
      if (d.category)    saveCategory(d.category);

      // Синхронизирање на поените од базата локално
      localStorage.setItem(`zb_${uid}_total`,            String(d.score          || 0));
      localStorage.setItem(`zb_${uid}_best_match`,        String(d.best_match     || 0));
      localStorage.setItem(`zb_${uid}_best_truefalse`,    String(d.best_truefalse || 0));
      localStorage.setItem(`zb_${uid}_best_hangman`,      String(d.best_hangman   || 0));
      localStorage.setItem(`zb_${uid}_best_quiz`,         String(d.best_quiz        || 0));
      localStorage.setItem(`zb_${uid}_best_speedround`,   String(d.best_speedround  || 0));
      if (d.avatarId) localStorage.setItem(`zb_${uid}_avatar`, d.avatarId);
    }
  } catch (err) {
    console.warn('[Auth] Firestore load failed:', err.code || 'unknown');
  }
}

// ── Екран за најава и регистрација ───────────────────────────────────────────────

/**
 * Што прави: Го прикажува екранот за најава, регистрација или заборавена лозинка
 * Параметри: tab (стринг - 'login', 'signup', 'forgot')
 * Враќа: ништо
 */
function showAuthScreen(tab = 'login') {
  _signupSelectedAvatar = '';
  document.body.className = '';

  // Вметни HTML за формата
  showScreen(`
    <div class="auth-screen">
      <div class="auth-brand">
        <h1 class="logo">${LOGO}</h1>
        <p class="logo-sub">Македонски зборови &mdash; учи преку игра</p>
      </div>

      <div class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab${tab === 'login'  ? ' active' : ''}" onclick="authSwitchTab('login')">Влез</button>
          <button class="auth-tab${tab === 'signup' ? ' active' : ''}" onclick="authSwitchTab('signup')">Регистрирај се</button>
        </div>

        <!-- Најава (Log In) -->
        <div id="auth-login" class="auth-form"${tab !== 'login' ? ' style="display:none"' : ''}>
          <input class="auth-input" type="email"    id="login-email"
            placeholder="Е-пошта" autocomplete="email"
            onkeydown="if(event.key==='Enter') handleLogIn()">
          <input class="auth-input" type="password" id="login-password"
            placeholder="Лозинка" autocomplete="current-password"
            onkeydown="if(event.key==='Enter') handleLogIn()">
          <div id="login-error" class="auth-error"></div>
          <button class="btn-primary auth-submit" id="login-btn" onclick="handleLogIn()">Влез →</button>
          <button type="button" class="btn-secondary auth-submit" onclick="handleGoogleLogin()" style="margin-top: 8px;">🌍 Најава со Google</button>
          <button class="forgot-link" onclick="authSwitchTab('forgot')">Заборавена лозинка?</button>
        </div>

        <!-- Регистрација (Sign Up) -->
        <div id="auth-signup" class="auth-form"${tab !== 'signup' ? ' style="display:none"' : ''}>
          <input class="auth-input" type="text"     id="signup-name"
            placeholder="Прекар / Ime" autocomplete="nickname" maxlength="20"
            onkeydown="if(event.key==='Enter') handleSignUp()">
          <input class="auth-input" type="email"    id="signup-email"
            placeholder="Е-пошта" autocomplete="email"
            onkeydown="if(event.key==='Enter') handleSignUp()">
          <input class="auth-input" type="password" id="signup-password"
            placeholder="Лозинка (мин. 8 знаци + 1 број)" autocomplete="new-password"
            onkeydown="if(event.key==='Enter') handleSignUp()">
          <div id="signup-error" class="auth-error"></div>
          <div class="avatar-select-wrap">
            <p class="avatar-select-label"><span class="star-accent">*</span> Избери аватар</p>
            <div class="avatar-select-grid">
              <button type="button" class="avatar-option" data-av="avatar1" onclick="selectSignupAvatar('avatar1')"></button>
              <button type="button" class="avatar-option" data-av="avatar2" onclick="selectSignupAvatar('avatar2')"></button>
              <button type="button" class="avatar-option" data-av="avatar3" onclick="selectSignupAvatar('avatar3')"></button>
              <button type="button" class="avatar-option" data-av="avatar4" onclick="selectSignupAvatar('avatar4')"></button>
              <button type="button" class="avatar-option" data-av="avatar5" onclick="selectSignupAvatar('avatar5')"></button>
              <button type="button" class="avatar-option" data-av="avatar6" onclick="selectSignupAvatar('avatar6')"></button>
            </div>
            <p class="avatar-hint" id="avatar-hint">Избери аватар за да се регистрираш</p>
          </div>
          <button class="btn-primary auth-submit" id="signup-btn" disabled onclick="handleSignUp()">Регистрирај се →</button>
          <button type="button" class="btn-secondary auth-submit" onclick="handleGoogleLogin()" style="margin-top: 8px;">🌍 Најава со Google</button>
        </div>

        <!-- Заборавена лозинка -->
        <div id="auth-forgot" class="auth-form"${tab !== 'forgot' ? ' style="display:none"' : ''}>
          <p class="auth-hint">Внеси ја е-поштата за ресетирање:</p>
          <input class="auth-input" type="email" id="forgot-email"
            placeholder="Е-пошта" autocomplete="email"
            onkeydown="if(event.key==='Enter') handleForgotPassword()">
          <div id="forgot-msg" class="auth-error"></div>
          <button class="btn-primary auth-submit" id="forgot-btn" onclick="handleForgotPassword()">Испрати линк 📧</button>
          <button class="forgot-link" onclick="authSwitchTab('login')">← Назад кон влез</button>
        </div>
      </div>
      <div class="auth-guest-wrap">
        <div class="auth-divider"><span>или</span></div>
        <button class="btn-guest" onclick="playAsGuest()">🎮 Играј анонимно</button>
        <p class="auth-guest-note">Резултатите нема да бидат зачувани во табелата</p>
      </div>
    </div>`);

  // Фокусирај на првото поле
  setTimeout(() => {
    const first = document.querySelector('.auth-form:not([style]) .auth-input');
    if (first) first.focus();
  }, 80);
}

/**
 * Што прави: Менува јазичиња на екранот за најава
 * Параметри: tab (стринг)
 * Враќа: ништо
 */
window.authSwitchTab = function(tab) { showAuthScreen(tab); };

/**
 * Што прави: Го вклучува режимот за гости без најавување
 * Параметри: нема
 * Враќа: ништо
 */
window.playAsGuest = function() {
  if (!localStorage.getItem('zb_anon_name')) {
    localStorage.setItem('zb_anon_name', 'Гостин');
  }
  showAgeSelect();
};

/**
 * Што прави: Избира аватар при регистрација
 * Параметри: avatarId (стринг - ID на слика)
 * Враќа: ништо
 */
window.selectSignupAvatar = function(avatarId) {
  _signupSelectedAvatar = avatarId;
  document.querySelectorAll('.avatar-option').forEach(el =>
    el.classList.toggle('av-selected', el.dataset.av === avatarId)
  );
  // Овозможи го копчето за регистрација
  const btn  = document.getElementById('signup-btn');
  const hint = document.getElementById('avatar-hint');
  if (btn)  btn.disabled = false;
  if (hint) { hint.style.color = ''; hint.style.fontWeight = ''; }
};

// ── Регистрација ───────────────────────────────────────────────────

/**
 * Што прави: Креира нова сметка преку Firebase и зачувува податоци
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.handleSignUp = async function() {
  const name     = document.getElementById('signup-name')?.value.trim();
  const email    = (document.getElementById('signup-email')?.value || '').trim();
  const password = document.getElementById('signup-password')?.value || '';
  const errEl    = document.getElementById('signup-error');
  const btn      = document.getElementById('signup-btn');

  if (errEl) errEl.textContent = '';

  // Валидации пред испраќање
  if (!name) {
    if (errEl) errEl.textContent = 'Внеси прекар.'; return;
  }
  if (!isValidEmail(email)) {
    if (errEl) errEl.textContent = 'Внеси валидна е-пошта адреса.'; return;
  }
  if (!isStrongPassword(password)) {
    if (errEl) errEl.textContent = 'Лозинката мора да има барем 8 знаци и еден број (0–9).'; return;
  }
  if (!_signupSelectedAvatar) {
    if (errEl) errEl.textContent = 'Избери аватар.';
    const hint = document.getElementById('avatar-hint');
    if (hint) { hint.style.color = 'var(--orange)'; hint.style.fontWeight = '700'; }
    return;
  }

  // Забрани повеќе кликања
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Се регистрира...'; }

  try {
    // 1. Креирај Firebase сметка
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // Зачувај локално привремено за да се прикаже веднаш
    localStorage.setItem(`zb_${uid}_name`, name);
    if (_signupSelectedAvatar) localStorage.setItem(`zb_${uid}_avatar`, _signupSelectedAvatar);

    // 2. Запиши го профилот во Firestore
    await db.collection('users').doc(uid).set({
      displayName:    name,
      category:       '',
      score:          0,
      best_match:     0,
      best_truefalse: 0,
      best_hangman:   0,
      best_quiz:       0,
      best_speedround: 0,
      streak:          0,
      lastPlayDate:   '',
      achievements:   {},
      avatarId:        _signupSelectedAvatar,
      createdAt:       firebase.firestore.FieldValue.serverTimestamp(),
    });
    localStorage.setItem(`zb_${uid}_avatar`, _signupSelectedAvatar);

  } catch (err) {
    // Прикажи македонска порака за грешка
    if (errEl) errEl.textContent = authErrorMsg(err.code);
    if (btn)   { btn.disabled = false; btn.textContent = 'Регистрирај се →'; }
  }
};

// ── Најава ────────────────────────────────────────────────────

/**
 * Што прави: Најавува постоечки корисник преку Firebase
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.handleLogIn = async function() {
  const email    = (document.getElementById('login-email')?.value || '').trim();
  const password = document.getElementById('login-password')?.value || '';
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (errEl) errEl.textContent = '';

  if (!isValidEmail(email)) {
    if (errEl) errEl.textContent = 'Внеси валидна е-пошта адреса.'; return;
  }
  if (!password) {
    if (errEl) errEl.textContent = 'Внеси лозинка.'; return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Влегување...'; }

  try {
    // Обид за најава
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    if (errEl) errEl.textContent = authErrorMsg(err.code);
    if (btn)   { btn.disabled = false; btn.textContent = 'Влез →'; }
  }
};

// ── Најава преку Google ────────────────────────────────────────────

/**
 * Што прави: Отвора прозорец за најава со Google сметка
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.handleGoogleLogin = async function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const errEl = document.getElementById('login-error') || document.getElementById('signup-error');
  const btns  = document.querySelectorAll('[onclick="handleGoogleLogin()"]');
  if (errEl) errEl.textContent = '';
  btns.forEach(b => { b.disabled = true; b.textContent = '⏳ Се поврзува...'; });

  try {
    const result = await firebase.auth().signInWithPopup(provider);
    const uid    = result.user.uid;
    const name   = (result.user.displayName || '').split(' ')[0] || 'Корисник';

    // Зачувај локално веднаш — onAuthStateChanged не чека на Firestore
    localStorage.setItem(`zb_${uid}_name`, name);

    // Создади документ само за нови корисници
    const existing = await db.collection('users').doc(uid).get();
    if (!existing.exists) {
      await db.collection('users').doc(uid).set({
        displayName:     name,
        category:        '',
        score:           0,
        best_match:      0,
        best_truefalse:  0,
        best_hangman:    0,
        best_quiz:       0,
        best_speedround: 0,
        streak:          0,
        lastPlayDate:    '',
        achievements:    {},
        avatarId:        '',
        createdAt:       firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
    // onAuthStateChanged → loadUserFromFirestore → showHub / showAgeSelect
  } catch (err) {
    if (errEl) errEl.textContent = authErrorMsg(err.code);
    btns.forEach(b => { b.disabled = false; b.textContent = '🌍 Најава со Google'; });
  }
};

// ── Ресетирање лозинка ───────────────────────────────────────────

/**
 * Што прави: Испраќа линк за ресетирање лозинка на внесената е-пошта
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.handleForgotPassword = async function() {
  const email = (document.getElementById('forgot-email')?.value || '').trim();
  const msgEl = document.getElementById('forgot-msg');
  const btn   = document.getElementById('forgot-btn');

  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'auth-error'; }

  if (!isValidEmail(email)) {
    if (msgEl) msgEl.textContent = 'Внеси валидна е-пошта адреса.'; return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    if (msgEl) {
      msgEl.textContent = '✅ Линкот е испратен! Провери ја е-поштата.';
      msgEl.className   = 'auth-success';
    }
  } catch (err) {
    if (msgEl) { msgEl.textContent = authErrorMsg(err.code); msgEl.className = 'auth-error'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Испрати линк 📧'; }
  }
};

// ── Одјава ───────────────────────────────────────────────────

/**
 * Што прави: Го одјавува корисникот
 * Параметри: нема
 * Враќа: ништо
 */
function handleLogOut() {
  if (typeof window._showLogoutConfirm === 'function') {
    window._showLogoutConfirm(); return;
  }
  const uid = currentUser?.uid;
  if (uid) clearUserLocalStorage(uid);
  firebase.auth().signOut();
}
window.handleLogOut = handleLogOut;
