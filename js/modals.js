/**
 * Modals System:
 * - Withdrawal Confirmation Modal (with Remaining Balance calculation)
 * - Quick Income (Sumar dinero) Modal
 * - Quick Withdrawal initiation Modal
 * - Delete Confirmation Modal
 * - Goal Contribution Modal
 * - Photo Viewer Zoom Modal
 */

class ModalManager {
  constructor() {
    this.activeModal = null;
    this.onConfirmCallback = null;
  }

  init() {
    // Backdrop click dismisses modal
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeAll();
        }
      });
    });
  }

  open(modalId) {
    // Cerrar otros modales visualmente sin limpiar el estado pendiente
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      this.activeModal = modal;
    }
  }

  closeAll() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    this.activeModal = null;
    this.pendingWithdrawal = null;
    this.pendingDeleteAction = null;
    this.onConfirmCallback = null;
  }

  // --- 1. Withdrawal Flow & Confirmation Modal ---
  showWithdrawalInput() {
    const modal = document.getElementById('modalWithdrawInput');
    const input = document.getElementById('withdrawAmountInput');
    const nameInput = document.getElementById('withdrawNameInput');
    if (input) input.value = '';
    if (nameInput) nameInput.value = '';
    this.open('modalWithdrawInput');
  }

  /**
   * extra: { date, description, photoFile } — datos adicionales cuando el retiro
   * viene del formulario completo de "Nuevo movimiento".
   */
  confirmWithdrawalStep(amount, name = 'Retiro en efectivo', category = 'Retiro', extra = {}) {
    const currentBalance = window.appState.data.balance;
    const withdrawVal = parseInt(amount, 10) || 0;

    if (withdrawVal <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    if (withdrawVal > currentBalance) {
      alert('El saldo disponible es insuficiente para este retiro.');
      return;
    }

    const remainingBalance = currentBalance - withdrawVal;

    // Llenar los datos requeridos en el modal
    const elAmount = document.getElementById('confirmWithdrawAmount');
    const elRemaining = document.getElementById('confirmRemainingBalance');
    if (elAmount) elAmount.textContent = window.formatCurrency(withdrawVal);
    if (elRemaining) elRemaining.textContent = window.formatCurrency(remainingBalance);

    this.pendingWithdrawal = {
      amount: withdrawVal,
      name: name || 'Retiro en efectivo',
      category: category || 'Retiro',
      description: extra.description || '',
      photoFile: extra.photoFile || null,
      date: extra.date || null
    };

    this.open('modalWithdrawConfirm');
  }

  executeConfirmedWithdrawal() {
    if (!this.pendingWithdrawal) return;
    const { amount, name, category, description, photoFile, date } = this.pendingWithdrawal;
    this.pendingWithdrawal = null;

    const oldBalance = window.appState.data.balance;

    // Cerrar el modal
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    this.activeModal = null;

    // Asegurar que estamos en el dashboard para ver la animación
    if (window.router && window.router.currentScreen !== 'dashboard') {
      window.router.navigate('dashboard');
    }

    // Esperar la respuesta del servidor antes de actualizar UI y animación
    window.appState.executeWithdrawal(amount, name, category, description, photoFile, date)
      .then(() => {
        const newBalance = window.appState.data.balance;
        setTimeout(() => {
          window.animations.triggerLoss(oldBalance, newBalance, amount);
        }, 80);
        if (window.ui) window.ui.renderAll();
      })
      .catch(err => {
        alert(err.message || 'Error al registrar el retiro.');
        if (window.ui) window.ui.renderAll();
      });
  }

  // --- 2. Quick Income Flow ---
  showIncomeInput() {
    const input = document.getElementById('incomeAmountInput');
    const nameInput = document.getElementById('incomeNameInput');
    if (input) input.value = '';
    if (nameInput) nameInput.value = '';
    this.open('modalIncomeInput');
  }

  executeIncome(amount, name = 'Ingreso de dinero', category = 'Ingreso') {
    const incomeVal = parseInt(amount, 10) || 0;
    if (incomeVal <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    const oldBalance = window.appState.data.balance;
    this.closeAll();

    // Esperar la respuesta del servidor antes de actualizar UI y animación
    window.appState.addIncome(incomeVal, name, category)
      .then(() => {
        const newBalance = window.appState.data.balance;
        window.animations.triggerGain(oldBalance, newBalance, incomeVal);
        if (window.ui) window.ui.renderAll();
      })
      .catch(err => {
        alert(err.message || 'Error al registrar el ingreso.');
        if (window.ui) window.ui.renderAll();
      });
  }

  // --- 3. Delete Confirmation Modal ---
  showDeleteConfirm(title, message, onConfirm) {
    document.getElementById('deleteModalTitle').textContent = title;
    document.getElementById('deleteModalMessage').textContent = message;

    this.pendingDeleteAction = () => {
      onConfirm();
      if (window.ui) window.ui.renderAll();
    };

    this.open('modalDeleteConfirm');
  }

  executeConfirmedDelete() {
    if (this.pendingDeleteAction) {
      const action = this.pendingDeleteAction;
      this.pendingDeleteAction = null;
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
      this.activeModal = null;
      action();
    }
  }

  // --- 4. Goal Contribution Modal ---
  showGoalDeposit(goalId) {
    const goal = window.appState.getGoalById(goalId);
    if (!goal) return;

    document.getElementById('depositGoalTitle').textContent = `Abonar a "${goal.name}" (disponible: ${window.formatCurrency(window.appState.data.balance)})`;
    document.getElementById('depositGoalId').value = goal.id;
    document.getElementById('depositGoalAmount').value = '';

    this.open('modalGoalDeposit');
  }

  executeGoalDeposit(goalId, amount) {
    const val = parseInt(amount, 10) || 0;
    if (val <= 0) {
      alert('Ingresa un monto válido a abonar.');
      return;
    }

    // El abono sale del saldo disponible (el servidor lo vuelve a validar)
    if (val > window.appState.data.balance) {
      alert('El saldo disponible es insuficiente para este abono.');
      return;
    }

    this.closeAll();

    window.appState.depositToGoal(goalId, val)
      .then(() => {
        if (window.ui) window.ui.renderAll();
      })
      .catch(err => {
        alert(err.message || 'Error al abonar a la meta.');
        if (window.ui) window.ui.renderAll();
      });
  }

  // --- 5. Photo Viewer — delegates to the full Lightbox ---
  showPhotoZoom(imgSrc, title = 'Fotografía adjunta') {
    if (window.lightbox && imgSrc) {
      window.lightbox.open(imgSrc, title);
    }
  }
}

window.modals = new ModalManager();
