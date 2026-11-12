/**
 * UI Renderer & Form Controller:
 * Handles DOM rendering for all 11 screens, photo file uploads,
 * movement and goal cards, filters, and user profile.
 */

class UIManager {
  constructor() {
    this.currentMovementFilter = 'all';
    this.movementSearchQuery = '';
    this.activeMovementPhotoFile = null;   // File nuevo elegido para el movimiento
    this.movementPhotoRemoved = false;     // el usuario quitó la foto existente al editar
    this.activeGoalPhotoFile = null;
    this.goalPhotoRemoved = false;
    this.busy = false;                     // evita envíos dobles de formularios
  }

  init() {
    this.bindEvents();
    this.renderAll();
  }

  renderAll() {
    this.renderHeader();
    this.renderDashboard();
    this.renderMovementsList();
    this.renderGoalsList();
    this.renderSettings();
  }

  // --- Header Rendering ---
  renderHeader() {
    const user = window.appState.data.currentUser;

    // Mostrar nombre de usuario (no el ID) en el saludo
    const headerUsername = document.getElementById('headerUsername');
    if (headerUsername && user) {
      headerUsername.textContent = user.username || user.name || 'Usuario';
    }

    // Avatar en header
    const headerImg      = document.getElementById('headerAvatarImg');
    const headerFallback = document.getElementById('headerAvatarFallback');
    if (headerImg && headerFallback) {
      if (user && user.avatar_path) {
        headerImg.src = user.avatar_path;
        headerImg.style.display = 'block';
        headerFallback.style.display = 'none';
      } else {
        headerImg.style.display = 'none';
        headerFallback.style.display = '';
      }
    }
  }

  // --- Dashboard Rendering ---
  renderDashboard() {
    const data = window.appState.data;
    const esc = (v) => this.escapeHtml(v);

    const balanceEl = document.getElementById('heroBalanceDisplay');
    if (balanceEl) {
      balanceEl.textContent = window.formatCurrency(data.balance);
    }

    // Totales calculados por el servidor
    const incomeEl = document.getElementById('dashTotalIncome');
    const expenseEl = document.getElementById('dashTotalExpense');
    if (incomeEl) incomeEl.textContent = window.formatCurrency(data.totals.total_income);
    if (expenseEl) expenseEl.textContent = window.formatCurrency(data.totals.total_expense);

    const recentContainer = document.getElementById('dashRecentMovements');
    if (recentContainer) {
      const recents = data.movements.slice(0, 4);
      recentContainer.innerHTML = recents.length === 0
        ? `<div class="empty-state">No hay movimientos registrados aún.</div>`
        : recents.map(m => this.createMovementCardHTML(m, false)).join('');
    }

    const goalPreviewContainer = document.getElementById('dashFeaturedGoal');
    if (goalPreviewContainer) {
      const topGoal = data.goals[0];
      if (topGoal) {
        const pct = window.RankSystem.getProgress(topGoal.savedAmount, topGoal.targetAmount);
        const rank = window.RankSystem.getRankByPercentage(pct);
        goalPreviewContainer.innerHTML = `
          <div class="card card-glass" style="cursor: pointer;" data-action="nav" data-screen="goals">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 8px;">
              <div>
                <span class="caption" style="text-transform:uppercase; letter-spacing:0.05em;">Meta Principal</span>
                <h4 style="font-size:1rem; margin-top:2px;">${esc(topGoal.name)}</h4>
              </div>
              ${window.RankSystem.renderBadge(pct)}
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:6px;">
              <span style="font-weight:700;">${window.formatCurrency(topGoal.savedAmount)}</span>
              <span class="caption">${window.formatCurrency(topGoal.targetAmount)} (${Number(pct)}%)</span>
            </div>
            <div class="progress-track ${esc(rank.className)}">
              <div class="progress-bar-fill" style="width: ${Math.min(Number(pct) || 0, 100)}%;"></div>
            </div>
          </div>
        `;
      } else {
        goalPreviewContainer.innerHTML = '';
      }
    }
  }

  // --- Movements List Rendering ---
  renderMovementsList() {
    const listContainer = document.getElementById('allMovementsList');
    if (!listContainer) return;

    let items = [...window.appState.data.movements];

    if (this.currentMovementFilter === 'ingresos') {
      items = items.filter(m => m.type === 'ingreso');
    } else if (this.currentMovementFilter === 'retiros') {
      items = items.filter(m => m.type === 'retiro');
    }

    if (this.movementSearchQuery.trim()) {
      const query = this.movementSearchQuery.toLowerCase();
      items = items.filter(m =>
        (m.name || '').toLowerCase().includes(query) ||
        (m.category && m.category.toLowerCase().includes(query)) ||
        (m.description && m.description.toLowerCase().includes(query))
      );
    }

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 36px 16px; color: var(--text-secondary);">
          <svg viewBox="0 0 24 24" class="icon icon-xl" style="stroke: var(--text-muted); margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          <p style="font-weight:600;">No se encontraron movimientos</p>
          <span class="caption">Intenta cambiar los filtros o agrega un nuevo movimiento</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = items.map(m => this.createMovementCardHTML(m, true)).join('');
  }

  /**
   * Tarjeta de movimiento. TODO dato del usuario pasa por escapeHtml y las acciones
   * usan atributos data-* (manejados por _onDelegatedClick), nunca onclick con datos interpolados.
   */
  createMovementCardHTML(m, showActions = true) {
    const esc = (v) => this.escapeHtml(v);
    const isGain = m.type === 'ingreso';
    const typeClass = isGain ? 'ingreso' : 'retiro';
    const amountSign = isGain ? '+' : '-';
    const iconSvg = isGain
      ? `<svg viewBox="0 0 24 24" class="icon"><polyline points="18 15 18 9 12 9"></polyline><line x1="6" y1="15" x2="18" y2="9"></line></svg>`
      : `<svg viewBox="0 0 24 24" class="icon"><polyline points="6 9 6 15 12 15"></polyline><line x1="18" y1="9" x2="6" y2="15"></line></svg>`;

    const thumbContent = m.photo
      ? `<img src="${esc(m.photo)}" class="movement-thumb-img lightbox-clickable" alt="${esc(m.name)}" data-action="lightbox" data-src="${esc(m.photo)}" data-title="${esc(m.name)}" />`
      : `<div class="movement-thumb-icon ${typeClass}">${iconSvg}</div>`;

    const actionsHTML = showActions ? `
      <div class="movement-actions-row">
        <button class="action-btn-mini" title="Ver Detalle" data-action="nav" data-screen="movement-detail" data-id="${esc(m.id)}">
          <svg viewBox="0 0 24 24" class="icon icon-sm"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
        <button class="action-btn-mini" title="Editar" data-action="nav" data-screen="movement-edit" data-id="${esc(m.id)}">
          <svg viewBox="0 0 24 24" class="icon icon-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="action-btn-mini danger" title="Eliminar" data-action="delete-movement" data-id="${esc(m.id)}">
          <svg viewBox="0 0 24 24" class="icon icon-sm"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    ` : '';

    return `
      <div class="movement-item" data-action="nav" data-screen="movement-detail" data-id="${esc(m.id)}">
        <div class="movement-left">
          <div class="movement-thumb-box">
            ${thumbContent}
          </div>
          <div class="movement-info">
            <div class="movement-name">${esc(m.name)}</div>
            <div class="movement-meta">
              <span>${esc(m.category || 'General')}</span>
              <span>•</span>
              <span>${esc(m.date)}</span>
              ${m.photo ? `<span>•</span><svg viewBox="0 0 24 24" class="icon icon-sm" style="width:12px;height:12px;stroke:var(--accent-primary);"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>` : ''}
            </div>
          </div>
        </div>
        <div class="movement-right">
          <div class="movement-amount ${typeClass}">${amountSign}${window.formatCurrency(m.amount)}</div>
          ${actionsHTML}
        </div>
      </div>
    `;
  }

  // --- Goals List Rendering ---
  renderGoalsList() {
    const listContainer = document.getElementById('allGoalsList');
    if (!listContainer) return;
    const esc = (v) => this.escapeHtml(v);

    const goals = window.appState.data.goals;
    if (goals.length === 0) {
      listContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 36px 16px; color: var(--text-secondary);">
          <svg viewBox="0 0 24 24" class="icon icon-xl" style="stroke: var(--text-muted); margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><polygon points="12 6 12 12 16 14"></polygon></svg>
          <p style="font-weight:600;">No tienes metas activas</p>
          <span class="caption">Define una nueva meta para desbloquear los 10 rangos</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = goals.map(g => {
      const pct = Number(window.RankSystem.getProgress(g.savedAmount, g.targetAmount)) || 0;
      const rank = window.RankSystem.getRankByPercentage(pct);

      return `
        <div class="goal-card ${esc(rank.className)}">
          ${g.photo ? `
          <div style="width:100%;height:130px;border-radius:var(--radius-md);overflow:hidden;margin-bottom:12px;border:1px solid var(--border-subtle);">
            <img src="${esc(g.photo)}" alt="${esc(g.name)}" class="lightbox-clickable" style="width:100%;height:100%;object-fit:cover;" data-action="lightbox" data-src="${esc(g.photo)}" data-title="${esc(g.name)}">
          </div>` : ''}
          <div class="goal-header">
            <div class="goal-title-group">
              <h3 class="goal-title">${esc(g.name)}</h3>
              <p class="goal-desc">${esc(g.description || 'Meta de ahorro')}</p>
              ${g.targetDate ? `<div class="caption" style="margin-top:4px;">Fecha objetivo: ${esc(g.targetDate)}</div>` : ''}
            </div>
            ${window.RankSystem.renderBadge(pct)}
          </div>

          <div class="goal-progress-section">
            <div class="goal-amounts-row">
              <div>
                <span class="goal-saved">${window.formatCurrency(g.savedAmount)}</span>
                <span class="goal-target"> / ${window.formatCurrency(g.targetAmount)}</span>
              </div>
              <span class="goal-percentage">${pct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-bar-fill" style="width: ${Math.min(pct, 100)}%;"></div>
            </div>
          </div>

          <div class="goal-footer">
            <button class="btn btn-primary btn-sm" data-action="goal-deposit" data-id="${esc(g.id)}">
              <svg viewBox="0 0 24 24" class="icon icon-sm"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Abonar Dinero</span>
            </button>
            <div style="display:flex; gap:6px;">
              <button class="action-btn-mini" title="Editar Meta" data-action="nav" data-screen="goal-edit" data-id="${esc(g.id)}">
                <svg viewBox="0 0 24 24" class="icon icon-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="action-btn-mini danger" title="Eliminar Meta" data-action="delete-goal" data-id="${esc(g.id)}">
                <svg viewBox="0 0 24 24" class="icon icon-sm"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Un único listener para todos los botones generados dinámicamente.
   * Lee data-action / data-id / data-screen, así ningún dato del usuario se ejecuta como código.
   */
  _onDelegatedClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id, screen } = el.dataset;
    // Un clic en un botón interno no debe disparar también la tarjeta contenedora
    e.stopPropagation();

    switch (action) {
      case 'nav':
        window.router.navigate(screen, id ? { id } : {});
        break;
      case 'lightbox':
        if (window.lightbox) window.lightbox.open(el.dataset.src, el.dataset.title);
        break;
      case 'delete-movement':
        this.handleDeleteMovement(id, el.dataset.back === '1');
        break;
      case 'delete-goal':
        this.handleDeleteGoal(id);
        break;
      case 'goal-deposit':
        window.modals.showGoalDeposit(id);
        break;
    }
  }

  // --- Settings Screen Rendering ---
  renderSettings() {
    const user  = window.appState.data.currentUser;
    const theme = window.appState.data.theme;
    const accent = window.appState.data.accentColor;
    const bgImage = window.appState.data.bgImage;

    const setUserId    = document.getElementById('settingsUserId');
    const setUserName  = document.getElementById('settingsUserName');
    const setUserEmail = document.getElementById('settingsUserEmail');

    if (setUserId)    setUserId.textContent    = user.tag || ('USR-' + user.id);
    if (setUserName)  setUserName.textContent  = user.name || user.username;
    if (setUserEmail) setUserEmail.textContent = user.email;

    // ── Tema activo ────────────────────────────────────────────────────────
    const themeLabel = document.getElementById('settingsThemeLabel');
    const themeNames = { dark: 'Modo Oscuro', light: 'Modo Claro', amoled: 'AMOLED', sepia: 'Sepia' };
    if (themeLabel) themeLabel.textContent = themeNames[theme] || theme;

    // Marcar botón de tema activo
    document.querySelectorAll('.appearance-theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // ── Color de acento activo ─────────────────────────────────────────────
    document.querySelectorAll('.appearance-accent-btn[data-color]').forEach(btn => {
      btn.classList.toggle('active',
        accent ? btn.dataset.color === accent : btn.dataset.color === 'null'
      );
    });

    // ── Imagen de fondo ────────────────────────────────────────────────────
    const bgPreview    = document.getElementById('bgImagePreview');
    const bgPreviewImg = document.getElementById('bgImagePreviewImg');
    const bgRemoveBtn  = document.getElementById('bgImageRemoveBtn');

    if (bgImage) {
      if (bgPreview)    { bgPreview.style.display = 'block'; }
      if (bgPreviewImg) { bgPreviewImg.src = bgImage; }
      if (bgRemoveBtn)  { bgRemoveBtn.style.display = ''; }
    } else {
      if (bgPreview)   bgPreview.style.display   = 'none';
      if (bgRemoveBtn) bgRemoveBtn.style.display = 'none';
    }

    // Handler del input de imagen de fondo (una sola vez)
    const bgInput = document.getElementById('bgImageInput');
    if (bgInput && !bgInput._bound) {
      bgInput._bound = true;
      bgInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        bgInput.value = '';
        // Se reduce a máx. 1280px en JPEG para no llenar localStorage (~5MB)
        this._resizeImage(file, 1280, 0.8).then(dataUrl => {
          const saved = window.appState.setBgImage(dataUrl);
          if (!saved) {
            alert('La imagen se aplicó, pero es demasiado grande para recordarla la próxima vez. Prueba con una imagen más pequeña.');
          }
          window.ui.renderSettings();
        }).catch(() => alert('No se pudo leer la imagen.'));
      });
    }

    // ── Color wheel (inicializar una sola vez) ────────────────────────────
    this._initColorWheel();

    // Actualizar vista previa con el color actual
    const previewColor = accent || '#3B82F6';
    this._updateColorPreview(previewColor);

    // ── Avatar ─────────────────────────────────────────────────────────────
    const avatarImg         = document.getElementById('settingsAvatarImg');
    const avatarPlaceholder = document.getElementById('settingsAvatarPlaceholder');
    if (avatarImg && avatarPlaceholder) {
      if (user && user.avatar_path) {
        avatarImg.src = user.avatar_path;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
        avatarImg.classList.add('lightbox-clickable');
        avatarImg.onclick = (e) => {
          e.stopPropagation();
          if (window.lightbox) window.lightbox.open(user.avatar_path, user.name || user.username);
        };
      } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
      }
    }
  }

  // --- Screen Enter Lifecycle Handler ---
  onScreenEnter(screenId, params) {
    if (screenId === 'movement-detail' && params.id) {
      this.populateMovementDetail(params.id);
    } else if (screenId === 'movement-edit' && params.id) {
      this.populateMovementEditForm(params.id);
    } else if (screenId === 'movement-create') {
      this.resetMovementCreateForm();
    } else if (screenId === 'goal-edit' && params.id) {
      this.populateGoalEditForm(params.id);
    } else if (screenId === 'goal-create') {
      this.resetGoalCreateForm();
    } else {
      this.renderAll();
    }
  }

  // --- Movement Detail Screen ---
  populateMovementDetail(id) {
    const mov = window.appState.getMovementById(id);
    const container = document.getElementById('movementDetailCard');
    if (!mov || !container) {
      if (container) container.innerHTML = `<p>Movimiento no encontrado.</p>`;
      return;
    }

    const esc = (v) => this.escapeHtml(v);
    const isGain = mov.type === 'ingreso';
    const amountSign = isGain ? '+' : '-';

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span class="badge ${isGain ? 'btn-gain' : 'btn-loss'}" style="padding: 4px 12px; font-size: 0.75rem; border-radius: 999px; text-transform: uppercase; font-weight:700;">
          ${isGain ? 'Ingreso Registrado' : 'Retiro Registrado'}
        </span>
        <div style="font-size: 2.2rem; font-weight: 800; margin: 12px 0 4px; color: ${isGain ? 'var(--color-gain)' : 'var(--color-loss)'};">
          ${amountSign}${window.formatCurrency(mov.amount)}
        </div>
        <h3 style="font-size: 1.25rem;">${esc(mov.name)}</h3>
      </div>

      <div style="background: var(--bg-input); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle); padding: 16px; margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
          <span class="caption">Categoría</span>
          <span style="font-weight:600;">${esc(mov.category || 'General')}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
          <span class="caption">Fecha</span>
          <span style="font-weight:600;">${esc(mov.date)}</span>
        </div>
        <div style="padding: 10px 0 4px;">
          <span class="caption" style="display:block; margin-bottom:4px;">Descripción / Nota:</span>
          <p style="font-size:0.9rem; color:var(--text-secondary);">${esc(mov.description || 'Sin descripción adicional')}</p>
        </div>
      </div>

      ${mov.photo ? `
        <div style="margin-bottom: 24px;">
          <span class="caption" style="display:block; margin-bottom: 8px;">Fotografía o Comprobante:</span>
          <img src="${esc(mov.photo)}" class="lightbox-clickable" style="width:100%; max-height:260px; object-fit:cover; border-radius: var(--radius-md); border:1px solid var(--border-subtle);" data-action="lightbox" data-src="${esc(mov.photo)}" data-title="${esc(mov.name)}" title="Toca para ampliar"/>
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button class="btn btn-secondary" data-action="nav" data-screen="movement-edit" data-id="${esc(mov.id)}">
          <svg viewBox="0 0 24 24" class="icon icon-sm"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <span>Editar</span>
        </button>
        <button class="btn btn-outline-danger" data-action="delete-movement" data-id="${esc(mov.id)}" data-back="1">
          <svg viewBox="0 0 24 24" class="icon icon-sm"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>Eliminar</span>
        </button>
      </div>
    `;
  }

  // --- Forms Management & Reset ---
  resetMovementCreateForm() {
    this.activeMovementPhotoFile = null;
    this.movementPhotoRemoved = false;
    const form = document.getElementById('formCreateMovement');
    if (form) form.reset();

    // Default type: ingreso
    this.selectMovementType('create', 'ingreso');

    // Default date: today
    const dateInput = document.getElementById('createMovDate');
    if (dateInput) dateInput.value = window.todayISO();

    this.updatePhotoPreviewUI('createMov', null);
  }

  populateMovementEditForm(id) {
    const mov = window.appState.getMovementById(id);
    if (!mov) return;

    this.activeMovementPhotoFile = null;
    this.movementPhotoRemoved = false;

    document.getElementById('editMovId').value = mov.id;
    document.getElementById('editMovName').value = mov.name;
    document.getElementById('editMovAmount').value = mov.amount;
    document.getElementById('editMovCategory').value = mov.category || 'General';
    document.getElementById('editMovDate').value = mov.date;
    document.getElementById('editMovDesc').value = mov.description || '';

    this.selectMovementType('edit', mov.type);
    this.updatePhotoPreviewUI('editMov', mov.photo);
  }

  resetGoalCreateForm() {
    this.activeGoalPhotoFile = null;
    const form = document.getElementById('formCreateGoal');
    if (form) form.reset();
    // Limpiar el uploader de foto
    const empty   = document.getElementById('createGoalPhotoEmpty');
    const preview = document.getElementById('createGoalPhotoPreview');
    const img     = document.getElementById('createGoalPhotoImg');
    const input   = document.getElementById('createGoalPhotoInput');
    if (empty)   empty.style.display   = '';
    if (preview) preview.style.display = 'none';
    if (img)     img.src = '';
    if (input)   input.value = '';
  }

  populateGoalEditForm(id) {
    const goal = window.appState.getGoalById(id);
    if (!goal) return;

    this.activeGoalPhotoFile = null;
    this.goalPhotoRemoved = false;

    document.getElementById('editGoalId').value    = goal.id;
    document.getElementById('editGoalName').value  = goal.name;
    document.getElementById('editGoalTarget').value = goal.targetAmount;
    document.getElementById('editGoalSaved').value = goal.savedAmount;
    document.getElementById('editGoalDate').value  = goal.targetDate || '';
    document.getElementById('editGoalDesc').value  = goal.description || '';

    // Cargar imagen existente si la tiene
    const empty   = document.getElementById('editGoalPhotoEmpty');
    const preview = document.getElementById('editGoalPhotoPreview');
    const img     = document.getElementById('editGoalPhotoImg');
    const input   = document.getElementById('editGoalPhotoInput');
    if (input) input.value = '';
    if (goal.photo) {
      if (img) {
        img.src = goal.photo;
        img.classList.add('lightbox-clickable');
        img.onclick = (e) => {
          e.stopPropagation();
          if (window.lightbox) window.lightbox.open(goal.photo, goal.name || 'Imagen de meta');
        };
      }
      if (empty)   empty.style.display   = 'none';
      if (preview) preview.style.display = 'flex';
    } else {
      if (img) {
        img.src = '';
        img.classList.remove('lightbox-clickable');
        img.onclick = null;
      }
      if (empty)   empty.style.display   = '';
      if (preview) preview.style.display = 'none';
    }
  }

  // --- Photo Upload Handling ---
  /** Valida tipo y tamaño de una imagen elegida. Devuelve true si es aceptable. */
  _validateImageFile(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Solo se aceptan imágenes JPG, PNG o WEBP.');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5MB.');
      return false;
    }
    return true;
  }

  /** Uploader de foto de movimiento — guarda el File real, que se envía como FormData */
  setupPhotoUploader(zoneId, inputId, previewImgId, emptyStateId, previewActionsId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const prefix = previewImgId.replace(/PhotoImg$/, '');

    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      input.click();
    });

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      if (!this._validateImageFile(file)) {
        input.value = '';
        return;
      }

      this.activeMovementPhotoFile = file;
      this.movementPhotoRemoved = false;

      const reader = new FileReader();
      reader.onload = (e) => this.updatePhotoPreviewUI(prefix, e.target.result);
      reader.readAsDataURL(file);
    });
  }

  /** Uploader dedicado para imágenes de metas — guarda el File real, no base64 */
  setupGoalPhotoUploader(zoneId, inputId, imgId, emptyId, previewId, mode) {
    const zone    = document.getElementById(zoneId);
    const input   = document.getElementById(inputId);
    const img     = document.getElementById(imgId);
    const empty   = document.getElementById(emptyId);
    const preview = document.getElementById(previewId);

    if (!zone || !input) return;

    zone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      input.click();
    });

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      if (!this._validateImageFile(file)) {
        input.value = '';
        return;
      }

      // Guardar el File real para enviarlo como FormData
      this.activeGoalPhotoFile = file;
      this.goalPhotoRemoved = false;

      // Preview local inmediato
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (img) {
          img.src = ev.target.result;
          img.classList.add('lightbox-clickable');
          img.onclick = (e) => {
            e.stopPropagation();
            if (window.lightbox) window.lightbox.open(ev.target.result, 'Vista previa');
          };
        }
        if (empty)   empty.style.display   = 'none';
        if (preview) preview.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    });

    // Botón quitar imagen
    const removeBtnId = mode === 'create' ? 'createGoalPhotoRemove' : 'editGoalPhotoRemove';
    const removeBtn = document.getElementById(removeBtnId);
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeGoalPhotoFile = null;
        this.goalPhotoRemoved = true;
        if (input) input.value = '';
        if (img)     img.src = '';
        if (empty)   empty.style.display   = '';
        if (preview) preview.style.display = 'none';
      });
    }
  }

  updatePhotoPreviewUI(prefix, photoData) {
    const empty = document.getElementById(`${prefix}PhotoEmpty`);
    const preview = document.getElementById(`${prefix}PhotoPreview`);
    const img = document.getElementById(`${prefix}PhotoImg`);

    if (photoData) {
      if (img) {
        img.src = photoData;
        img.classList.add('lightbox-clickable');
        img.onclick = (e) => {
          e.stopPropagation();
          if (window.lightbox) window.lightbox.open(photoData, 'Vista previa');
        };
      }
      if (empty) empty.style.display = 'none';
      if (preview) preview.style.display = 'flex';
    } else {
      if (img) {
        img.src = '';
        img.classList.remove('lightbox-clickable');
        img.onclick = null;
      }
      if (empty) empty.style.display = 'flex';
      if (preview) preview.style.display = 'none';
    }
  }

  selectMovementType(formPrefix, type) {
    const ingresoBtn = document.getElementById(`${formPrefix}TypeIngreso`);
    const retiroBtn = document.getElementById(`${formPrefix}TypeRetiro`);
    const hiddenTypeInput = document.getElementById(`${formPrefix}MovType`);

    if (hiddenTypeInput) hiddenTypeInput.value = type;

    if (type === 'ingreso') {
      ingresoBtn.className = 'type-option-btn active type-ingreso';
      retiroBtn.className = 'type-option-btn';
    } else {
      ingresoBtn.className = 'type-option-btn';
      retiroBtn.className = 'type-option-btn active type-retiro';
    }
  }

  // --- Deletion Confirmations ---
  handleDeleteMovement(id, returnToMovements = false) {
    const mov = window.appState.getMovementById(id);
    if (!mov) return;

    window.modals.showDeleteConfirm(
      '¿Eliminar movimiento?',
      `Estás a punto de eliminar "${mov.name}" por valor de ${window.formatCurrency(mov.amount)}. El saldo se ajustará automáticamente.`,
      async () => {
        try {
          await window.appState.deleteMovement(id);
          if (returnToMovements) window.router.navigate('movements');
        } catch (err) {
          alert(err.message || 'No se pudo eliminar el movimiento.');
        }
      }
    );
  }

  handleDeleteGoal(id) {
    const goal = window.appState.getGoalById(id);
    if (!goal) return;

    window.modals.showDeleteConfirm(
      '¿Eliminar meta?',
      `Estás a punto de eliminar la meta "${goal.name}". Esta acción no se puede deshacer. El dinero abonado no vuelve al saldo automáticamente.`,
      async () => {
        try {
          await window.appState.deleteGoal(id);
        } catch (err) {
          alert(err.message || 'No se pudo eliminar la meta.');
        }
      }
    );
  }

  /**
   * Ejecuta una acción asíncrona de formulario evitando dobles envíos
   * y mostrando el error del servidor si falla.
   */
  async _submit(form, fn) {
    if (this.busy) return;
    this.busy = true;
    const submitBtn = form && form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      await fn();
    } catch (err) {
      alert(err.message || 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      this.busy = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /** Reduce una imagen a maxSize px (lado mayor) y la devuelve como data URL JPEG. */
  _resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen inválida')); };
      img.src = url;
    });
  }

  // --- Bind Event Listeners ---
  bindEvents() {
    // 0. Clics de todo el contenido generado dinámicamente (tarjetas, botones de acción)
    document.addEventListener('click', (e) => this._onDelegatedClick(e));

    // 1. Navigation items click
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        window.router.navigate(tab);
      });
    });

    // 2. Header Back Button
    const backBtn = document.getElementById('headerBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => window.router.back());
    }

    // 3. Movement Filter Tabs
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMovementFilter = btn.getAttribute('data-filter');
        this.renderMovementsList();
      });
    });

    // 4. Movement Search Input
    const searchInput = document.getElementById('movementsSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.movementSearchQuery = e.target.value;
        this.renderMovementsList();
      });
    }

    // 5. Setup Photo Uploaders — movimientos
    this.setupPhotoUploader('createMovPhotoZone', 'createMovPhotoInput', 'createMovPhotoImg', 'createMovPhotoEmpty', 'createMovPhotoPreview');
    this.setupPhotoUploader('editMovPhotoZone', 'editMovPhotoInput', 'editMovPhotoImg', 'editMovPhotoEmpty', 'editMovPhotoPreview');

    // Setup Photo Uploaders — metas
    this.setupGoalPhotoUploader('createGoalPhotoZone', 'createGoalPhotoInput', 'createGoalPhotoImg', 'createGoalPhotoEmpty', 'createGoalPhotoPreview', 'create');
    this.setupGoalPhotoUploader('editGoalPhotoZone',   'editGoalPhotoInput',   'editGoalPhotoImg',   'editGoalPhotoEmpty',   'editGoalPhotoPreview',   'edit');

    // 6. Movement Photo Actions (Remove Photo)
    const removeCreatePhoto = document.getElementById('createMovPhotoRemove');
    if (removeCreatePhoto) {
      removeCreatePhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeMovementPhotoFile = null;
        document.getElementById('createMovPhotoInput').value = '';
        this.updatePhotoPreviewUI('createMov', null);
      });
    }

    const removeEditPhoto = document.getElementById('editMovPhotoRemove');
    if (removeEditPhoto) {
      removeEditPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeMovementPhotoFile = null;
        this.movementPhotoRemoved = true;
        document.getElementById('editMovPhotoInput').value = '';
        this.updatePhotoPreviewUI('editMov', null);
      });
    }

    // 7. Movement Create Form Submission
    const formCreateMov = document.getElementById('formCreateMovement');
    if (formCreateMov) {
      formCreateMov.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('createMovType').value;
        const name = document.getElementById('createMovName').value.trim();
        const amount = parseInt(document.getElementById('createMovAmount').value, 10);
        const category = document.getElementById('createMovCategory').value;
        const date = document.getElementById('createMovDate').value;
        const description = document.getElementById('createMovDesc').value.trim();
        const photoFile = this.activeMovementPhotoFile;

        if (!name || isNaN(amount) || amount <= 0) {
          alert('Por favor completa el nombre y un monto válido mayor a 0');
          return;
        }

        // Los retiros pasan por el modal de confirmación (con todos sus datos)
        if (type === 'retiro') {
          window.modals.confirmWithdrawalStep(amount, name, category, { date, description, photoFile });
          return;
        }

        this._submit(formCreateMov, async () => {
          const oldBalance = window.appState.data.balance;
          await window.appState.addMovement({ type, name, amount, category, date, description }, photoFile);
          window.router.navigate('movements');
          window.animations.triggerGain(oldBalance, window.appState.data.balance, amount);
        });
      });
    }

    // 8. Movement Edit Form Submission
    const formEditMov = document.getElementById('formEditMovement');
    if (formEditMov) {
      formEditMov.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editMovId').value;
        const type = document.getElementById('editMovType').value;
        const name = document.getElementById('editMovName').value.trim();
        const amount = parseInt(document.getElementById('editMovAmount').value, 10);
        const category = document.getElementById('editMovCategory').value;
        const date = document.getElementById('editMovDate').value;
        const description = document.getElementById('editMovDesc').value.trim();

        if (!name || isNaN(amount) || amount <= 0) {
          alert('Por favor completa el nombre y un valor válido.');
          return;
        }

        this._submit(formEditMov, async () => {
          await window.appState.updateMovement(
            id,
            { type, name, amount, category, date, description },
            this.activeMovementPhotoFile,
            this.movementPhotoRemoved
          );
          window.router.navigate('movement-detail', { id });
        });
      });
    }

    // 9. Goal Create Form Submission
    const formCreateGoal = document.getElementById('formCreateGoal');
    if (formCreateGoal) {
      formCreateGoal.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('createGoalName').value.trim();
        const targetAmount = parseInt(document.getElementById('createGoalTarget').value, 10);
        const savedAmount = parseInt(document.getElementById('createGoalSaved').value, 10) || 0;
        const targetDate = document.getElementById('createGoalDate').value;
        const description = document.getElementById('createGoalDesc').value.trim();

        if (!name || isNaN(targetAmount) || targetAmount <= 0) {
          alert('Por favor ingresa un nombre y un valor objetivo válido.');
          return;
        }

        this._submit(formCreateGoal, async () => {
          await window.appState.addGoal(
            { name, targetAmount, savedAmount, targetDate, description },
            this.activeGoalPhotoFile || null
          );
          window.router.navigate('goals');
        });
      });
    }

    // 10. Goal Edit Form Submission
    const formEditGoal = document.getElementById('formEditGoal');
    if (formEditGoal) {
      formEditGoal.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editGoalId').value;
        const name = document.getElementById('editGoalName').value.trim();
        const targetAmount = parseInt(document.getElementById('editGoalTarget').value, 10);
        const savedAmount = parseInt(document.getElementById('editGoalSaved').value, 10) || 0;
        const targetDate = document.getElementById('editGoalDate').value;
        const description = document.getElementById('editGoalDesc').value.trim();

        if (!name || isNaN(targetAmount) || targetAmount <= 0) {
          alert('Por favor ingresa un nombre y un objetivo válido.');
          return;
        }

        this._submit(formEditGoal, async () => {
          await window.appState.updateGoal(
            id,
            { name, targetAmount, savedAmount, targetDate, description, removeImage: this.goalPhotoRemoved },
            this.activeGoalPhotoFile || null
          );
          window.router.navigate('goals');
        });
      });
    }

    // 11. Modal Actions Bindings
    // Withdraw Confirm Button
    // (Los botones "Confirmar retiro" y "Eliminar definitivamente" ya llaman a modals desde el HTML.)

    // Goal Deposit Modal Form
    const formGoalDeposit = document.getElementById('formGoalDeposit');
    if (formGoalDeposit) {
      formGoalDeposit.addEventListener('submit', (e) => {
        e.preventDefault();
        const goalId = document.getElementById('depositGoalId').value;
        const amount = document.getElementById('depositGoalAmount').value;
        window.modals.executeGoalDeposit(goalId, amount);
      });
    }

    // Quick Income Modal Form
    const formModalIncome = document.getElementById('formModalIncome');
    if (formModalIncome) {
      formModalIncome.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('incomeAmountInput').value;
        const name = document.getElementById('incomeNameInput').value || 'Ingreso rápido';
        window.modals.executeIncome(amount, name);
      });
    }

    // Quick Withdraw Modal Form
    const formModalWithdraw = document.getElementById('formModalWithdraw');
    if (formModalWithdraw) {
      formModalWithdraw.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('withdrawAmountInput').value;
        const name = document.getElementById('withdrawNameInput').value || 'Retiro de efectivo';
        window.modals.confirmWithdrawalStep(amount, name);
      });
    }

    // 12. Settings Actions
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const next = window.appState.toggleTheme();
        const label = document.getElementById('settingsThemeLabel');
        if (label) label.textContent = next === 'dark' ? 'Modo Oscuro' : 'Modo Claro';
      });
    }

    const exportBtn = document.getElementById('btnExportJSON');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const { currentUser, balance, totals, movements, goals } = window.appState.data;
        const json = JSON.stringify({ exported_at: new Date().toISOString(), user: currentUser, balance, totals, movements, goals }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gastos_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await window.appState.logout();
        window.router.navigate('login');
      });
    }

    // --- Avatar upload handler ---
    const avatarZone  = document.getElementById('settingsAvatarZone');
    const avatarInput = document.getElementById('settingsAvatarInput');
    if (avatarZone && avatarInput) {
      // Clic en la zona abre el menú de opciones (no directo al file picker)
      avatarZone.addEventListener('click', () => {
        const user = window.appState.data.currentUser;
        const menu     = document.getElementById('avatarMenu');
        const sheet    = document.getElementById('avatarMenuSheet');
        const backdrop = document.getElementById('avatarMenuBackdrop');
        const viewBtn  = document.getElementById('avatarMenuView');
        const changeBtn= document.getElementById('avatarMenuChange');
        if (!menu || !sheet) return;

        // Mostrar / ocultar opción "Ver foto" según si hay foto
        if (viewBtn) viewBtn.style.display = user && user.avatar_path ? 'flex' : 'none';

        // Abrir menú
        menu.style.display = 'flex';
        requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });

        function closeMenu() {
          sheet.style.transform = 'translateY(100%)';
          setTimeout(() => { menu.style.display = 'none'; }, 280);
        }

        // Cerrar al tocar backdrop
        backdrop.onclick = closeMenu;

        // Opción: ver foto
        if (viewBtn) {
          viewBtn.onclick = () => {
            closeMenu();
            if (user && user.avatar_path && window.lightbox) {
              window.lightbox.open(user.avatar_path, user.username || 'Foto de perfil');
            }
          };
        }

        // Opción: cambiar foto — misma lógica que antes
        if (changeBtn) {
          changeBtn.onclick = () => {
            closeMenu();
            setTimeout(() => avatarInput.click(), 300);
          };
        }
      });

      avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Preview local inmediato mientras sube
        const reader = new FileReader();
        reader.onload = (ev) => {
          const avatarImg         = document.getElementById('settingsAvatarImg');
          const avatarPlaceholder = document.getElementById('settingsAvatarPlaceholder');
          const headerImg         = document.getElementById('headerAvatarImg');
          const headerFallback    = document.getElementById('headerAvatarFallback');

          if (avatarImg) {
            avatarImg.src = ev.target.result;
            avatarImg.style.display = 'block';
          }
          if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
          if (headerImg) {
            headerImg.src = ev.target.result;
            headerImg.style.display = 'block';
          }
          if (headerFallback) headerFallback.style.display = 'none';
        };
        reader.readAsDataURL(file);

        // Subir al servidor
        try {
          await window.appState.uploadAvatar(file);
          // renderAll actualiza los avatares con la URL definitiva del servidor
          window.ui.renderAll();
        } catch (err) {
          alert(err.message || 'Error al guardar la foto de perfil.');
          // Revertir preview si falló
          window.ui.renderSettings();
          window.ui.renderHeader();
        }

        // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
        avatarInput.value = '';
      });
    }

    // 13. Auth (Login & Register) Handlers
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const userVal = document.getElementById('loginUsername').value.trim();
        // La contraseña NO se recorta: los espacios forman parte de ella
        const passVal = document.getElementById('loginPassword').value;

        if (!userVal || !passVal) {
          alert('Por favor ingresa usuario y contraseña');
          return;
        }

        // Navegar solo cuando el servidor confirmó el login
        this._submit(formLogin, async () => {
          await window.appState.login(userVal, passVal);
          document.getElementById('loginPassword').value = '';
          window.router.navigate('dashboard');
        });
      });
    }

    const formRegister = document.getElementById('formRegister');
    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;

        if (!username || !email || !password || !confirm) {
          alert('Por favor completa todos los campos.');
          return;
        }

        if (password.length < 8) {
          alert('La contraseña debe tener al menos 8 caracteres.');
          return;
        }

        if (password !== confirm) {
          alert('Las contraseñas no coinciden.');
          return;
        }

        this._submit(formRegister, async () => {
          await window.appState.register({ username, email, password, confirmPassword: confirm });
          window.router.navigate('dashboard');
        });
      });

      // Realtime validation visual indicators for Register
      const passInput = document.getElementById('regPassword');
      const passConfirmInput = document.getElementById('regConfirmPassword');
      const matchMsg = document.getElementById('passMatchMsg');

      const validateMatch = () => {
        if (!passConfirmInput.value) {
          passConfirmInput.classList.remove('is-valid', 'is-invalid');
          if (matchMsg) matchMsg.textContent = '';
          return;
        }

        if (passInput.value === passConfirmInput.value) {
          passConfirmInput.classList.remove('is-invalid');
          passConfirmInput.classList.add('is-valid');
          if (matchMsg) {
            matchMsg.style.color = 'var(--color-gain)';
            matchMsg.textContent = 'Las contraseñas coinciden perfectamente.';
          }
        } else {
          passConfirmInput.classList.remove('is-valid');
          passConfirmInput.classList.add('is-invalid');
          if (matchMsg) {
            matchMsg.style.color = 'var(--color-loss)';
            matchMsg.textContent = 'Las contraseñas no coinciden aún.';
          }
        }
      };

      if (passInput && passConfirmInput) {
        passInput.addEventListener('input', validateMatch);
        passConfirmInput.addEventListener('input', validateMatch);
      }
    }
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  // ── Color Wheel ──────────────────────────────────────────────────────────

  _updateColorPreview(hex) {
    const dot     = document.getElementById('accentPreviewDot');
    const btn     = document.getElementById('accentPreviewBtn');
    const pill    = document.getElementById('accentPreviewPill');
    const pill2   = document.getElementById('accentPreviewPill2');
    const hexEl   = document.getElementById('accentPreviewHex');
    if (dot)   dot.style.background   = hex;
    if (btn)   btn.style.background   = hex;
    if (pill)  pill.style.background  = hex;
    if (pill2) pill2.style.background = hex;
    if (hexEl) hexEl.textContent      = hex.toUpperCase();
  }

  _initColorWheel() {
    const canvas   = document.getElementById('colorWheelCanvas');
    const cursor   = document.getElementById('colorWheelCursor');
    const slider   = document.getElementById('colorWheelBrightness');
    if (!canvas || canvas._wheelBound) return;
    canvas._wheelBound = true;

    const ctx    = canvas.getContext('2d');
    const size   = canvas.width;
    const cx     = size / 2;
    const cy     = size / 2;
    const radius = cx - 2;

    let brightness = slider ? parseInt(slider.value, 10) / 100 : 0.7;

    // Dibujar la rueda de color
    const drawWheel = (bright) => {
      ctx.clearRect(0, 0, size, size);

      // Gradiente cónico (tono)
      const imageData = ctx.createImageData(size, size);
      const data = imageData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > radius) {
            data[(y * size + x) * 4 + 3] = 0; // transparente fuera del círculo
            continue;
          }

          const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
          const sat = dist / radius;

          // HSL → RGB
          const [r, g, b] = this._hslToRgb(hue / 360, sat, bright);
          const i = (y * size + x) * 4;
          data[i]     = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Borde sutil
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    // Posicionar el cursor dado un hex
    const positionCursorFromHex = (hex) => {
      if (!hex || !cursor) return;
      const [h, s] = this._hexToHsl(hex);
      const angle  = h * Math.PI * 2;
      const dist   = s * radius;
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      cursor.style.left = x + 'px';
      cursor.style.top  = y + 'px';
      cursor.style.background = hex;
    };

    // Color a partir de posición en el canvas
    const colorFromPos = (x, y, bright) => {
      const dx   = x - cx;
      const dy   = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sat  = Math.min(dist / radius, 1);
      const hue  = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
      const [r, g, b] = this._hslToRgb(hue / 360, sat, bright);
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    };

    const applyFromPos = (x, y) => {
      const rect  = canvas.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const cx2 = (x - rect.left) * scaleX;
      const cy2 = (y - rect.top)  * scaleY;
      const dx = cx2 - cx;
      const dy = cy2 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius + 2) return;

      const hex = colorFromPos(cx2, cy2, brightness);
      if (cursor) {
        const clampedX = cx + (dx / dist) * Math.min(dist, radius);
        const clampedY = cy + (dy / dist) * Math.min(dist, radius);
        const scaleBack = rect.width / size;
        cursor.style.left = (clampedX * scaleBack) + 'px';
        cursor.style.top  = (clampedY * scaleBack) + 'px';
        cursor.style.background = hex;
      }
      window.appState.setAccentColor(hex);
      this._updateColorPreview(hex);
    };

    // Eventos mouse
    canvas.addEventListener('click', (e) => applyFromPos(e.clientX, e.clientY));

    let dragging = false;
    canvas.addEventListener('mousedown', () => { dragging = true; });
    window.addEventListener('mouseup',   () => { dragging = false; });
    canvas.addEventListener('mousemove', (e) => { if (dragging) applyFromPos(e.clientX, e.clientY); });

    // Eventos touch
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); applyFromPos(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); applyFromPos(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });

    // Slider de brillo
    if (slider) {
      slider.addEventListener('input', () => {
        brightness = parseInt(slider.value, 10) / 100;
        drawWheel(brightness);
        // Re-aplicar el color actual con nuevo brillo
        const current = window.appState.data.accentColor;
        if (current) positionCursorFromHex(current);
      });
    }

    // Dibujo inicial y posición del cursor
    drawWheel(brightness);
    const currentAccent = window.appState.data.accentColor || '#3B82F6';
    positionCursorFromHex(currentAccent);
    this._updateColorPreview(currentAccent);
  }

  // Helpers de color
  _hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  _hexToHsl(hex) {
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h, s, l];
  }

}

window.ui = new UIManager();
