// ── coins.js — Premium game unlock + spendable coin economy ──────────────
// Coins are a SEPARATE spendable balance (loadCoins / spendCoins in storage.js).
// Playing games earns coins; spending deducts them.  Balance can go up and down.

// Premium-game unlock costs in coins
const UNLOCK_COSTS = {
  wordbuilder: 30,
  memoryflip:  60,
  fasttyping:  100,
};

const PREMIUM_GAMES = [
  { id: 'wordbuilder', icon: '🧩', name: 'Слогалица',      desc: 'Сложи ги слоговите во збор',  color: 'card-gold' },
  { id: 'memoryflip',  icon: '🃏', name: 'Меморија',       desc: 'Спои збор со дефиниција',    color: 'card-crimson' },
  { id: 'fasttyping',  icon: '⌨️', name: 'Брзопис',        desc: '60 секунди — колку побрзо!', color: 'card-electric' },
];

function getUnlockCost(gameId) {
  return UNLOCK_COSTS[gameId] || 9999;
}

function isGameUnlocked(gameId) {
  return localStorage.getItem(`zb_${_uid()}_unlock_${gameId}`) === '1';
}

// ── Try to unlock a premium game by spending coins ────────────
window.tryUnlockGame = function(gameId) {
  if (isGameUnlocked(gameId)) { startGame(gameId); return; }

  if (typeof currentUser === 'undefined' || !currentUser) {
    _showCoinToast('Регистрирај се за да ги отклучиш напредните игри!');
    return;
  }

  const cost  = getUnlockCost(gameId);
  const coins = typeof loadCoins === 'function' ? loadCoins() : 0;

  if (coins < cost) {
    _showCoinToast(`Треба уште 🪙 ${cost - coins} монети!`);
    _shakeLockedCard(gameId);
    return;
  }

  // Spend the coins
  if (typeof spendCoins === 'function') spendCoins(cost);

  // Mark as unlocked
  localStorage.setItem(`zb_${_uid()}_unlock_${gameId}`, '1');
  if (typeof db !== 'undefined' && currentUser) {
    db.collection('users').doc(currentUser.uid)
      .set({ [`unlocked_${gameId}`]: true, coins: typeof loadCoins === 'function' ? loadCoins() : 0 }, { merge: true })
      .catch(() => {});
  }

  animateCoinDeduction(cost);
  _showUnlockAnimation();
  setTimeout(() => { if (typeof showHub === 'function') showHub(); }, 900);
};

function _shakeLockedCard(gameId) {
  const card = document.querySelector(`[onclick="tryUnlockGame('${gameId}')"]`);
  if (!card) return;
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'shake .4s';
  setTimeout(() => card.style.animation = '', 400);
}

// ── Notifications ─────────────────────────────────────────────
function _showCoinToast(text) {
  let t = document.querySelector('.badge-toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className   = 'badge-toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('bt-show'), 10);
  setTimeout(() => { t.classList.remove('bt-show'); setTimeout(() => t.remove(), 300); }, 2800);
}

function _showUnlockAnimation() {
  const toast = document.createElement('div');
  toast.className   = 'unlock-toast';
  toast.textContent = '🔓 Игра отклучена! 🎉';
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('ut-show'), 10);
  setTimeout(() => { toast.classList.remove('ut-show'); setTimeout(() => toast.remove(), 400); }, 2600);
  if (typeof launchConfetti === 'function') launchConfetti(null);
  if (typeof SoundFX !== 'undefined') SoundFX.streak();
}

// ── Coin deduction animation ──────────────────────────────────
function animateCoinDeduction(amount, sourceEl) {
  if (!amount || amount <= 0) return;

  // Flash the navbar balance display red
  const display = document.getElementById('hub-coins-val');
  if (display) {
    display.classList.add('coin-deduct-flash');
    display.textContent = typeof loadCoins === 'function' ? loadCoins() : '—';
    setTimeout(() => display.classList.remove('coin-deduct-flash'), 650);
  }

  // Floating "−N 🪙" particles
  const count = Math.min(4, Math.max(1, Math.ceil(amount / 25)));
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className  = 'coin-deduct-float';
    el.textContent = i === 0 ? `−${amount} 🪙` : '🪙';
    const x = sourceEl
      ? sourceEl.getBoundingClientRect().left + sourceEl.getBoundingClientRect().width / 2
      : window.innerWidth / 2;
    const y = sourceEl
      ? sourceEl.getBoundingClientRect().top
      : window.innerHeight * 0.45;
    el.style.left             = (x + (Math.random() - 0.5) * 70) + 'px';
    el.style.top              = y + 'px';
    el.style.animationDelay   = (i * 90) + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400 + i * 90);
  }
}
window.animateCoinDeduction = animateCoinDeduction;

// ── Coin earning animation (shown after game result) ──────────
function animateCoinReward(amount, sourceEl) {
  if (!amount || amount <= 0) return;
  const count = Math.min(6, Math.max(1, Math.ceil(amount / 10)));
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className  = 'coin-float';
    el.textContent = i === 0 ? `+${amount} 🪙` : '🪙';
    const baseX = sourceEl
      ? sourceEl.getBoundingClientRect().left + sourceEl.getBoundingClientRect().width / 2
      : window.innerWidth / 2;
    const baseY = sourceEl
      ? sourceEl.getBoundingClientRect().top
      : window.innerHeight * 0.55;
    el.style.left           = (baseX + (Math.random() - 0.5) * 100) + 'px';
    el.style.top            = baseY + 'px';
    el.style.animationDelay = (i * 110) + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700 + i * 110);
  }
}
window.animateCoinReward = animateCoinReward;

// ── Premium game card HTML (locked / unlocked) ────────────────
function premiumCardHtml(game) {
  const unlocked = isGameUnlocked(game.id);
  const best     = typeof loadBest === 'function' ? loadBest(game.id) : 0;

  if (unlocked) {
    return `
      <div class="game-card ${game.color}" onclick="startGame('${game.id}')">
        <div class="game-icon">${game.icon}</div>
        <div class="game-name">${game.name}</div>
        <div class="game-desc">${game.desc}</div>
        <div class="game-best">${best > 0 ? '* ' + best + ' поени' : '— нема рекорд'}</div>
      </div>`;
  }

  const cost      = getUnlockCost(game.id);
  const coins     = typeof loadCoins === 'function' ? loadCoins() : 0;
  const canAfford = coins >= cost;

  return `
    <div class="game-card ${game.color} game-card-locked${canAfford ? ' game-card-affordable' : ''}"
      onclick="tryUnlockGame('${game.id}')">
      <div class="game-icon">🔒</div>
      <div class="game-name">${game.name}</div>
      <div class="game-desc">${game.desc}</div>
      <div class="game-best">🪙 ${cost} монети</div>
      <div class="lock-status">${canAfford ? '✓ Можеш да отклучиш!' : `Треба уште 🪙 ${cost - coins}`}</div>
    </div>`;
}
window.premiumCardHtml = premiumCardHtml;
