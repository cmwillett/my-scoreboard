import { renderScoreboard } from './pages/scoreboard.js';
import { renderGolfers } from './pages/golfers.js';
import { renderWorldCup } from './pages/worldcup.js';
import { renderAdmin } from './pages/admin.js';
import { getPageVisibility } from './api.js';
import { CONFIG } from './config.js';
import { startAutoRefresh, stopAutoRefresh } from './services/refresh.js';
import { initPwaInstallPrompt } from './components/pwaInstall.js';

const content = document.getElementById('app-content');
const navButtons = document.querySelectorAll('.bottom-nav button');

const pages = {
  scoreboard: renderScoreboard,
  golfers: renderGolfers,
  worldcup: renderWorldCup,
  admin: renderAdmin
};

const defaultVisibility = {
  scoreboard: true,
  golfers: true,
  worldcup: true,
  admin: true
};

let pageVisibility = { ...defaultVisibility };
let currentPage = 'scoreboard';
let renderToken = 0;

function isPageVisible(pageKey) {
  if (pageKey === 'admin') return true;
  return pageVisibility[pageKey] !== false;
}

function getFirstVisiblePage() {
  if (isPageVisible('scoreboard')) return 'scoreboard';
  if (isPageVisible('golfers')) return 'golfers';
  if (isPageVisible('worldcup')) return 'worldcup';
  return 'admin';
}

function applyNavVisibility(activePageKey) {
  let visibleCount = 0;

  navButtons.forEach(btn => {
    const pageKey = btn.dataset.page;
    const visible = isPageVisible(pageKey);

    btn.style.display = visible ? '' : 'none';
    btn.classList.toggle('active', pageKey === activePageKey);

    if (visible) visibleCount++;
  });

  const nav = document.querySelector('.bottom-nav');
  if (nav) {
    nav.style.gridTemplateColumns = `repeat(${Math.max(visibleCount, 1)}, 1fr)`;
  }
}

async function loadPageVisibility() {
  try {
    const result = await getPageVisibility();
    pageVisibility = {
      ...defaultVisibility,
      ...(result.data || {})
    };
  } catch (err) {
    console.error('Could not load page visibility settings.', err);
    pageVisibility = { ...defaultVisibility };
  }
}


function getUiSnapshot() {
  const openSections = Array.from(document.querySelectorAll('details.collapsible-section'))
    .map((details, index) => ({
      index,
      title: details.querySelector('summary span:first-child')?.textContent?.trim() || '',
      open: details.open === true
    }));

  return {
    scrollY: window.scrollY || document.documentElement.scrollTop || 0,
    openSections
  };
}

function restoreUiSnapshot(snapshot) {
  if (!snapshot) return;

  const detailsList = Array.from(document.querySelectorAll('details.collapsible-section'));

  snapshot.openSections?.forEach(section => {
    const match = detailsList.find((details, index) => {
      const title = details.querySelector('summary span:first-child')?.textContent?.trim() || '';
      return title === section.title || index === section.index;
    });

    if (match) match.open = section.open === true;
  });

  requestAnimationFrame(() => {
    window.scrollTo({ top: snapshot.scrollY || 0, left: 0, behavior: 'auto' });
  });
}

async function renderPage(pageKey, options = {}) {
  const { showLoading = true, updateHash = true, preserveUi = false } = options;
  const uiSnapshot = preserveUi ? getUiSnapshot() : null;
  const thisRender = ++renderToken;

  stopAutoRefresh();

  const targetPage = isPageVisible(pageKey) ? pageKey : getFirstVisiblePage();
  const renderer = pages[targetPage] || renderScoreboard;

  if (showLoading) {
    content.innerHTML = `
      <div class="card">
        Loading...
      </div>
    `;
  }

  const html = await renderer();

  if (thisRender !== renderToken) return;

  content.innerHTML = html;
  restoreUiSnapshot(uiSnapshot);
  currentPage = targetPage;

  applyNavVisibility(targetPage);

  if (updateHash && window.location.hash.replace('#', '') !== targetPage) {
    window.location.hash = targetPage;
  }

  if (targetPage === 'scoreboard' || targetPage === 'golfers') {
    const refreshInterval = targetPage === 'golfers'
      ? (CONFIG.GOLF_REFRESH_INTERVAL || CONFIG.REFRESH_INTERVAL)
      : CONFIG.REFRESH_INTERVAL;

    startAutoRefresh(() => {
      refreshCurrentPage({ showLoading: false });
    }, refreshInterval);
  }
}

async function refreshCurrentPage(options = {}) {
  await loadPageVisibility();
  await renderPage(currentPage || getFirstVisiblePage(), {
    showLoading: options.showLoading === true,
    updateHash: false,
    preserveUi: options.preserveUi !== false
  });
}

window.refreshCurrentPage = refreshCurrentPage;
window.navigateToPage = renderPage;

navButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    await renderPage(btn.dataset.page);
  });
});

window.addEventListener('hashchange', async () => {
  const pageFromHash = window.location.hash.replace('#', '') || getFirstVisiblePage();

  if (pageFromHash !== currentPage) {
    await renderPage(pageFromHash, { updateHash: false });
  }
});

async function initApp() {
  await loadPageVisibility();
  applyNavVisibility();

  const startingPage = window.location.hash.replace('#', '') || getFirstVisiblePage();
  await renderPage(startingPage);
}

initApp();
initPwaInstallPrompt();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service-worker.js')
    .catch(err => console.error('SW registration failed:', err));
}
