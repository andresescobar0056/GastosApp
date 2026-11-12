/**
 * Animation Engine:
 * - Balance Bounce UP (Gains) & Balance Bounce DOWN (Losses)
 * - Number ticker interpolation
 * - Floating delta amounts
 * - Procedural subtle luxury smoke canvas
 */

class AnimationEngine {
  constructor() {
    this.smokeCanvas = null;
    this.smokeCtx = null;
    this.smokeParticles = [];
    this.animationFrameId = null;
    this.smokeActive = false;
  }

  // --- Balance Bounce UP (Ingreso / Ganancia) ---
  triggerGain(oldBalance, newBalance, deltaAmount) {
    const balanceEl = document.getElementById('heroBalanceDisplay');
    const heroCard = document.getElementById('balanceHeroCard');
    const floatingDeltaEl = document.getElementById('floatingDelta');

    if (!balanceEl) return;

    // 1. Remove previous animation classes
    balanceEl.classList.remove('anim-bounce-up', 'anim-bounce-down');
    if (heroCard) heroCard.classList.remove('card-glow-gain', 'card-glow-loss');

    // Force reflow
    void balanceEl.offsetWidth;

    // 2. Add Gain Animations
    balanceEl.classList.add('anim-bounce-up');
    if (heroCard) heroCard.classList.add('card-glow-gain');

    // 3. Show floating positive delta
    if (floatingDeltaEl && deltaAmount > 0) {
      floatingDeltaEl.textContent = `+${window.formatCurrency(deltaAmount)}`;
      floatingDeltaEl.className = 'floating-delta gain anim-float-gain';
      setTimeout(() => {
        floatingDeltaEl.className = 'floating-delta';
      }, 1300);
    }

    // 4. Smooth Counter Interpolation
    this.interpolateValue(balanceEl, oldBalance, newBalance, 850);

    // 5. Subtle smoke surge
    this.boostSmoke(1.6);
  }

  // --- Balance Bounce DOWN (Retiro / Pérdida) ---
  triggerLoss(oldBalance, newBalance, deltaAmount) {
    const balanceEl = document.getElementById('heroBalanceDisplay');
    const heroCard = document.getElementById('balanceHeroCard');
    const floatingDeltaEl = document.getElementById('floatingDelta');

    if (!balanceEl) return;

    // 1. Remove previous animation classes
    balanceEl.classList.remove('anim-bounce-up', 'anim-bounce-down');
    if (heroCard) heroCard.classList.remove('card-glow-gain', 'card-glow-loss');

    // Force reflow
    void balanceEl.offsetWidth;

    // 2. Add Loss Animations
    balanceEl.classList.add('anim-bounce-down');
    if (heroCard) heroCard.classList.add('card-glow-loss');

    // 3. Show floating negative delta
    if (floatingDeltaEl && deltaAmount > 0) {
      floatingDeltaEl.textContent = `-${window.formatCurrency(deltaAmount)}`;
      floatingDeltaEl.className = 'floating-delta loss anim-float-loss';
      setTimeout(() => {
        floatingDeltaEl.className = 'floating-delta';
      }, 1300);
    }

    // 4. Smooth Counter Interpolation
    this.interpolateValue(balanceEl, oldBalance, newBalance, 850);

    // 5. Subtle smoke surge
    this.boostSmoke(1.4);
  }

  // --- Number Counter Interpolation ---
  interpolateValue(element, start, end, duration) {
    const startTime = performance.now();
    const diff = end - start;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const ease = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(start + diff * ease);

      element.textContent = window.formatCurrency(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        element.textContent = window.formatCurrency(end);
      }
    }

    requestAnimationFrame(step);
  }

  // --- Subtle Luxury Smoke Canvas ---
  initSmoke(canvasId) {
    this.smokeCanvas = document.getElementById(canvasId);
    if (!this.smokeCanvas) return;

    this.smokeCtx = this.smokeCanvas.getContext('2d');
    this.resizeSmoke();

    window.addEventListener('resize', () => this.resizeSmoke());

    // Generate gentle mist clouds
    this.smokeParticles = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      this.smokeParticles.push({
        x: Math.random() * this.smokeCanvas.width,
        y: Math.random() * this.smokeCanvas.height,
        radius: 60 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2,
        baseAlpha: 0.05 + Math.random() * 0.07,
        alpha: 0.06,
        phase: Math.random() * Math.PI * 2
      });
    }

    this.smokeActive = true;
    this.animateSmoke();
  }

  resizeSmoke() {
    if (!this.smokeCanvas) return;
    const rect = this.smokeCanvas.parentElement.getBoundingClientRect();
    this.smokeCanvas.width = rect.width;
    this.smokeCanvas.height = rect.height;
  }

  boostSmoke(multiplier = 1.5) {
    this.smokeParticles.forEach(p => {
      p.alpha = Math.min(0.25, p.baseAlpha * multiplier);
    });
  }

  animateSmoke() {
    if (!this.smokeActive || !this.smokeCtx) return;

    const ctx = this.smokeCtx;
    const w = this.smokeCanvas.width;
    const h = this.smokeCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    for (let i = 0; i < this.smokeParticles.length; i++) {
      const p = this.smokeParticles[i];
      p.phase += 0.01;
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges smoothly
      if (p.x < -p.radius) p.x = w + p.radius;
      if (p.x > w + p.radius) p.x = -p.radius;
      if (p.y < -p.radius) p.y = h + p.radius;
      if (p.y > h + p.radius) p.y = -p.radius;

      // Soft decay towards base alpha
      p.alpha += (p.baseAlpha - p.alpha) * 0.02;

      // Subtle breathing radius
      const currentRadius = p.radius + Math.sin(p.phase) * 10;

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentRadius);
      if (isLight) {
        grad.addColorStop(0, `rgba(59, 130, 246, ${p.alpha * 0.6})`);
        grad.addColorStop(0.6, `rgba(147, 197, 253, ${p.alpha * 0.25})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        grad.addColorStop(0, `rgba(59, 130, 246, ${p.alpha})`);
        grad.addColorStop(0.5, `rgba(99, 102, 241, ${p.alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(8, 12, 20, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    this.animationFrameId = requestAnimationFrame(() => this.animateSmoke());
  }
}

window.animations = new AnimationEngine();
