/**
 * Cliente API para Comunicación Frontend -> Backend PHP
 * Maneja peticiones HTTP asíncronas con envío de sesión (cookies).
 */

class ApiClient {
  constructor() {
    this.baseUrl = 'backend/api';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/${endpoint}`;
    
    const config = {
      credentials: 'same-origin',
      ...options,
      // X-Requested-With es exigido por el backend en peticiones POST (protección CSRF)
      headers: { 'X-Requested-With': 'XMLHttpRequest', ...(options.headers || {}) }
    };

    // Si el body es un objeto plano y no es FormData, convertir a JSON
    if (config.body && !(config.body instanceof FormData) && typeof config.body === 'object') {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({
        success: false,
        message: `Error del servidor (${response.status})`
      }));

      if (!response.ok || !data.success) {
        const error = new Error(data.message || 'Error en la petición al servidor');
        error.status = response.status;
        error.data = data.data || null;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // --- Auth Endpoints ---
  async login(usernameOrEmail, password) {
    return this.request('auth.php?action=login', {
      method: 'POST',
      body: { username_or_email: usernameOrEmail, password }
    });
  }

  async register(username, email, password, confirmPassword) {
    return this.request('auth.php?action=register', {
      method: 'POST',
      body: {
        username,
        email,
        password,
        confirm_password: confirmPassword
      }
    });
  }

  async logout() {
    return this.request('auth.php?action=logout', {
      method: 'POST'
    });
  }

  async me() {
    return this.request('auth.php?action=me', {
      method: 'GET'
    });
  }

  // --- Dashboard Endpoint ---
  async getDashboard() {
    return this.request('dashboard.php', {
      method: 'GET'
    });
  }

  // --- Transactions Endpoints ---
  async getTransactions(type = null, search = null) {
    let query = 'transactions.php?action=list';
    if (type && type !== 'all') query += `&type=${encodeURIComponent(type)}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    return this.request(query, { method: 'GET' });
  }

  async getTransaction(id) {
    return this.request(`transactions.php?action=detail&id=${encodeURIComponent(id)}`, { method: 'GET' });
  }

  /** Construye el FormData de un movimiento. photoFile: File nuevo (opcional). */
  _movementForm(movData, photoFile, extra = {}) {
    const body = new FormData();
    Object.entries(extra).forEach(([k, v]) => body.append(k, v));
    body.append('type', movData.type);
    body.append('name', movData.name);
    body.append('amount', movData.amount);
    body.append('category', movData.category || 'General');
    body.append('date', movData.date || window.todayISO());
    body.append('description', movData.description || '');
    if (photoFile instanceof File) body.append('photo', photoFile);
    return body;
  }

  async createTransaction(movData, photoFile = null) {
    return this.request('transactions.php?action=create', {
      method: 'POST',
      body: this._movementForm(movData, photoFile)
    });
  }

  /** removePhoto = true borra la foto actual (si no se envía una nueva). */
  async updateTransaction(id, movData, photoFile = null, removePhoto = false) {
    const extra = { id };
    if (removePhoto) extra.remove_photo = '1';
    return this.request('transactions.php?action=update', {
      method: 'POST',
      body: this._movementForm(movData, photoFile, extra)
    });
  }

  async deleteTransaction(id) {
    return this.request('transactions.php?action=delete', {
      method: 'POST',
      body: { id }
    });
  }

  // --- Goals Endpoints ---
  async getGoals() {
    return this.request('goals.php?action=list', { method: 'GET' });
  }

  async getGoal(id) {
    return this.request(`goals.php?action=detail&id=${encodeURIComponent(id)}`, { method: 'GET' });
  }

  async createGoal(goalData) {
    return this.request('goals.php?action=create', {
      method: 'POST',
      body: {
        name: goalData.name,
        target_amount: goalData.targetAmount,
        saved_amount: goalData.savedAmount || 0,
        target_date: goalData.targetDate || null,
        description: goalData.description || ''
      }
    });
  }

  async updateGoal(id, goalData) {
    return this.request('goals.php?action=update', {
      method: 'POST',
      body: {
        id,
        remove_image: goalData.removeImage ? '1' : '0',
        name: goalData.name,
        target_amount: goalData.targetAmount,
        saved_amount: goalData.savedAmount || 0,
        target_date: goalData.targetDate || null,
        description: goalData.description || ''
      }
    });
  }

  async depositToGoal(goalId, amount) {
    return this.request('goals.php?action=deposit', {
      method: 'POST',
      body: { id: goalId, amount }
    });
  }

  async deleteGoal(id) {
    return this.request('goals.php?action=delete', {
      method: 'POST',
      body: { id }
    });
  }

  // --- Categories Endpoints ---
  async getCategories() {
    return this.request('categories.php?action=list', { method: 'GET' });
  }

  // --- Avatar Endpoint ---
  async updateAvatar(photoFile) {
    const body = new FormData();
    body.append('avatar', photoFile);
    return this.request('auth.php?action=update_avatar', {
      method: 'POST',
      body
    });
  }

  // --- Goal Image Endpoint ---
  async updateGoalImage(id, photoFile) {
    const body = new FormData();
    body.append('image', photoFile);
    body.append('id', id);
    return this.request(`goals.php?action=update_image&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      body
    });
  }

  async createGoalWithImage(goalData, photoFile = null) {
    if (photoFile instanceof File) {
      const body = new FormData();
      body.append('name', goalData.name);
      body.append('target_amount', goalData.targetAmount);
      body.append('saved_amount', goalData.savedAmount || 0);
      body.append('target_date', goalData.targetDate || '');
      body.append('description', goalData.description || '');
      body.append('image', photoFile);
      return this.request('goals.php?action=create', { method: 'POST', body });
    }
    return this.createGoal(goalData);
  }

  async updateGoalWithImage(id, goalData, photoFile = null) {
    if (photoFile instanceof File) {
      const body = new FormData();
      body.append('id', id);
      body.append('name', goalData.name);
      body.append('target_amount', goalData.targetAmount);
      body.append('saved_amount', goalData.savedAmount || 0);
      body.append('target_date', goalData.targetDate || '');
      body.append('description', goalData.description || '');
      body.append('image', photoFile);
      return this.request('goals.php?action=update', { method: 'POST', body });
    }
    return this.updateGoal(id, goalData);
  }
}

window.api = new ApiClient();
