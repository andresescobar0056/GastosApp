/**
 * Lightbox — Full-screen image viewer with zoom & pan.
 *
 * Features:
 *   - Smooth open/close animations
 *   - Mouse wheel zoom
 *   - Pinch-to-zoom on touch devices
 *   - Click-and-drag panning
 *   - Touch drag panning
 *   - Double-click / double-tap to toggle 2× zoom
 *   - Toolbar buttons: zoom in, zoom out, reset, close
 *   - Keyboard: Escape to close, +/- to zoom
 *   - Click on background to close (when not zoomed in)
 *   - Auto-hides hint text after first interaction
 */

class Lightbox {
  constructor() {
    this.isOpen = false;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.minScale = 1;
    this.maxScale = 5;

    // Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTranslateX = 0;
    this.dragStartTranslateY = 0;

    // Pinch state
    this.initialPinchDistance = 0;
    this.initialPinchScale = 1;

    // Hint shown
    this.hintHidden = false;

    // DOM references (resolved lazily on first open)
    this._overlay = null;
    this._canvas = null;
    this._img = null;
    this._title = null;
    this._hint = null;
  }

  /** Resolve and cache DOM references */
  _resolveDOM() {
    if (this._overlay) return;
    this._overlay = document.getElementById('lightboxOverlay');
    this._canvas = document.getElementById('lightboxCanvas');
    this._img = document.getElementById('lightboxImg');
    this._title = document.getElementById('lightboxTitle');
    this._hint = document.getElementById('lightboxHint');
    if (this._overlay) this._bindEvents();
  }

  /** Attach event listeners (called once) */
  _bindEvents() {
    const overlay = this._overlay;
    const canvas = this._canvas;

    // Close button
    const closeBtn = document.getElementById('lightboxClose');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Zoom buttons
    const zoomIn = document.getElementById('lightboxZoomIn');
    const zoomOut = document.getElementById('lightboxZoomOut');
    const reset = document.getElementById('lightboxReset');
    if (zoomIn)  zoomIn.addEventListener('click', () => this.zoomBy(0.4));
    if (zoomOut) zoomOut.addEventListener('click', () => this.zoomBy(-0.4));
    if (reset)   reset.addEventListener('click', () => this.resetZoom());

    // Click on canvas background to close (only when not zoomed)
    canvas.addEventListener('click', (e) => {
      if (e.target === canvas && this.scale <= 1.05) {
        this.close();
      }
    });

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      this.zoomBy(delta, e.clientX, e.clientY);
      this._hideHint();
    }, { passive: false });

    // Double-click to toggle zoom
    canvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (this.scale > 1.1) {
        this.resetZoom();
      } else {
        this.zoomTo(2, e.clientX, e.clientY);
      }
      this._hideHint();
    });

    // --- Mouse drag ---
    canvas.addEventListener('mousedown', (e) => {
      if (this.scale <= 1.05) return;
      e.preventDefault();
      this._startDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      this._onDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // --- Touch interactions ---
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // Pinch start
        e.preventDefault();
        this.initialPinchDistance = this._getTouchDistance(e.touches);
        this.initialPinchScale = this.scale;
        this._hideHint();
      } else if (e.touches.length === 1 && this.scale > 1.05) {
        // Touch drag start (only when zoomed)
        e.preventDefault();
        this._startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        // Pinch zoom
        e.preventDefault();
        const dist = this._getTouchDistance(e.touches);
        const newScale = this.initialPinchScale * (dist / this.initialPinchDistance);
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        this._applyTransform();
      } else if (e.touches.length === 1 && this.isDragging) {
        e.preventDefault();
        this._onDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      this.isDragging = false;
      this.initialPinchDistance = 0;
    });

    // Double-tap detection for touch
    let lastTap = 0;
    canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return;
      const now = Date.now();
      if (now - lastTap < 320) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (this.scale > 1.1) {
          this.resetZoom();
        } else {
          this.zoomTo(2, touch.clientX, touch.clientY);
        }
        this._hideHint();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });

    // Keyboard: Escape, +, -
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoomBy(0.3);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.zoomBy(-0.3);
      } else if (e.key === '0') {
        e.preventDefault();
        this.resetZoom();
      }
    });
  }

  /** Open the lightbox with an image source and optional title */
  open(imgSrc, title) {
    if (!imgSrc) return;
    this._resolveDOM();
    if (!this._overlay) return;

    this._img.src = imgSrc;
    if (this._title) this._title.textContent = title || 'Fotografía';

    // Reset transform
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this._applyTransform();

    // Show hint
    if (this._hint && !this.hintHidden) {
      this._hint.classList.remove('hidden');
    }

    // Activate
    this._overlay.classList.add('active');
    this._overlay.setAttribute('aria-hidden', 'false');
    this.isOpen = true;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
  }

  /** Close the lightbox */
  close() {
    this._resolveDOM();
    if (!this._overlay) return;

    this._overlay.classList.remove('active');
    this._overlay.setAttribute('aria-hidden', 'true');
    this.isOpen = false;
    this.isDragging = false;

    // Restore body scroll
    document.body.style.overflow = '';

    // Clear src after animation to free memory
    setTimeout(() => {
      if (!this.isOpen && this._img) this._img.src = '';
    }, 350);
  }

  /** Zoom by a delta amount, optionally toward a specific point */
  zoomBy(delta, originX, originY) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
    if (originX !== undefined && originY !== undefined) {
      this._zoomToPoint(newScale, originX, originY);
    } else {
      this.scale = newScale;
      this._clampTranslate();
      this._applyTransform();
    }
  }

  /** Zoom to a specific scale, optionally toward a specific point */
  zoomTo(targetScale, originX, originY) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));
    if (originX !== undefined && originY !== undefined) {
      this._zoomToPoint(newScale, originX, originY);
    } else {
      this.scale = newScale;
      this._clampTranslate();
      this._applyTransform();
    }
  }

  /** Reset zoom and position */
  resetZoom() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this._applyTransform();
  }

  /** Zoom toward a screen point (keeps the cursor position stable) */
  _zoomToPoint(newScale, originX, originY) {
    const canvas = this._canvas;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    // Position of the origin relative to canvas center
    const mouseX = originX - rect.left - cx;
    const mouseY = originY - rect.top - cy;

    const ratio = newScale / this.scale;
    this.translateX = mouseX - ratio * (mouseX - this.translateX);
    this.translateY = mouseY - ratio * (mouseY - this.translateY);
    this.scale = newScale;

    this._clampTranslate();
    this._applyTransform();
  }

  /** Clamp translate so the image stays reasonably on screen */
  _clampTranslate() {
    if (this.scale <= 1) {
      this.translateX = 0;
      this.translateY = 0;
      return;
    }

    const canvas = this._canvas;
    if (!canvas) return;

    const maxTx = (this.scale - 1) * canvas.clientWidth / 2;
    const maxTy = (this.scale - 1) * canvas.clientHeight / 2;

    this.translateX = Math.max(-maxTx, Math.min(maxTx, this.translateX));
    this.translateY = Math.max(-maxTy, Math.min(maxTy, this.translateY));
  }

  /** Apply the current transform to the image */
  _applyTransform() {
    if (!this._img) return;
    this._img.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;

    // Update canvas cursor
    if (this._canvas) {
      this._canvas.style.cursor = this.scale > 1.05 ? 'grab' : 'default';
    }
  }

  /** Start a drag operation */
  _startDrag(x, y) {
    this.isDragging = true;
    this.dragStartX = x;
    this.dragStartY = y;
    this.dragStartTranslateX = this.translateX;
    this.dragStartTranslateY = this.translateY;
    this._hideHint();
  }

  /** Process drag movement */
  _onDrag(x, y) {
    if (!this.isDragging) return;
    this.translateX = this.dragStartTranslateX + (x - this.dragStartX);
    this.translateY = this.dragStartTranslateY + (y - this.dragStartY);
    this._clampTranslate();
    this._applyTransform();
  }

  /** Get distance between two touch points */
  _getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Hide the hint text (one-time) */
  _hideHint() {
    if (this._hint && !this.hintHidden) {
      this._hint.classList.add('hidden');
      this.hintHidden = true;
    }
  }
}

window.lightbox = new Lightbox();
