const content = document.getElementById('app-content');
const navButtons = document.querySelectorAll('.bottom-nav button');

const pages = {
  scoreboard: {
    title: 'Scoreboard',
    html: `
      <div class="page-header">
        <h2>Scoreboard</h2>
        <p>Today’s games and followed teams.</p>
      </div>

      <div class="card">
        <h3>Live Scores</h3>
        <p>Games will show here.</p>
      </div>
    `
  },

  golfers: {
    title: 'Golfers',
    html: `
      <div class="page-header">
        <h2>Golfers</h2>
        <p>Follow your selected golfers.</p>
      </div>

      <div class="card">
        <h3>Followed Golfers</h3>
        <p>Golfer cards will show here.</p>
      </div>
    `
  },

  worldcup: {
    title: 'World Cup',
    html: `
      <div class="page-header">
        <h2>World Cup</h2>
        <p>Track World Cup games and favorites.</p>
      </div>

      <div class="card">
        <h3>World Cup Games</h3>
        <p>World Cup games will show here.</p>
      </div>
    `
  },

  addgame: {
    title: 'Add Game',
    html: `
      <div class="page-header">
        <h2>Add Game</h2>
        <p>Add custom games to your scoreboard.</p>
      </div>

      <div class="card">
        <h3>New Game</h3>
        <p>Add-game form will go here.</p>
      </div>
    `
  },

  admin: {
    title: 'Admin',
    html: `
      <div class="page-header">
        <h2>Admin</h2>
        <p>Protected tools and settings.</p>
      </div>

      <div class="card">
        <h3>Admin Tools</h3>
        <p>PIN-protected admin tools will go here.</p>
      </div>
    `
  }
};

function renderPage(pageKey) {
  const page = pages[pageKey] || pages.scoreboard;

  content.innerHTML = page.html;

  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageKey);
  });

  window.location.hash = pageKey;
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    renderPage(btn.dataset.page);
  });
});

const startingPage = window.location.hash.replace('#', '') || 'scoreboard';
renderPage(startingPage);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js');
}