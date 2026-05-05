// ── fx.js — Звучни ефекти (Web Audio API) и визуелни ефекти ─────────
// Нема потреба од надворешни фајлови — сите звуци се генерираат програмски.

// ── Звучни ефекти ──────────────────────────────────────────────
const SoundFX = (() => {
  let ctx = null;

  /**
   * Што прави: Иницијализира аудио контекст за пуштање звуци
   * Параметри: нема
   * Враќа: AudioContext објект или null
   */
  function getCtx() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  /**
   * Што прави: Пушта еден тон со одредена фреквенција и траење
   * Параметри: freq (фреквенција во Hz), startDelay (одложување во секунди), dur (траење во секунди), type (тип на бран), vol (гласност)
   * Враќа: ништо
   */
  function note(freq, startDelay, dur, type = 'sine', vol = 0.24) {
    const c = getCtx();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const g   = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime + startDelay);
      g.gain.setValueAtTime(0.001, c.currentTime + startDelay);
      g.gain.linearRampToValueAtTime(vol, c.currentTime + startDelay + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startDelay + dur);
      osc.start(c.currentTime + startDelay);
      osc.stop(c.currentTime + startDelay + dur + 0.05);
    } catch (e) {}
  }

  return {
    /**
     * Што прави: Пушта краток весел звук за точен одговор
     * Параметри: нема
     * Враќа: ништо
     */
    correct() {
      note(523.25, 0,    0.11);
      note(659.25, 0.09, 0.11);
      note(783.99, 0.18, 0.22);
    },

    /**
     * Што прави: Пушта низок звук за погрешен одговор
     * Параметри: нема
     * Враќа: ништо
     */
    wrong() {
      note(261.63, 0,    0.14, 'sawtooth', 0.14);
      note(196.00, 0.12, 0.22, 'sawtooth', 0.09);
    },

    /**
     * Што прави: Пушта победнички звук за достигната серија точни одговори
     * Параметри: нема
     * Враќа: ништо
     */
    streak() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        note(f, i * 0.09, 0.14, 'triangle', 0.2)
      );
    },

    /**
     * Што прави: Пушта весел звук при почеток на игра
     * Параметри: нема
     * Враќа: ништо
     */
    start() {
      [392, 523.25, 659.25].forEach((f, i) =>
        note(f, i * 0.1, 0.11, 'triangle', 0.18)
      );
    },

    /**
     * Што прави: Пушта тивок звук за отчукување на времето
     * Параметри: нема
     * Враќа: ништо
     */
    tick() {
      note(900, 0, 0.04, 'sine', 0.07);
    }
  };
})();

// ── Визуелни ефекти (Конфети) ────────────────────────────

/**
 * Што прави: Лансира конфети ефект од одреден елемент или центарот на екранот
 * Параметри: originEl (DOM елемент од кој ќе излезат конфетите)
 * Враќа: ништо
 */
function launchConfetti(originEl) {
  const COLORS = ['#E8641A','#1A7A6E','#8B7AB8','#FFD700','#ffffff','#3B1F3A'];
  const rect   = originEl
    ? originEl.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;

  for (let i = 0; i < 26; i++) {
    const el    = document.createElement('div');
    el.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const dist  = 70 + Math.random() * 130;
    const size  = 5 + Math.random() * 7;
    el.style.cssText = [
      `left:${cx}px`, `top:${cy}px`,
      `background:${COLORS[i % COLORS.length]}`,
      `--tx:${(Math.cos(angle) * dist).toFixed(1)}px`,
      `--ty:${(Math.sin(angle) * dist - 90).toFixed(1)}px`,
      `--rot:${Math.round(Math.random() * 720)}deg`,
      `width:${size.toFixed(1)}px`, `height:${size.toFixed(1)}px`,
      `border-radius:${Math.random() > .5 ? '50%' : '2px'}`
    ].join(';');
    document.body.appendChild(el);
    // Отстрани ги по 950ms кога анимацијата ќе заврши
    setTimeout(() => el.remove(), 950);
  }
}

// ── Анимација на скокање на бројката за поени ───────

/**
 * Што прави: Додава CSS класа за анимација на бројот со поени кога ќе се зголеми
 * Параметри: el (DOM елемент за поени)
 * Враќа: ништо
 */
function popScore(el) {
  if (!el) return;
  // Ресетирај ја анимацијата ако веќе е активна
  el.classList.remove('score-pop');
  void el.offsetWidth; // force reflow (присилно прецртување за рестарт)
  el.classList.add('score-pop');
  // Отстрани ја класата кога ќе заврши за да може пак да се пушти
  el.addEventListener('animationend', () => el.classList.remove('score-pop'), { once: true });
}
