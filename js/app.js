/**
 * Application Bootstrap:
 * Initializes Router, UI, Modals, Smoke Canvas, PWA Service Worker e Install Banner.
 */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Initialize State and Modals
  window.modals.init();

  // 2. Initialize Smoke Canvas on the Dashboard Hero Card
  window.animations.initSmoke('smokeCanvas');

  // 3. Initialize UI & Event Handlers
  window.ui.init();

  // 4. Initialize Router
  window.router.init();

  // 5. Subscribe to State changes for auto-render
  window.appState.subscribe(() => {
    window.ui.renderAll();
  });

  // 6. Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    // updateViaCache: 'none' → el browser SIEMPRE verifica sw.js en la red,
    // ignorando el HTTP cache. Crítico para que Netlify sirva siempre el SW nuevo.
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(reg => {

        // Verificar actualizaciones cada vez que el usuario navega a la app
        reg.update();

        // SW nuevo encontrado mientras se instala
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nuevo SW listo — activar inmediatamente sin esperar cierre de pestañas
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // SW ya estaba esperando al cargar (p.ej. venía de una pestaña anterior)
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch(() => {
        // SW no disponible en dev local sin HTTPS — no bloquea la app
      });

    // Cuando el nuevo SW toma el control → recargar para servir archivos frescos
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  // 7. PWA Install Banner
  initInstallBanner();
});

// ── PWA Install Banner ───────────────────────────────────────────────────────

function initInstallBanner() {
  const banner      = document.getElementById('pwaInstallBanner');
  const installBtn  = document.getElementById('pwaInstallBtn');
  const dismissBtn  = document.getElementById('pwaInstallDismiss');

  if (!banner || !installBtn || !dismissBtn) return;

  // No mostrar si el usuario ya lo descartó o si ya está instalada
  const dismissed   = localStorage.getItem('pwa_install_dismissed');
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches
                   || window.navigator.standalone === true;

  if (isInstalled || dismissed) return;

  let deferredPrompt = null;

  // Chrome / Android captura el evento beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Mostrar el banner después de 3 s para no interrumpir la primera carga
    setTimeout(() => {
      banner.style.display = 'block';
      // Animar entrada
      requestAnimationFrame(() => {
        banner.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        banner.style.opacity    = '0';
        banner.style.transform  = 'translateX(-50%) translateY(20px)';
        requestAnimationFrame(() => {
          banner.style.opacity   = '1';
          banner.style.transform = 'translateX(-50%) translateY(0)';
        });
      });
    }, 3000);
  });

  // Botón instalar
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) {
      // Fallback: instruir al usuario manualmente
      alert('Para instalar:\n• Chrome Android: Menú (⋮) → "Añadir a pantalla de inicio"\n• Safari iOS: Compartir → "Añadir a pantalla de inicio"');
      hideBanner();
      return;
    }

    hideBanner();
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;

    if (outcome === 'accepted') {
      localStorage.setItem('pwa_install_dismissed', '1');
    }
  });

  // Botón descartar
  dismissBtn.addEventListener('click', () => {
    hideBanner();
    // Recordar por 7 días
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
    setTimeout(() => localStorage.removeItem('pwa_install_dismissed'), 7 * 24 * 60 * 60 * 1000);
  });

  // Si el usuario instala desde otro lugar, ocultar el banner
  window.addEventListener('appinstalled', () => {
    hideBanner();
    deferredPrompt = null;
    localStorage.setItem('pwa_install_dismissed', '1');
  });

  function hideBanner() {
    banner.style.opacity   = '0';
    banner.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => { banner.style.display = 'none'; }, 300);
  }
}
