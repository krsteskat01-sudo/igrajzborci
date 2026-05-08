// ── cosmetics.js — Macedonia-themed skins, frames, folk avatars ──
// Cosmetics are purchased by SPENDING coins (spendCoins in storage.js).
// Ownership is permanent once bought; coins are deducted at purchase.

const COSMETIC_CATALOG = {
  themes: [
    { id: 'default',            name: 'Оригинален',           icon: '🎨', cost: 0,   desc: 'Класичниот Зборци изглед',                swatch: '' },
    { id: 'ohrid-sunset',       name: 'Охрид Зајдисонце',     icon: '🌅', cost: 10,  desc: 'Топли тонови на охридскиот зајдисонце',   swatch: 'swatch-ohrid-sunset' },
    { id: 'mountain-village',   name: 'Планинско Село',       icon: '⛰️', cost: 15,  desc: 'Свежи земни тонови на планината',         swatch: 'swatch-mountain-village' },
    { id: 'retro-yugoslav',     name: 'Ретро Југо',           icon: '📼', cost: 25,  desc: 'Носталгичен стил на 80-тите',             swatch: 'swatch-retro-yugoslav' },
    { id: 'balkan-folklore',    name: 'Балкански Фолклор',    icon: '🎭', cost: 40,  desc: 'Богати фолклорни бои и шари',             swatch: 'swatch-balkan-folklore' },
    { id: 'lake-night',         name: 'Ноќно Езеро',          icon: '🌙', cost: 60,  desc: 'Мирна сина палета на ноќното езеро',      swatch: 'swatch-lake-night' },
  ],
  frames: [
    { id: 'none',           name: 'Без рамка',       icon: '○',  cost: 0,   desc: 'Оди без рамка' },
    { id: 'mountain-pine',  name: 'Планинска Рамка', icon: '🌲', cost: 20,  desc: 'Природна рамка со борови' },
    { id: 'gold-ornament',  name: 'Злато Рамка',     icon: '✨', cost: 35,  desc: 'Орнаментална пулсирачка рамка' },
    { id: 'folklore-weave', name: 'Фолклорна Рамка', icon: '🎨', cost: 55,  desc: 'Тристрана везена рамка' },
    { id: 'neon-glow',      name: 'Неон Блесок',     icon: '💫', cost: 70,  desc: 'Светечка неонска рамка' },
  ],
  avatars: [
    { id: 'none',        name: 'Стандарден',    icon: '👤', cost: 0,  desc: 'Тековниот аватар' },
    { id: 'folklore-1',  name: 'Везена Маска',  icon: '🎭', cost: 25, desc: 'Народна фолклорна маска' },
    { id: 'folklore-2',  name: 'Охридско Небо', icon: '🌊', cost: 35, desc: 'Сината палета на езерото' },
    { id: 'folklore-3',  name: 'Шумски Орел',   icon: '🦅', cost: 55, desc: 'Македонскиот орел' },
  ],
};

const DARK_THEMES = new Set(['lake-night']);

// ── Storage helpers ────────────────────────────────────────────
function _cosKey(suffix) { return `zb_${_uid()}_cos_${suffix}`; }

function loadCosmeticSettings() {
  try { return JSON.parse(localStorage.getItem(_cosKey('settings')) || '{}'); }
  catch { return {}; }
}
function saveCosmeticSettings(settings) {
  localStorage.setItem(_cosKey('settings'), JSON.stringify(settings));
  if (typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
    // Use dotted field paths so Firestore surgically updates each sub-key without
    // replacing the entire cosmeticSettings object (merge:true only merges top-level
    // fields — it would wipe avatar/frame/theme keys not present in settings).
    db.collection('users').doc(currentUser.uid)
      .update({
        'cosmeticSettings.theme':  settings.theme  || 'default',
        'cosmeticSettings.badge':  settings.badge  || 'none',
        'cosmeticSettings.frame':  settings.frame  || 'none',
        'cosmeticSettings.avatar': settings.avatar || 'none',
        selectedSkin:    settings.theme  || 'default',
        selectedBadge:   settings.badge  || 'none',
        selectedFrame:   settings.frame  || 'none',
        selectedAvatar:  settings.avatar || 'none',
      }).catch(() => {});
  }
}

function loadOwnedCosmetics() {
  try { return new Set(JSON.parse(localStorage.getItem(_cosKey('owned')) || '[]')); }
  catch { return new Set(); }
}
function saveOwnedCosmetics(owned) {
  const arr = [...owned];
  localStorage.setItem(_cosKey('owned'), JSON.stringify(arr));
  if (typeof db !== 'undefined' && typeof currentUser !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid)
      .set({ ownedCosmetics: arr }, { merge: true }).catch(() => {});
  }
}

// Ownership check: free items always owned; paid items only if in owned set
function isCosmeticOwned(itemId) {
  if (itemId === 'default' || itemId === 'none') return true;
  const item = _findItem(itemId);
  if (!item || item.cost === 0) return true;
  return loadOwnedCosmetics().has(itemId);
}

function _findItem(id) {
  for (const cat of Object.values(COSMETIC_CATALOG)) {
    const item = cat.find(i => i.id === id);
    if (item) return item;
  }
  return null;
}

// ── Apply active theme to document ────────────────────────────
function applyCosmeticTheme(themeId) {
  document.body.setAttribute('data-theme', themeId || 'default');
  DARK_THEMES.has(themeId)
    ? document.body.classList.add('theme-dark')
    : document.body.classList.remove('theme-dark');
}

// ── Active cosmetic helpers (called from app.js hub) ──────────
function getActiveFrameClass() {
  const frameId = loadCosmeticSettings().frame || 'none';
  if (frameId === 'none' || !isCosmeticOwned(frameId)) return '';
  return 'frame-' + frameId;
}

function getActiveFolkAvatarClass() {
  const avId = loadCosmeticSettings().avatar || 'none';
  if (avId === 'none' || !isCosmeticOwned(avId)) return '';
  return 'av-' + avId;
}

// ── Init: apply saved theme on load ───────────────────────────
function initCosmetics() {
  const settings = loadCosmeticSettings();
  if (settings.theme) applyCosmeticTheme(settings.theme);
}
window.initCosmetics = initCosmetics;

// ── Restore cosmetics from Firestore user data ────────────────
function restoreCosmeticsFromFirestore(userData) {
  if (!userData) return;
  const uid = typeof _uid === 'function' ? _uid() : 'anon';
  if (userData.cosmeticSettings) {
    localStorage.setItem(`zb_${uid}_cos_settings`, JSON.stringify(userData.cosmeticSettings));
    if (userData.cosmeticSettings.theme) applyCosmeticTheme(userData.cosmeticSettings.theme);
  }
  if (Array.isArray(userData.ownedCosmetics)) {
    localStorage.setItem(`zb_${uid}_cos_owned`, JSON.stringify(userData.ownedCosmetics));
  }
}
window.restoreCosmeticsFromFirestore = restoreCosmeticsFromFirestore;

// ══════════════════════════════════════════════════════════════
//  SHOP UI
// ══════════════════════════════════════════════════════════════
let _cosTab      = 'themes';
let _cosSelected = null;

window.showCosmeticsShop = function(tab) {
  _cosTab      = tab || 'themes';
  _cosSelected = null;
  _renderCosmeticsShop();
};

function _catKey(tab) {
  return { themes: 'theme', frames: 'frame', avatars: 'avatar' }[tab] || 'theme';
}

function _renderCosmeticsShop() {
  const coins    = typeof loadCoins === 'function' ? loadCoins() : 0;
  const settings = loadCosmeticSettings();
  const active   = settings[_catKey(_cosTab)] || (_cosTab === 'themes' ? 'default' : 'none');

  const tabsHtml = [
    { id: 'themes',  label: 'Теми',    icon: '🎨' },
    { id: 'frames',  label: 'Рамки',   icon: '✨' },
    { id: 'avatars', label: 'Аватари', icon: '👤' },
  ].map(t =>
    `<button class="cosmetics-tab${_cosTab === t.id ? ' ct-active' : ''}"
      onclick="showCosmeticsShop('${t.id}')">${t.icon} ${t.label}</button>`
  ).join('');

  const itemsHtml = (COSMETIC_CATALOG[_cosTab] || []).map(item => {
    const owned    = isCosmeticOwned(item.id);
    const isActive = item.id === active;
    const isSel    = item.id === _cosSelected;
    const canBuy   = !owned && coins >= item.cost;

    let stateClass = isSel ? 'ci-selected' : owned ? (isActive ? 'ci-active' : 'ci-owned') : (canBuy ? 'ci-buyable' : 'ci-locked');
    let badgeHtml  = isActive   ? `<span class="ci-badge-pos ci-badge-active">✓ Носиш</span>`
                   : owned      ? `<span class="ci-badge-pos ci-badge-owned">✓</span>`
                   : canBuy     ? `<span class="ci-badge-pos ci-badge-buyable">Купи</span>`
                   : '';

    const swatchHtml = item.swatch
      ? `<div class="ci-swatch ${item.swatch}"></div>`
      : `<div class="ci-icon">${item.icon}</div>`;

    const costLabel = item.cost === 0 ? 'Бесплатно'
                    : owned           ? (isActive ? '— носиш' : '— твое')
                    : `🪙 ${item.cost}`;

    return `
      <div class="cosmetic-item ${stateClass}" onclick="cosmeticsSelect('${item.id}')">
        ${badgeHtml}
        ${swatchHtml}
        <div class="ci-name">${item.name}</div>
        <div class="ci-desc">${item.desc}</div>
        <div class="ci-cost">${costLabel}</div>
      </div>`;
  }).join('');

  const selectedItem = _cosSelected ? _findItem(_cosSelected) : null;
  const selOwned     = _cosSelected ? isCosmeticOwned(_cosSelected) : false;
  const selActive    = _cosSelected === active;
  const canAfford    = selectedItem && !selOwned && coins >= (selectedItem.cost || 0);

  const barHtml = (selectedItem && !selActive)
    ? `<div class="cosmetics-bar">
         <span class="cosmetics-bar-info">🪙 ${coins} монети</span>
         <button class="cosmetics-bar-equip ${!selOwned && !canAfford ? 'btn-cant-afford' : ''}"
           onclick="cosmeticsEquip('${_cosSelected}')">
           ${selOwned        ? 'Носи →'
           : canAfford       ? `Купи 🪙 ${selectedItem.cost} →`
           : `Треба 🪙 ${(selectedItem.cost || 0) - coins} повеќе`}
         </button>
       </div>` : '';

  document.getElementById('app').innerHTML = `
    <div class="game-wrap">
      <div class="score-bar">
        <button class="exit-btn" onclick="showHub()">✕</button>
        <span class="bar-title">🎨 Изглед &amp; Козметика</span>
        <span class="bar-stat coins-stat">🪙 <strong id="shop-coins-val">${coins}</strong></span>
      </div>
      <div class="cosmetics-screen">
        <div class="cosmetics-tabs">${tabsHtml}</div>
        <div class="cosmetics-grid">${itemsHtml}</div>
      </div>
      ${barHtml}
    </div>`;
}

window.cosmeticsSelect = function(itemId) {
  _cosSelected = _cosSelected === itemId ? null : itemId;
  _renderCosmeticsShop();
};

window.cosmeticsEquip = function(itemId) {
  if (!itemId) return;
  const item = _findItem(itemId);
  if (!item) return;

  if (!isCosmeticOwned(itemId)) {
    const coins = typeof loadCoins === 'function' ? loadCoins() : 0;
    if (coins < item.cost) {
      _showCosToast(`Треба уште 🪙 ${item.cost - coins} монети!`);
      return;
    }
    // Deduct coins
    if (typeof spendCoins === 'function') spendCoins(item.cost);
    if (typeof animateCoinDeduction === 'function') {
      const equipBtn = document.querySelector('.cosmetics-bar-equip');
      animateCoinDeduction(item.cost, equipBtn);
    }
    // Mark owned
    const owned = loadOwnedCosmetics();
    owned.add(itemId);
    saveOwnedCosmetics(owned);
  }

  // Equip (set active)
  const settings = loadCosmeticSettings();
  const catKey   = _catKey(_cosTab);
  settings[catKey] = itemId;
  saveCosmeticSettings(settings);
  if (catKey === 'theme') applyCosmeticTheme(itemId === 'default' ? '' : itemId);

  SoundFX?.correct?.();
  _cosSelected = null;
  _showCosToast(`✓ ${item.name} активирано!`);
  _renderCosmeticsShop();
};

function _showCosToast(text) {
  let t = document.querySelector('.badge-toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className   = 'badge-toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('bt-show'), 10);
  setTimeout(() => { t.classList.remove('bt-show'); setTimeout(() => t.remove(), 300); }, 2600);
}
