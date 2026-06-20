import { renderScoreboard } from './pages/scoreboard.js';
import { renderGolfers } from './pages/golfers.js';
import { renderWorldCup } from './pages/worldcup.js';
import { renderAddGame } from './pages/addgame.js';
import { renderAdmin } from './pages/admin.js';

const content = document.getElementById('app-content');
const navButtons = document.querySelectorAll('.bottom-nav button');

const pages = {
  scoreboard: renderScoreboard,
  golfers: renderGolfers,
  worldcup: renderWorldCup,
  addgame: renderAddGame,
  admin: renderAdmin
};

function renderPage(pageKey) {
  const renderer = pages[pageKey] || renderScoreboard;

  content.innerHTML = renderer();

  navButtons.forEach(btn => {
    btn.classList.toggle(
      'active',
      btn.dataset.page === pageKey
    );
  });

  window.location.hash = pageKey;
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    renderPage(btn.dataset.page);
  });
});

const startingPage =
  window.location.hash.replace('#', '') || 'scoreboard';

renderPage(startingPage);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service-worker.js')
    .catch(err => console.error('SW registration failed:', err));
}