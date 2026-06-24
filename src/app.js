import { renderScoreboard } from './pages/scoreboard.js';
import { renderGolfers } from './pages/golfers.js';
import { renderWorldCup } from './pages/worldcup.js';
import { renderAdmin } from './pages/admin.js';
import { getPageVisibility } from './api.js';
import { CONFIG } from './config.js';
import { startAutoRefresh, stopAutoRefresh } from './services/refresh.js';
import { initPwaInstallPrompt } from './components/pwaInstall.js';
import { openHtmlModal } from './components/modal.js';
import { applyPageDensity, setPageDensity } from './components/pageTools.js';

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

  
document.addEventListener('click', event => {
  const densityBtn = event.target.closest('.density-toggle-btn');
  if (densityBtn) {
    setPageDensity(densityBtn.dataset.pageDensity, densityBtn.dataset.density);
    return;
  }
});

const helpBtn = document.getElementById('help-btn');
if (helpBtn) {
  helpBtn.addEventListener('click', openHelpAndChangeLog);
}

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
  applyPageDensity(targetPage);
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

function openHelpAndChangeLog() {
  openHtmlModal({
    title: 'Help / Change Log',
    html: `
      <div class="help-modal-content">
        <section>
          <h4>How My Scoreboard works</h4>
          <p><strong>Follow Team</strong> tells the app you care about a team. The scoreboard automatically shows that team's live game, recent final, or next upcoming game.</p>
          <p><strong>Favorite Team</strong> keeps a team on the scoreboard automatically, even when you have not specifically followed that team for the day.</p>
          <p><strong>Follow Golfer</strong> adds that golfer to the Golfers page and the Roku leaderboard.</p>
          <p><strong>World Cup</strong> is managed through the same Follow Team flow. Choose World Cup as the sport, then choose the country.</p>
        </section>

        <section>
          <h4>Display density</h4>
          <p>Each display page has its own Expanded / Condensed toggle. Condensed mode fits more games on one screen during busy football and basketball nights.</p>
        </section>

        <section>
          <h4>Admin</h4>
          <p><strong>Follow Golfer/Team</strong> manages who appears on the PWA and Roku scoreboard.</p>
          <p><strong>Followed Golfers/Teams</strong> shows what is currently selected.</p>
          <p><strong>Site Data</strong> controls page visibility, automatic refresh by sport, and manual refresh buttons.</p>
        </section>

        <section>
          <h4>Recent changes</h4>
          <ul>
            <li><strong>v0.9.2</strong> De-duplicated followed teams that are in the same game and uses Auto Refresh/In Season settings to hide out-of-season followed teams.</li>
            <li><strong>v0.8.8</strong> Cleaned up team-following so a specific game is no longer required.</li>
            <li><strong>v0.8.7</strong> Added stricter mobile-only overflow guards for game cards and schedule metadata.</li>
            <li><strong>v0.8.5</strong> Improved mobile layouts to reduce horizontal scrolling and convert tables into phone-friendly cards.</li>
            <li><strong>v0.8.4</strong> Added Privacy Policy and Terms of Use pages for Roku channel publishing.</li>
            <li><strong>v0.9.2</strong> Added Help / Change Log and per-page display density.</li>
            <li><strong>v0.8.2</strong> Renamed Admin language around following teams and golfers.</li>
            <li><strong>v0.8.1</strong> Added final-game winner highlighting and softer green buttons.</li>
            <li><strong>v0.8.0</strong> Improved Admin visual hierarchy.</li>
            <li><strong>v0.7.x</strong> Added World Cup Recent Finals, unified refresh controls, and Roku improvements.</li>
          </ul>
        </section>
      </div>
    `,
    buttonText: 'Close'
  });
}



document.addEventListener('click', event => {
  const densityBtn = event.target.closest('.density-toggle-btn');
  if (densityBtn) {
    setPageDensity(densityBtn.dataset.pageDensity, densityBtn.dataset.density);
    return;
  }
});

const helpBtn = document.getElementById('help-btn');
if (helpBtn) {
  helpBtn.addEventListener('click', openHelpAndChangeLog);
}

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
