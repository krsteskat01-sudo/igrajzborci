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
  // Apply saved cosmetic theme immediately on load (before auth resolves)
  if (typeof initCosmetics === 'function') initCosmetics();

  firebase.auth().onAuthStateChanged(async (user) => {
    // Бележиме редоследен број за овој настан
    const seq = ++_authSeq;

    if (user) {
      // Постави го корисникот веднаш
      currentUser = user;

      // Always sync Google photo URL from the auth object so every user's photo
      // is visible on the leaderboard — catches accounts created before
      // googlePhotoUrl was stored, and keeps the URL fresh if Google rotates it.
      if (user.photoURL) {
        if (typeof saveGooglePhotoUrl === 'function') saveGooglePhotoUrl(user.photoURL);
        if (typeof db !== 'undefined') {
          db.collection('users').doc(user.uid)
            .update({ googlePhotoUrl: user.photoURL })
            .catch(() => {});
        }
      }

      // Save avatarId BEFORE loadUserFromFirestore wipes localStorage, so we can
      // recover it if Firestore doesn't have the value yet (race condition: new
      // signup's Firestore write may not complete before onAuthStateChanged fires,
      // and clearUserLocalStorage inside loadUserFromFirestore erases the local value).
      const priorAvId = localStorage.getItem(`zb_${user.uid}_avatar`) || '';

      // Вчитај ги основните податоци од Firebase
      await loadUserFromFirestore(user.uid);

      // Restore and sync avatarId using priority: Firestore value > pre-clear
      // localStorage value > current signup selection (race condition fallback).
      if (typeof db !== 'undefined' && typeof loadAvatarId === 'function') {
        let avId = loadAvatarId();
        if (!avId) {
          avId = priorAvId || (typeof _signupSelectedAvatar === 'string' ? _signupSelectedAvatar : '');
          if (avId) localStorage.setItem(`zb_${user.uid}_avatar`, avId);
        }
        if (avId) {
          db.collection('users').doc(user.uid)
            .update({ avatarId: avId })
            .catch(() => {});
        }
      }

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
      const userData = doc.data();
      if (userData.displayName) savePlayerName(userData.displayName);
      if (userData.category)    saveCategory(userData.category);

      // Синхронизирање на поените од базата локално
      localStorage.setItem(`zb_${uid}_total`,            String(userData.score          || 0));
      localStorage.setItem(`zb_${uid}_best_match`,        String(userData.best_match     || 0));
      localStorage.setItem(`zb_${uid}_best_truefalse`,    String(userData.best_truefalse || 0));
      localStorage.setItem(`zb_${uid}_best_hangman`,      String(userData.best_hangman   || 0));
      localStorage.setItem(`zb_${uid}_best_quiz`,         String(userData.best_quiz         || 0));
      localStorage.setItem(`zb_${uid}_best_speedround`,   String(userData.best_speedround   || 0));
      localStorage.setItem(`zb_${uid}_best_wordbuilder`,  String(userData.best_wordbuilder  || 0));
      localStorage.setItem(`zb_${uid}_best_memoryflip`,   String(userData.best_memoryflip   || 0));
      localStorage.setItem(`zb_${uid}_best_fasttyping`,   String(userData.best_fasttyping   || 0));
      if (userData.unlocked_wordbuilder) localStorage.setItem(`zb_${uid}_unlock_wordbuilder`, '1');
      if (userData.unlocked_memoryflip)  localStorage.setItem(`zb_${uid}_unlock_memoryflip`,  '1');
      if (userData.unlocked_fasttyping)  localStorage.setItem(`zb_${uid}_unlock_fasttyping`,  '1');
      if (userData.avatarId) localStorage.setItem(`zb_${uid}_avatar`, userData.avatarId);
      if (userData.googlePhotoUrl && typeof saveGooglePhotoUrl === 'function') saveGooglePhotoUrl(userData.googlePhotoUrl);
      if (typeof userData.coins !== 'undefined') {
        localStorage.setItem(`zb_${uid}_coins`, String(Math.max(0, userData.coins || 0)));
      }
      if (typeof restoreCosmeticsFromFirestore === 'function') restoreCosmeticsFromFirestore(userData);
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

      <div class="auth-features">
        <div class="af-item">🎮<span>5+ игри</span></div>
        <div class="af-item">🏆<span>Рангирање</span></div>
        <div class="af-item">🎯<span>Мак. зборови</span></div>
        <div class="af-item">🪙<span>Монети</span></div>
        <div class="af-item">🎨<span>Теми</span></div>
      </div>
      <button class="auth-rules-btn" onclick="showHowToPlay ? showHowToPlay() : null">❓ Правила на игра</button>

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
            placeholder="Име" autocomplete="nickname" maxlength="20"
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
  const errorElement    = document.getElementById('signup-error');
  const submitButton      = document.getElementById('signup-btn');

  if (errorElement) errorElement.textContent = '';

  // Валидации пред испраќање
  if (!name) {
    if (errorElement) errorElement.textContent = 'Внеси прекар.'; return;
  }
  if (!isValidEmail(email)) {
    if (errorElement) errorElement.textContent = 'Внеси валидна е-пошта адреса.'; return;
  }
  if (!isStrongPassword(password)) {
    if (errorElement) errorElement.textContent = 'Лозинката мора да има барем 8 знаци и еден број (0–9).'; return;
  }
  if (!_signupSelectedAvatar) {
    if (errorElement) errorElement.textContent = 'Избери аватар.';
    const hint = document.getElementById('avatar-hint');
    if (hint) { hint.style.color = 'var(--orange)'; hint.style.fontWeight = '700'; }
    return;
  }

  // Забрани повеќе кликања
  if (submitButton) { submitButton.disabled = true; submitButton.textContent = '⏳ Се регистрира...'; }

  try {
    // 1. Креирај Firebase сметка
    const signUpResult = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const newUserId  = signUpResult.user.uid;

    // Зачувај локално привремено за да се прикаже веднаш
    localStorage.setItem(`zb_${newUserId}_name`, name);
    if (_signupSelectedAvatar) localStorage.setItem(`zb_${newUserId}_avatar`, _signupSelectedAvatar);

    // 2. Запиши го профилот во Firestore
    await db.collection('users').doc(newUserId).set({
      displayName:    name,
      category:       '',
      score:          0,
      best_match:     0,
      best_truefalse: 0,
      best_hangman:   0,
      best_quiz:       0,
      best_speedround:  0,
      best_wordbuilder: 0,
      best_memoryflip:  0,
      best_fasttyping:  0,
      streak:           0,
      lastPlayDate:     '',
      achievements:     {},
      avatarId:         _signupSelectedAvatar,
      createdAt:        firebase.firestore.FieldValue.serverTimestamp(),
    });
    localStorage.setItem(`zb_${newUserId}_avatar`, _signupSelectedAvatar);

  } catch (err) {
    // Прикажи македонска порака за грешка
    if (errorElement) errorElement.textContent = authErrorMsg(err.code);
    if (submitButton)   { submitButton.disabled = false; submitButton.textContent = 'Регистрирај се →'; }
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
  const errorElement    = document.getElementById('login-error');
  const submitButton      = document.getElementById('login-btn');

  if (errorElement) errorElement.textContent = '';

  if (!isValidEmail(email)) {
    if (errorElement) errorElement.textContent = 'Внеси валидна е-пошта адреса.'; return;
  }
  if (!password) {
    if (errorElement) errorElement.textContent = 'Внеси лозинка.'; return;
  }

  if (submitButton) { submitButton.disabled = true; submitButton.textContent = '⏳ Влегување...'; }

  try {
    // Обид за најава
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    if (errorElement) errorElement.textContent = authErrorMsg(err.code);
    if (submitButton)   { submitButton.disabled = false; submitButton.textContent = 'Влез →'; }
  }
};

// ── Најава преку Google ────────────────────────────────────────────

/**
 * Што прави: Отвора прозорец за најава со Google сметка
 * Параметри: нема
 * Враќа: ништо (асинхрона функција)
 */
window.handleGoogleLogin = async function() {
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  const errorElement = document.getElementById('login-error') || document.getElementById('signup-error');
  const googleButtons  = document.querySelectorAll('[onclick="handleGoogleLogin()"]');
  if (errorElement) errorElement.textContent = '';
  googleButtons.forEach(b => { b.disabled = true; b.textContent = '⏳ Се поврзува...'; });

  try {
    const result = await firebase.auth().signInWithPopup(googleProvider);
    const newUserId  = result.user.uid;
    const name       = (result.user.displayName || '').split(' ')[0] || 'Корисник';
    const photoUrl   = result.user.photoURL || '';

    // Зачувај локално веднаш — onAuthStateChanged не чека на Firestore
    localStorage.setItem(`zb_${newUserId}_name`, name);
    if (photoUrl && typeof saveGooglePhotoUrl === 'function') saveGooglePhotoUrl(photoUrl);

    // Создади документ само за нови корисници
    const existing = await db.collection('users').doc(newUserId).get();
    if (!existing.exists) {
      await db.collection('users').doc(newUserId).set({
        displayName:     name,
        category:        '',
        score:           0,
        best_match:      0,
        best_truefalse:  0,
        best_hangman:    0,
        best_quiz:       0,
        best_speedround:  0,
        best_wordbuilder: 0,
        best_memoryflip:  0,
        best_fasttyping:  0,
        streak:           0,
        lastPlayDate:     '',
        achievements:     {},
        avatarId:         '',
        googlePhotoUrl:   photoUrl,
        createdAt:        firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else if (photoUrl) {
      // Always refresh the photo URL — Google URLs can change between logins
      await db.collection('users').doc(newUserId).update({ googlePhotoUrl: photoUrl });
    }
    // onAuthStateChanged → loadUserFromFirestore → showHub / showAgeSelect
  } catch (err) {
    if (errorElement) errorElement.textContent = authErrorMsg(err.code);
    googleButtons.forEach(b => { b.disabled = false; b.textContent = '🌍 Најава со Google'; });
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
  const messageElement = document.getElementById('forgot-msg');
  const resetButton   = document.getElementById('forgot-btn');

  if (messageElement) { messageElement.textContent = ''; messageElement.className = 'auth-error'; }

  if (!isValidEmail(email)) {
    if (messageElement) messageElement.textContent = 'Внеси валидна е-пошта адреса.'; return;
  }

  if (resetButton) { resetButton.disabled = true; resetButton.textContent = '⏳'; }

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    if (messageElement) {
      messageElement.textContent = '✅ Линкот е испратен! Провери ја е-поштата.';
      messageElement.className   = 'auth-success';
    }
  } catch (err) {
    if (messageElement) { messageElement.textContent = authErrorMsg(err.code); messageElement.className = 'auth-error'; }
  } finally {
    if (resetButton) { resetButton.disabled = false; resetButton.textContent = 'Испрати линк 📧'; }
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
