/**
 * MockApiClient — reemplaza ApiClient PHP con localStorage.
 * Misma interfaz que ApiClient, mismo contrato de respuesta { success, message, data }.
 */

class MockApiClient {
  constructor() {
    this._store = {
      users:        () => JSON.parse(localStorage.getItem('mock_users')        || '[]'),
      transactions: () => JSON.parse(localStorage.getItem('mock_transactions') || '[]'),
      goals:        () => JSON.parse(localStorage.getItem('mock_goals')        || '[]'),
      categories:   () => JSON.parse(localStorage.getItem('mock_categories')   || 'null'),
      session:      () => JSON.parse(localStorage.getItem('mock_session')      || 'null'),
    };

    this._save = {
      users:        v => localStorage.setItem('mock_users',        JSON.stringify(v)),
      transactions: v => localStorage.setItem('mock_transactions', JSON.stringify(v)),
      goals:        v => localStorage.setItem('mock_goals',        JSON.stringify(v)),
      categories:   v => localStorage.setItem('mock_categories',   JSON.stringify(v)),
      session:      v => localStorage.setItem('mock_session',      JSON.stringify(v)),
    };

    this._nextId = key => {
      const items = this._store[key]();
      return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    };

    // Categorías por defecto
    if (!this._store.categories()) {
      this._save.categories([
        'Alimentación', 'Transporte', 'Entretenimiento', 'Salud',
        'Educación', 'Ropa', 'Hogar', 'Servicios', 'Trabajo', 'General'
      ]);
    }
  }

  // ── Helpers internos ────────────────────────────────────────────────────────

  _ok(data, message = 'OK', status = 200) {
    return { success: true, message, data, status };
  }

  _err(message, status = 400) {
    const err = new Error(message);
    err.status = status;
    err.data = null;
    throw err;
  }

  _session() {
    return this._store.session();
  }

  _requireAuth() {
    const s = this._session();
    if (!s) this._err('No autenticado', 401);
    return s;
  }

  _computeBalance(userId) {
    const txs = this._store.transactions().filter(t => t.user_id === userId);
    return txs.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);
  }

  _computeTotals(userId) {
    const txs = this._store.transactions().filter(t => t.user_id === userId);
    return {
      total_income:  txs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0),
      total_expense: txs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0),
    };
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  async login(usernameOrEmail, password) {
    const users = this._store.users();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usernameOrEmail);
    const user = isEmail
      ? users.find(u => u.email === usernameOrEmail)
      : users.find(u => u.username === usernameOrEmail);

    if (!user) this._err('Usuario o contraseña incorrectos');
    if (user.password !== this._hash(password)) this._err('Usuario o contraseña incorrectos');

    // Incluir avatar_path si el usuario lo tiene guardado
    const sessionUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      tag: `USR-${user.id}`,
      avatar_path: user.avatar_path || null
    };
    this._save.session(sessionUser);
    return this._ok({ user: sessionUser }, 'Login exitoso');
  }

  async register(username, email, password, confirmPassword) {
    if (!username || !email || !password || !confirmPassword) this._err('Todos los campos son requeridos');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) this._err('Email inválido');
    if (password.length < 6) this._err('La contraseña debe tener al menos 6 caracteres');
    if (password !== confirmPassword) this._err('Las contraseñas no coinciden');

    const users = this._store.users();
    if (users.find(u => u.email === email)) this._err('El email ya está registrado');
    if (users.find(u => u.username === username)) this._err('El nombre de usuario ya está en uso');

    const id = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser = { id, username, email, password: this._hash(password), avatar_path: null };
    this._save.users([...users, newUser]);

    const sessionUser = { id, username, email, tag: `USR-${id}`, avatar_path: null };
    this._save.session(sessionUser);
    return this._ok({ user: sessionUser }, 'Registro exitoso', 201);
  }

  async logout() {
    this._save.session(null);
    return this._ok({}, 'Sesión cerrada');
  }

  async me() {
    const s = this._session();
    if (!s) this._err('No autenticado', 401);
    // Leer siempre el usuario fresco desde mock_users para tener avatar_path actualizado
    const users = this._store.users();
    const user = users.find(u => u.id === s.id);
    if (!user) this._err('Usuario no encontrado', 404);
    const freshSession = {
      id: user.id,
      username: user.username,
      email: user.email,
      tag: `USR-${user.id}`,
      avatar_path: user.avatar_path || null
    };
    // Actualizar sesión con datos frescos
    this._save.session(freshSession);
    return this._ok({ user: freshSession });
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  async getDashboard() {
    const s = this._requireAuth();
    const balance = this._computeBalance(s.id);
    const totals = this._computeTotals(s.id);
    const goals = this._store.goals().filter(g => g.user_id === s.id);
    const featuredGoal = goals.length > 0
      ? goals.reduce((best, g) => {
          const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
          const bestPct = best.target_amount > 0 ? (best.current_amount / best.target_amount) * 100 : 0;
          return pct > bestPct ? g : best;
        }, goals[0])
      : null;

    return this._ok({
      balance,
      totals,
      // Leer usuario fresco desde mock_users para incluir avatar_path
      user: (() => {
        const users = this._store.users();
        const u = users.find(u => u.id === s.id);
        return u ? { id: u.id, username: u.username, email: u.email, tag: `USR-${u.id}`, avatar_path: u.avatar_path || null } : s;
      })(),
      featured_goal: featuredGoal ? this._formatGoal(featuredGoal) : null,
    });
  }

  // ── Transactions ────────────────────────────────────────────────────────────

  async getTransactions(type = null, search = null) {
    const s = this._requireAuth();
    let txs = this._store.transactions().filter(t => t.user_id === s.id);

    if (type && type !== 'all') txs = txs.filter(t => t.type === type);
    if (search) {
      const q = search.toLowerCase();
      txs = txs.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category_name || '').toLowerCase().includes(q)
      );
    }

    txs = txs.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    return this._ok({ movements: txs });
  }

  async getTransaction(id) {
    const s = this._requireAuth();
    const tx = this._store.transactions().find(t => t.id === Number(id) && t.user_id === s.id);
    if (!tx) this._err('Movimiento no encontrado', 404);
    return this._ok({ movement: tx });
  }

  async createTransaction(movData, photoFile = null) {
    const s = this._requireAuth();
    const txs = this._store.transactions();
    const id = txs.length > 0 ? Math.max(...txs.map(t => t.id)) + 1 : 1;

    let photoPath = null;
    if (photoFile instanceof File) {
      photoPath = await this._fileToDataUrl(photoFile);
    } else if (typeof photoFile === 'string' && photoFile) {
      photoPath = photoFile;
    }

    const tx = {
      id,
      user_id: s.id,
      type: movData.type,
      name: movData.name || 'Sin nombre',
      amount: parseFloat(movData.amount) || 0,
      category_name: movData.category || 'General',
      description: movData.description || '',
      transaction_date: movData.date || new Date().toISOString().split('T')[0],
      photo_path: photoPath,
    };

    this._save.transactions([...txs, tx]);
    return this._ok({ movement: tx }, 'Movimiento creado', 201);
  }

  async updateTransaction(id, movData, photoFile = null) {
    const s = this._requireAuth();
    const txs = this._store.transactions();
    const idx = txs.findIndex(t => t.id === Number(id) && t.user_id === s.id);
    if (idx === -1) this._err('Movimiento no encontrado', 404);

    let photoPath = txs[idx].photo_path;
    if (photoFile instanceof File) {
      photoPath = await this._fileToDataUrl(photoFile);
    } else if (typeof photoFile === 'string' && photoFile) {
      photoPath = photoFile;
    }

    txs[idx] = {
      ...txs[idx],
      type: movData.type,
      name: movData.name || txs[idx].name,
      amount: parseFloat(movData.amount) || txs[idx].amount,
      category_name: movData.category || txs[idx].category_name,
      description: movData.description !== undefined ? movData.description : txs[idx].description,
      transaction_date: movData.date || txs[idx].transaction_date,
      photo_path: photoPath,
    };

    this._save.transactions(txs);
    return this._ok({ movement: txs[idx] }, 'Movimiento actualizado');
  }

  async deleteTransaction(id) {
    const s = this._requireAuth();
    const txs = this._store.transactions();
    const filtered = txs.filter(t => !(t.id === Number(id) && t.user_id === s.id));
    if (filtered.length === txs.length) this._err('Movimiento no encontrado', 404);
    this._save.transactions(filtered);
    return this._ok({}, 'Movimiento eliminado');
  }

  // ── Goals ───────────────────────────────────────────────────────────────────

  async getGoals() {
    const s = this._requireAuth();
    const goals = this._store.goals()
      .filter(g => g.user_id === s.id)
      .map(g => this._formatGoal(g));
    return this._ok({ goals });
  }

  async getGoal(id) {
    const s = this._requireAuth();
    const g = this._store.goals().find(g => g.id === Number(id) && g.user_id === s.id);
    if (!g) this._err('Meta no encontrada', 404);
    return this._ok({ goal: this._formatGoal(g) });
  }

  async createGoal(goalData) {
    const s = this._requireAuth();
    const goals = this._store.goals();
    const id = goals.length > 0 ? Math.max(...goals.map(g => g.id)) + 1 : 1;

    const goal = {
      id,
      user_id: s.id,
      name: goalData.name,
      target_amount: parseFloat(goalData.target_amount) || 0,
      current_amount: parseFloat(goalData.saved_amount) || 0,
      target_date: goalData.target_date || null,
      description: goalData.description || '',
      image_path: null,
    };

    this._save.goals([...goals, goal]);
    return this._ok({ goal: this._formatGoal(goal) }, 'Meta creada', 201);
  }

  async updateGoal(id, goalData) {
    const s = this._requireAuth();
    const goals = this._store.goals();
    const idx = goals.findIndex(g => g.id === Number(id) && g.user_id === s.id);
    if (idx === -1) this._err('Meta no encontrada', 404);

    goals[idx] = {
      ...goals[idx],
      name: goalData.name || goals[idx].name,
      target_amount: parseFloat(goalData.target_amount) || goals[idx].target_amount,
      current_amount: parseFloat(goalData.saved_amount) !== undefined ? parseFloat(goalData.saved_amount) : goals[idx].current_amount,
      target_date: goalData.target_date !== undefined ? goalData.target_date : goals[idx].target_date,
      description: goalData.description !== undefined ? goalData.description : goals[idx].description,
    };

    this._save.goals(goals);
    return this._ok({ goal: this._formatGoal(goals[idx]) }, 'Meta actualizada');
  }

  async depositToGoal(goalId, amount) {
    const s = this._requireAuth();
    const goals = this._store.goals();
    const idx = goals.findIndex(g => g.id === Number(goalId) && g.user_id === s.id);
    if (idx === -1) this._err('Meta no encontrada', 404);

    const deposit = parseFloat(amount) || 0;
    if (deposit <= 0) this._err('El monto debe ser mayor a 0');

    goals[idx].current_amount = Math.min(
      goals[idx].current_amount + deposit,
      goals[idx].target_amount
    );

    this._save.goals(goals);
    return this._ok({ goal: this._formatGoal(goals[idx]) }, 'Depósito realizado');
  }

  async deleteGoal(id) {
    const s = this._requireAuth();
    const goals = this._store.goals();
    const filtered = goals.filter(g => !(g.id === Number(id) && g.user_id === s.id));
    if (filtered.length === goals.length) this._err('Meta no encontrada', 404);
    this._save.goals(filtered);
    return this._ok({}, 'Meta eliminada');
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async getCategories() {
    const cats = this._store.categories() || [];
    return this._ok({ categories: cats });
  }

  // ── Avatar ──────────────────────────────────────────────────────────────────

  async updateAvatar(photoFile) {
    const s = this._requireAuth();
    let avatarPath = null;
    if (photoFile instanceof File) {
      avatarPath = await this._fileToDataUrl(photoFile);
    }
    // Actualizar en la sesión y en users
    const users = this._store.users();
    const idx = users.findIndex(u => u.id === s.id);
    if (idx !== -1) {
      users[idx].avatar_path = avatarPath;
      this._save.users(users);
    }
    const session = { ...s, avatar_path: avatarPath };
    this._save.session(session);
    return this._ok({ user: session }, 'Foto de perfil actualizada');
  }

  // ── Goal Image ───────────────────────────────────────────────────────────────

  async updateGoalImage(id, photoFile) {
    const s = this._requireAuth();
    const goals = this._store.goals();
    const idx = goals.findIndex(g => g.id === Number(id) && g.user_id === s.id);
    if (idx === -1) this._err('Meta no encontrada', 404);
    if (photoFile instanceof File) {
      goals[idx].image_path = await this._fileToDataUrl(photoFile);
      this._save.goals(goals);
    }
    return this._ok({ goal: this._formatGoal(goals[idx]) }, 'Imagen actualizada');
  }

  async createGoalWithImage(goalData, photoFile = null) {
    const goals = this._store.goals();
    const s = this._requireAuth();
    const id = goals.length > 0 ? Math.max(...goals.map(g => g.id)) + 1 : 1;
    let imagePath = null;
    if (photoFile instanceof File) imagePath = await this._fileToDataUrl(photoFile);
    const goal = {
      id,
      user_id: s.id,
      name: goalData.name,
      target_amount: parseFloat(goalData.targetAmount) || 0,
      current_amount: parseFloat(goalData.savedAmount) || 0,
      target_date: goalData.targetDate || null,
      description: goalData.description || '',
      image_path: imagePath,
    };
    this._save.goals([...goals, goal]);
    return this._ok({ goal: this._formatGoal(goal) }, 'Meta creada', 201);
  }

  async updateGoalWithImage(id, goalData, photoFile = null) {
    const s = this._requireAuth();
    const goals = this._store.goals();
    const idx = goals.findIndex(g => g.id === Number(id) && g.user_id === s.id);
    if (idx === -1) this._err('Meta no encontrada', 404);
    let imagePath = goals[idx].image_path;
    if (photoFile instanceof File) imagePath = await this._fileToDataUrl(photoFile);
    goals[idx] = {
      ...goals[idx],
      name: goalData.name || goals[idx].name,
      target_amount: parseFloat(goalData.targetAmount) || goals[idx].target_amount,
      current_amount: parseFloat(goalData.savedAmount) ?? goals[idx].current_amount,
      target_date: goalData.targetDate !== undefined ? goalData.targetDate : goals[idx].target_date,
      description: goalData.description !== undefined ? goalData.description : goals[idx].description,
      image_path: imagePath,
    };
    this._save.goals(goals);
    return this._ok({ goal: this._formatGoal(goals[idx]) }, 'Meta actualizada');
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _formatGoal(g) {
    const pct = g.target_amount > 0
      ? Math.min((g.current_amount / g.target_amount) * 100, 100)
      : 0;
    return {
      id: g.id,
      name: g.name,
      description: g.description || '',
      target_amount: g.target_amount,
      current_amount: g.current_amount,
      progress_percentage: parseFloat(pct.toFixed(2)),
      target_date: g.target_date || '',
      image_path: g.image_path || null,
      rank: typeof window.RankSystem !== 'undefined'
        ? window.RankSystem.getRankByPercentage(pct)
        : null,
    };
  }

  /** Hasheo simple (no criptográfico) — suficiente para mock local */
  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return String(h >>> 0);
  }

  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Reemplaza el ApiClient PHP con la implementación mock
window.api = new MockApiClient();
console.info('[MockApi] Usando almacenamiento local (localStorage) en lugar del backend PHP.');
