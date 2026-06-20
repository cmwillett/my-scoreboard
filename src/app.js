const content = document.getElementById('app-content');
const navButtons = document.querySelectorAll('.bottom-nav button');

const pages = {
  scoreboard: `
    <div class="card">
      <h2>Scoreboard</h2>
      <p>Games will show here.</p>
    </div>
  `,
  golfers: `
    <div class="card">
      <h2>Golfers</h2>
      <p>Followed golfers will show here.</p>
    </div>
  `,
  worldcup: `
    <div class="card">
      <h2>World Cup</h2>
      <p>World Cup games will show here.</p>
    </div>
  `,
  addgame: `
    <div class="card">
      <h2>Add Game</h2>
      <p>Add-game form will go here.</p>
    </div>
  `,
  admin: `
    <div class="card">
      <h2>Admin</h2>
      <p>Admin tools will go here.</p>
    </div>
  `
};

function renderPage(page) {
  content.innerHTML = pages[page] || pages.scoreboard;

  navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    renderPage(btn.dataset.page);
  });
});

renderPage('scoreboard');