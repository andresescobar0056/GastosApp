/**
 * SPA Router:
 * Manages transitions between all 11 screens:
 * 1. login
 * 2. register
 * 3. dashboard
 * 4. movements
 * 5. movement-create
 * 6. movement-edit
 * 7. movement-detail
 * 8. goals
 * 9. goal-create
 * 10. goal-edit
 * 11. settings
 */

class Router {
  constructor() {
    this.currentScreen = null;
    this.currentParams = {};
    this.historyStack = [];

    this.screenTitles = {
      'login': 'Iniciar Sesión',
      'register': 'Crear Cuenta',
      'dashboard': 'Dashboard',
      'movements': 'Movimientos',
      'movement-create': 'Nuevo Movimiento',
      'movement-edit': 'Editar Movimiento',
      'movement-detail': 'Detalle de Movimiento',
      'goals': 'Metas de Ahorro',
      'goal-create': 'Nueva Meta',
      'goal-edit': 'Editar Meta',
      'settings': 'Configuración'
    };

    this.mainTabs = ['dashboard', 'movements', 'goals', 'settings'];
  }

  init() {
    window.addEventListener('hashchange', () => this.handleHashChange());
    
    // Initial navigation
    if (window.location.hash) {
      this.handleHashChange();
    } else {
      if (window.appState.data.isAuthenticated) {
        this.navigate('dashboard');
      } else {
        this.navigate('login');
      }
    }
  }

  navigate(screenId, params = {}) {
    let hash = `#${screenId}`;
    if (params && Object.keys(params).length > 0) {
      const query = new URLSearchParams(params).toString();
      hash += `?${query}`;
    }
    window.location.hash = hash;
  }

  back() {
    if (this.historyStack.length > 1) {
      this.historyStack.pop(); // Remove current
      const prev = this.historyStack.pop(); // Get previous
      if (prev) {
        this.navigate(prev.screenId, prev.params);
        return;
      }
    }
    // Fallback to dashboard
    this.navigate('dashboard');
  }

  handleHashChange() {
    const rawHash = window.location.hash.replace(/^#/, '') || 'dashboard';
    const [screenId, queryString] = rawHash.split('?');
    const params = {};

    if (queryString) {
      const urlParams = new URLSearchParams(queryString);
      for (const [key, value] of urlParams.entries()) {
        params[key] = value;
      }
    }

    this.activateScreen(screenId, params);
  }

  activateScreen(screenId, params = {}) {
    const targetEl = document.getElementById(`screen-${screenId}`);
    if (!targetEl) {
      console.warn(`Screen ${screenId} not found, redirecting to dashboard.`);
      this.navigate('dashboard');
      return;
    }

    // Check auth protection
    if (!window.appState.data.isAuthenticated && screenId !== 'login' && screenId !== 'register') {
      this.navigate('login');
      return;
    }

    // Deactivate previous screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    // Activate new screen
    targetEl.classList.add('active');
    this.currentScreen = screenId;
    this.currentParams = params;
    this.historyStack.push({ screenId, params });

    // Update Layout UI State (header, bottom nav)
    this.updateLayoutState(screenId);

    // Scroll viewport to top smoothly
    const viewport = document.querySelector('.screens-viewport');
    if (viewport) viewport.scrollTop = 0;

    // Trigger Screen Specific Data Population
    if (window.ui) {
      window.ui.onScreenEnter(screenId, params);
    }
  }

  updateLayoutState(screenId) {
    const appContainer = document.querySelector('.app-container');
    const isAuth = screenId === 'login' || screenId === 'register';
    const isSub = !this.mainTabs.includes(screenId) && !isAuth;

    // 1. Auth mode toggle (hides bottom nav)
    if (appContainer) {
      if (isAuth) {
        appContainer.classList.add('auth-mode');
      } else {
        appContainer.classList.remove('auth-mode');
      }

      if (isSub) {
        appContainer.classList.add('is-subscreen');
      } else {
        appContainer.classList.remove('is-subscreen');
      }
    }

    // 2. Update Header Title
    const headerTitle = document.getElementById('headerScreenTitle');
    if (headerTitle) {
      headerTitle.textContent = this.screenTitles[screenId] || 'Control de Gastos';
    }

    // 3. Update Bottom Nav active item
    document.querySelectorAll('.nav-item').forEach(item => {
      const tab = item.getAttribute('data-tab');
      if (tab === screenId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

window.router = new Router();
