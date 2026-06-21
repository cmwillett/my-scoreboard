import { renderScoreboard } from './pages/scoreboard.js';
import { renderGolfers } from './pages/golfers.js';
import { renderWorldCup } from './pages/worldcup.js';
import { renderAdmin } from './pages/admin.js';
import { CONFIG } from './config.js';
import { startAutoRefresh, stopAutoRefresh } from './services/refresh.js';

const content = document.getElementById('app-content');
const navButtons = document.querySelectorAll('.bottom-nav button');

const pages = {
  scoreboard: renderScoreboard,
  golfers: renderGolfers,
  worldcup: renderWorldCup,
  admin: renderAdmin
};

async function renderPage(pageKey) {
  stopAutoRefresh();

  const renderer = pages[pageKey] || renderScoreboard;

  content.innerHTML = `
    <div class="card">
      Loading...
    </div>
  `;

  content.innerHTML = await renderer();

  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageKey);
  });

  window.location.hash = pageKey;

  if (pageKey === 'scoreboard') {
    startAutoRefresh(() => {
      renderPage('scoreboard');
    }, CONFIG.REFRESH_INTERVAL);
  }
}

navButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    await renderPage(btn.dataset.page);
  });
});

const startingPage = window.location.hash.replace('#', '') || 'scoreboard';
renderPage(startingPage);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service-worker.js')
    .catch(err => console.error('SW registration failed:', err));
}
