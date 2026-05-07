// ── fx.js — Звучни ефекти (Web Audio API) и визуелни ефекти ─────────
// Нема потреба од надворешни фајлови — сите звуци се генерираат програмски.

// ── Звучни ефекти ──────────────────────────────────────────────
const SoundFX = (() => {
  let audioContext = null;

  /**
   * Што прави: Иницијализира аудио контекст за пуштање звуци
   */
  function getAudioContext() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContext.state === 'suspended') audioContext.resume();
      return audioContext;
    } catch (e) {
      return null;
    }
  }

  /**
   * Пушта тон
   */
  function note(frequency, startDelay, duration, type = 'sine', volume = 0.24) {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    try {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startDelay);

      gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime + startDelay);
      gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + startDelay + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + startDelay + duration
      );

      oscillator.start(audioCtx.currentTime + startDelay);
      oscillator.stop(audioCtx.currentTime + startDelay + duration + 0.05);
    } catch (e) {}
  }

  return {
    correct() {
      note(523.25, 0, 0.11);
      note(659.25, 0.09, 0.11);
      note(783.99, 0.18, 0.22);
    },

    wrong() {
      note(261.63, 0, 0.14, 'sawtooth', 0.14);
      note(196.00, 0.12, 0.22, 'sawtooth', 0.09);
    },

    streak() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        note(f, i * 0.09, 0.14, 'triangle', 0.2)
      );
    },

    start() {
      [392, 523.25, 659.25].forEach((f, i) =>
        note(f, i * 0.1, 0.11, 'triangle', 0.18)
      );
    },

    tick() {
      note(900, 0, 0.04, 'sine', 0.07);
    }
  };
})();

// ── Визуелни ефекти (Конфети) ────────────────────────────

function launchConfetti(originEl) {
  const COLORS = ['#E8641A','#1A7A6E','#8B7AB8','#FFD700','#ffffff','#3B1F3A'];

  const rect = originEl
    ? originEl.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < 26; i++) {
    const confettiPiece = document.createElement('div');
    confettiPiece.className = 'confetti-piece';

    const angle = Math.random() * Math.PI * 2;
    const travelDistance = 70 + Math.random() * 130;
    const size = 5 + Math.random() * 7;

    confettiPiece.style.cssText = [
      `left:${centerX}px`,
      `top:${centerY}px`,
      `background:${COLORS[i % COLORS.length]}`,
      `--tx:${(Math.cos(angle) * travelDistance).toFixed(1)}px`,
      `--ty:${(Math.sin(angle) * travelDistance - 90).toFixed(1)}px`,
      `--rot:${Math.round(Math.random() * 720)}deg`,
      `width:${size.toFixed(1)}px`,
      `height:${size.toFixed(1)}px`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`
    ].join(';');

    document.body.appendChild(confettiPiece);
    setTimeout(() => confettiPiece.remove(), 950);
  }
}

// ── Анимација на поени ────────────────────────────

function popScore(el) {
  if (!el) return;

  el.classList.remove('score-pop');
  void el.offsetWidth;
  el.classList.add('score-pop');

  el.addEventListener(
    'animationend',
    () => el.classList.remove('score-pop'),
    { once: true }
  );
}
