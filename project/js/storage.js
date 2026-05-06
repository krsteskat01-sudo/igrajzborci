// ── storage.js ────────────────────────────────────────────────
// Податоците се зачувуваат со префикс од ID на корисникот (UID)
// за да не се мешаат податоци од различни сметки.

/**
 * Што прави: Враќа ID на моменталниот корисник или 'anon' ако е гостин
 * Параметри: нема
 * Враќа: стринг (UID)
 */
function _uid() {
  return (typeof currentUser !== 'undefined' && currentUser && currentUser.uid)
    ? currentUser.uid
    : 'anon';
}

/**
 * Што прави: Ја зачувува избраната тежинска категорија во локална меморија
 * Параметри: cat (стринг - категорија)
 * Враќа: ништо
 */
function saveCategory(cat) { localStorage.setItem(`zb_${_uid()}_cat`, cat); }

/**
 * Што прави: Ја вчитува избраната категорија
 * Параметри: нема
 * Враќа: стринг
 */
function loadCategory()    { return localStorage.getItem(`zb_${_uid()}_cat`) || ''; }

/**
 * Што прави: Зачувува најдобар резултат ако е поголем од претходниот
 * Параметри: game (стринг - ime на игра), score (број - поени)
 * Враќа: ништо
 */
function saveBest(game, score) {
  const key = `zb_${_uid()}_best_${game}`;
  if (score > (parseInt(localStorage.getItem(key)) || 0)) localStorage.setItem(key, score);
}

/**
 * Што прави: Вчитува најдобар резултат за дадена игра
 * Параметри: game (стринг - ime на игра)
 * Враќа: број (најдобар резултат)
 */
function loadBest(game) { return parseInt(localStorage.getItem(`zb_${_uid()}_best_${game}`)) || 0; }

/**
 * Што прави: Додава поени кон вкупниот резултат
 * Параметри: points (број - колку поени да се додадат)
 * Враќа: ништо
 */
function saveTotal(points) {
  const key = `zb_${_uid()}_total`;
  localStorage.setItem(key, (parseInt(localStorage.getItem(key)) || 0) + points);
}

/**
 * Што прави: Вчитува вкупен резултат
 * Параметри: нема
 * Враќа: број (вкупни поени)
 */
function loadTotal() { return parseInt(localStorage.getItem(`zb_${_uid()}_total`)) || 0; }

/**
 * Што прави: Зачувува ime/прекар на играчот
 * Параметри: name (стринг)
 * Враќа: ништо
 */
function savePlayerName(name) { localStorage.setItem(`zb_${_uid()}_name`, name); }

/**
 * Што прави: Вчитува ime/прекар
 * Параметри: нема
 * Враќа: стринг
 */
function loadPlayerName()     { return localStorage.getItem(`zb_${_uid()}_name`) || ''; }

/**
 * Што прави: Зачувува ID на избран аватар
 * Параметри: id (стринг)
 * Враќа: ништо
 */
function saveAvatarId(id) { localStorage.setItem(`zb_${_uid()}_avatar`, id); }

/**
 * Што прави: Вчитува ID на избран аватар
 * Параметри: нема
 * Враќа: стринг
 */
function loadAvatarId()   { return localStorage.getItem(`zb_${_uid()}_avatar`) || ''; }

/**
 * Што прави: Ги брише сите локални податоци за корисникот (при одјава)
 * Параметри: uid (стринг - ID на корисник)
 * Враќа: ништо
 */
function clearUserLocalStorage(uid) {
  if (!uid) return;
  ['cat', 'name', 'total',
   'best_match', 'best_truefalse', 'best_hangman', 'best_quiz', 'best_speedround',
   'best_wordbuilder', 'best_memoryflip', 'best_fasttyping',
   'unlock_wordbuilder', 'unlock_memoryflip', 'unlock_fasttyping',
   'avatar', 'cos_settings', 'cos_owned', 'coins']
    .forEach(storageKey => localStorage.removeItem(`zb_${uid}_${storageKey}`));
}

// ── Coins (spendable balance) ──────────────────────────────────
/**
 * Враќа тековниот баланс на монети на играчот.
 */
function loadCoins() {
  return parseInt(localStorage.getItem(`zb_${_uid()}_coins`)) || 0;
}

/**
 * Зачувува нов баланс на монети (не оди под 0).
 */
function saveCoins(amount) {
  const amt = Math.max(0, Math.floor(amount));
  localStorage.setItem(`zb_${_uid()}_coins`, String(amt));
  return amt;
}

/**
 * Додава монети на балансот и ги синхронизира со Firestore.
 */
function addCoins(amount) {
  if (!amount || amount <= 0) return loadCoins();
  const newBalance = saveCoins(loadCoins() + amount);
  _pushCoinsToFirestore(newBalance);
  return newBalance;
}

/**
 * Одзема монети ако балансот е доволен. Враќа true ако успешно.
 */
function spendCoins(amount) {
  const current = loadCoins();
  if (current < amount) return false;
  const newBalance = saveCoins(current - amount);
  _pushCoinsToFirestore(newBalance);
  return true;
}

function _pushCoinsToFirestore(balance) {
  if (typeof db === 'undefined' || typeof currentUser === 'undefined' || !currentUser) return;
  db.collection('users').doc(currentUser.uid)
    .set({ coins: balance }, { merge: true })
    .catch(() => {});
}

// Стари функции за компатибилност (не се користат)
function savePlayerId(id) { localStorage.setItem('zb_pid', id); }
function loadPlayerId()   { return localStorage.getItem('zb_pid') || ''; }
function generatePlayerId() {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  savePlayerId(id);
  return id;
}
