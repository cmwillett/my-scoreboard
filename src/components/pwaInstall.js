const DISMISS_KEY = 'myScoreboardPwaInstallDismissedAt';
const DISMISS_DAYS = 14;

let deferredPrompt = null;
let bannerEl = null;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function wasRecentlyDismissed() {
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (!dismissedAt) return false;

  const ageMs = Date.now() - dismissedAt;
  const maxAgeMs = DISMISS_DAYS * 24 * 60 * 60 * 1000;
  return ageMs < maxAgeMs;
}

function markDismissed() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function removeBanner() {
  if (bannerEl) {
    bannerEl.remove();
    bannerEl = null;
  }
}

function createBanner({ canInstall }) {
  removeBanner();

  if (isStandalone() || wasRecentlyDismissed()) return;

  bannerEl = document.createElement('div');
  bannerEl.className = 'pwa-install-banner';

  const primaryButton = canInstall
    ? `<button type="button" class="pwa-install-btn">Install</button>`
    : '';

  bannerEl.innerHTML = `
    <div class="pwa-install-copy">
      <strong>Install My Scoreboard</strong>
      <span>${canInstall ? 'Add it to your home screen for quick access.' : 'Use your browser menu to add this app to your home screen.'}</span>
    </div>

    <div class="pwa-install-actions">
      ${primaryButton}
      <button type="button" class="pwa-dismiss-btn">Not now</button>
    </div>
  `;

  document.body.appendChild(bannerEl);

  const installBtn = bannerEl.querySelector('.pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      installBtn.disabled = true;
      deferredPrompt.prompt();

      try {
        await deferredPrompt.userChoice;
      } finally {
        deferredPrompt = null;
        removeBanner();
      }
    });
  }

  bannerEl.querySelector('.pwa-dismiss-btn').addEventListener('click', () => {
    markDismissed();
    removeBanner();
  });
}

function isIosSafari() {
  const ua = window.navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export function initPwaInstallPrompt() {
  if (isStandalone()) return;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    createBanner({ canInstall: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeBanner();
  });

  if (isIosSafari() && !wasRecentlyDismissed()) {
    window.setTimeout(() => {
      createBanner({ canInstall: false });
    }, 1500);
  }
}
