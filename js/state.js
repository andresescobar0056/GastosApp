/**
 * State Management & Backend Synchronization:
 * Conecta el estado del frontend con la base de datos MySQL mediante window.api.
 */

class StateManager {
  constructor() {
    this.listeners = [];
    this.data = {
      isAuthenticated: false,
      currentUser: {
        id: null,
        username: 'Invitado',
        email: '',
        tag: 'USR-0',
        avatar_path: null
      },
      balance: 0,
      totals: { total_income: 0, total_expense: 0 },
      movements: [],
      goals: [],
      categories: [],
      featuredGoal: null,
      theme: localStorage.getItem('gastos_theme') || 'dark',
      accentColor: localStorage.getItem('gastos_accent') || null,
      bgImage: localStorage.getItem('gastos_bg_image') || null
    };

    this.applyTheme(this.data.theme);
    this.applyAccent(this.data.accentColor);
    this.applyBgImage(this.data.bgImage);
  }

  async init() {
    try {
      // 1. Verificar si hay sesión activa en el servidor
      const authRes = await window.api.me().catch(() => null);
      if (authRes && authRes.success && authRes.data.user) {
        this.data.isAuthenticated = true;
        this.data.currentUser = authRes.data.user;
        await this.refreshData();
      } else {
        this.data.isAuthenticated = false;
      }
    } catch (e) {
      console.warn('No hay sesión activa o servidor no disponible:', e);
      this.data.isAuthenticated = false;
    }

    this.notify();
    return this.data.isAuthenticated;
  }

  async refreshData() {
    if (!this.data.isAuthenticated) return;

    try {
      // Cargar Dashboard
      const dash = await window.api.getDashboard();
      if (dash && dash.success && dash.data) {
        this.data.balance = parseFloat(dash.data.balance) || 0;
        this.data.totals = dash.data.totals || { total_income: 0, total_expense: 0 };
        this.data.featuredGoal = dash.data.featured_goal || null;
        if (dash.data.user) {
          // Preservar avatar_path si el backend no lo incluyó en esta respuesta
          this.data.currentUser = {
            ...this.data.currentUser,
            ...dash.data.user,
            avatar_path: dash.data.user.avatar_path ?? this.data.currentUser.avatar_path ?? null
          };
        }
      }

      // Cargar Movimientos
      const movs = await window.api.getTransactions();
      if (movs && movs.success && movs.data) {
        this.data.movements = (movs.data.movements || []).map(m => this.normalizeMovement(m));
      }

      // Cargar Metas
      const goals = await window.api.getGoals();
      if (goals && goals.success && goals.data) {
        this.data.goals = (goals.data.goals || []).map(g => this.normalizeGoal(g));
      }

      // Cargar Categorías
      const cats = await window.api.getCategories();
      if (cats && cats.success && cats.data) {
        this.data.categories = cats.data.categories || [];
      }
    } catch (e) {
      console.error('Error sincronizando datos con el backend:', e);
    }

    this.notify();
  }

  normalizeMovement(m) {
    return {
      id: m.id,
      type: m.type === 'income' ? 'ingreso' : 'retiro',
      name: m.name,
      amount: parseFloat(m.amount) || 0,
      description: m.description || '',
      date: m.transaction_date,
      category: m.category_name || 'General',
      photo: m.photo_path || null
    };
  }

  normalizeGoal(g) {
    return {
      id: g.id,
      name: g.name,
      description: g.description || '',
      targetAmount: parseFloat(g.target_amount) || 0,
      savedAmount: parseFloat(g.current_amount) || 0,
      progressPercentage: parseFloat(g.progress_percentage) || 0,
      targetDate: g.target_date || '',
      photo: g.image_path || null,
      rank: g.rank || window.RankSystem.getRankByPercentage(g.progress_percentage || 0)
    };
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.data));
  }

  // --- Theme & Appearance Management ---

  /** Cambia el tema (dark | light | amoled | sepia) */
  setTheme(theme) {
    const validThemes = ['dark', 'light', 'amoled', 'sepia'];
    if (!validThemes.includes(theme)) return;
    this.data.theme = theme;
    localStorage.setItem('gastos_theme', theme);
    this.applyTheme(theme);
    this.notify();
  }

  /** Mantiene el toggle rápido dark↔light para el botón del header */
  toggleTheme() {
    const next = this.data.theme === 'light' ? 'dark' : 'light';
    this.setTheme(next);
    return next;
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /** Cambia el color de acento; null = restablecer al del tema */
  setAccentColor(hex) {
    this.data.accentColor = hex;
    if (hex) {
      localStorage.setItem('gastos_accent', hex);
    } else {
      localStorage.removeItem('gastos_accent');
    }
    this.applyAccent(hex);
    this.notify();
  }

  applyAccent(hex) {
    const root = document.documentElement;
    if (!hex) {
      root.style.removeProperty('--accent-primary');
      root.style.removeProperty('--accent-primary-hover');
      root.style.removeProperty('--accent-gradient');
      root.style.removeProperty('--accent-glow');
      root.style.removeProperty('--border-focus');
      return;
    }
    // Calcular hover (ligeramente más oscuro) y glow
    const hover = this._darken(hex, 15);
    root.style.setProperty('--accent-primary', hex);
    root.style.setProperty('--accent-primary-hover', hover);
    root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${hex} 0%, ${hover} 100%)`);
    root.style.setProperty('--accent-glow', this._hexToRgba(hex, 0.35));
    root.style.setProperty('--border-focus', this._hexToRgba(hex, 0.5));
  }

  /** Establece imagen de fondo; null = quitar */
  setBgImage(dataUrl) {
    this.data.bgImage = dataUrl;
    if (dataUrl) {
      localStorage.setItem('gastos_bg_image', dataUrl);
    } else {
      localStorage.removeItem('gastos_bg_image');
    }
    this.applyBgImage(dataUrl);
    this.notify();
  }

  applyBgImage(dataUrl) {
    const container = document.querySelector('.app-container');
    if (!container) return;
    if (dataUrl) {
      container.style.backgroundImage = `url(${dataUrl})`;
      container.style.backgroundSize  = 'cover';
      container.style.backgroundPosition = 'center';
      // Overlay oscuro para mantener legibilidad
      container.style.setProperty('--bg-overlay-opacity', '0.72');
    } else {
      container.style.backgroundImage = '';
      container.style.removeProperty('--bg-overlay-opacity');
    }
  }

  // ── Color helpers ────────────────────────────────────────────────────────

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  // --- Auth Operations ---
  async login(usernameOrEmail, password) {
    const res = await window.api.login(usernameOrEmail, password);
    if (res && res.success && res.data.user) {
      this.data.isAuthenticated = true;
      this.data.currentUser = res.data.user;
      await this.refreshData();
      return res;
    }
    throw new Error(res.message || 'Error al iniciar sesión');
  }

  async register(userData) {
    const res = await window.api.register(
      userData.username,
      userData.email,
      userData.password,
      userData.confirmPassword
    );
    if (res && res.success && res.data.user) {
      this.data.isAuthenticated = true;
      this.data.currentUser = res.data.user;
      await this.refreshData();
      return res;
    }
    throw new Error(res.message || 'Error al registrar usuario');
  }

  async logout() {
    try {
      await window.api.logout();
    } catch (e) {
      console.warn('Error en logout:', e);
    }
    this.data.isAuthenticated = false;
    this.data.currentUser = { id: null, username: 'Invitado', email: '', tag: 'USR-0', avatar_path: null };
    this.data.balance = 0;
    this.data.movements = [];
    this.data.goals = [];
    this.notify();
  }

  // --- Financial Operations ---
  async addIncome(amount, name, category = 'General', description = '', photoFile = null) {
    const res = await window.api.createTransaction({
      type: 'income',
      name: name || 'Ingreso de dinero',
      amount,
      category,
      description
    }, photoFile);

    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al registrar ingreso');
  }

  async executeWithdrawal(amount, name, category = 'Retiro', description = '', photoFile = null) {
    const res = await window.api.createTransaction({
      type: 'expense',
      name: name || 'Retiro de dinero',
      amount,
      category,
      description
    }, photoFile);

    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al registrar retiro');
  }

  // --- Movements CRUD ---
  async addMovement(mov, photoFile = null) {
    const type = mov.type === 'ingreso' ? 'income' : 'expense';
    const res = await window.api.createTransaction({
      type,
      name: mov.name,
      amount: mov.amount,
      category: mov.category,
      date: mov.date,
      description: mov.description
    }, photoFile || mov.photo);

    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al crear movimiento');
  }

  async updateMovement(id, mov, photoFile = null) {
    const type = mov.type === 'ingreso' ? 'income' : 'expense';
    const res = await window.api.updateTransaction(id, {
      type,
      name: mov.name,
      amount: mov.amount,
      category: mov.category,
      date: mov.date,
      description: mov.description
    }, photoFile || mov.photo);

    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al actualizar movimiento');
  }

  async deleteMovement(id) {
    const res = await window.api.deleteTransaction(id);
    if (res && res.success) {
      await this.refreshData();
      return true;
    }
    throw new Error(res.message || 'Error al eliminar movimiento');
  }

  getMovementById(id) {
    return this.data.movements.find(m => String(m.id) === String(id)) || null;
  }

  // --- Goals CRUD ---
  async addGoal(goal, photoFile = null) {
    const res = await (photoFile instanceof File
      ? window.api.createGoalWithImage(goal, photoFile)
      : window.api.createGoal(goal));
    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al crear meta');
  }

  async updateGoal(id, goal, photoFile = null) {
    const res = await (photoFile instanceof File
      ? window.api.updateGoalWithImage(id, goal, photoFile)
      : window.api.updateGoal(id, goal));
    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al actualizar meta');
  }

  async uploadGoalImage(id, photoFile) {
    const res = await window.api.updateGoalImage(id, photoFile);
    if (res && res.success) {
      // Actualizar solo la meta afectada en el estado local sin refrescar todo
      if (res.data && res.data.goal) {
        const normalized = this.normalizeGoal(res.data.goal);
        const idx = this.data.goals.findIndex(g => String(g.id) === String(id));
        if (idx !== -1) {
          this.data.goals[idx] = normalized;
        } else {
          this.data.goals.unshift(normalized);
        }
        this.notify();
      }
      return res.data;
    }
    throw new Error(res.message || 'Error al actualizar imagen de la meta');
  }

  async depositToGoal(id, amount) {
    const res = await window.api.depositToGoal(id, amount);
    if (res && res.success) {
      await this.refreshData();
      return res.data;
    }
    throw new Error(res.message || 'Error al abonar a la meta');
  }

  async deleteGoal(id) {
    const res = await window.api.deleteGoal(id);
    if (res && res.success) {
      await this.refreshData();
      return true;
    }
    throw new Error(res.message || 'Error al eliminar meta');
  }

  getGoalById(id) {
    return this.data.goals.find(g => String(g.id) === String(id)) || null;
  }

  // --- Avatar Upload ---
  async uploadAvatar(photoFile) {
    const res = await window.api.updateAvatar(photoFile);
    if (res && res.success && res.data.user) {
      this.data.currentUser = res.data.user;
      this.notify();
      return res.data.user;
    }
    throw new Error(res.message || 'Error al actualizar la foto de perfil');
  }
}

// Global Currency Formatter
function formatCurrency(amount) {
  const num = Math.round(Number(amount) || 0);
  return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Export singleton
window.appState = new StateManager();
window.formatCurrency = formatCurrency;
