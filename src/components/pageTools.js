const DENSITY_PREFIX = 'scoreboardPageDensity:';

export function getPageDensity(pageKey) {
  return localStorage.getItem(`${DENSITY_PREFIX}${pageKey}`) || 'comfortable';
}

export function setPageDensity(pageKey, density) {
  const nextDensity = density === 'condensed' ? 'condensed' : 'comfortable';
  localStorage.setItem(`${DENSITY_PREFIX}${pageKey}`, nextDensity);
  applyPageDensity(pageKey);
}

export function applyPageDensity(pageKey) {
  const content = document.getElementById('app-content');
  if (!content) return;

  const density = getPageDensity(pageKey);
  content.classList.toggle('density-condensed', density === 'condensed');
  content.classList.toggle('density-comfortable', density !== 'condensed');
  content.dataset.densityPage = pageKey;

  document.querySelectorAll('.density-toggle-btn').forEach(btn => {
    const isActive = btn.dataset.density === density;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

export function renderDensityToggle(pageKey) {
  const density = getPageDensity(pageKey);

  return `
    <div class="density-toggle" aria-label="Display density">
      <span>Display</span>
      <button
        type="button"
        class="density-toggle-btn ${density !== 'condensed' ? 'active' : ''}"
        data-page-density="${pageKey}"
        data-density="comfortable"
        aria-pressed="${density !== 'condensed' ? 'true' : 'false'}"
      >
        Expanded
      </button>
      <button
        type="button"
        class="density-toggle-btn ${density === 'condensed' ? 'active' : ''}"
        data-page-density="${pageKey}"
        data-density="condensed"
        aria-pressed="${density === 'condensed' ? 'true' : 'false'}"
      >
        Condensed
      </button>
    </div>
  `;
}
