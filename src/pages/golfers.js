import {
  getFollowedGolfers,
  addFollowedGolfer,
  removeFollowedGolfer,
  updateFollowedGolferOrder,
  removeAllFollowedGolfers
} from '../api.js';
import {
  openConfirmModal,
  openGolferNoteModal,
  openMessageModal,
  showToast
} from '../components/modal.js';
import { formatLastUpdated } from '../utils/date.js';
import { renderDensityToggle } from '../components/pageTools.js';

const SORT_MODE_KEY = 'golfersSortMode';

function parseGolfScore(value) {
  const text = String(value || '').trim();

  if (!text || text === '-') return 999;
  if (text.toUpperCase() === 'E') return 0;
  if (text.startsWith('+')) return Number(text.slice(1));

  const parsed = Number(text);
  return Number.isNaN(parsed) ? 999 : parsed;
}

function getSortMode() {
  return localStorage.getItem(SORT_MODE_KEY) || 'score';
}

function setSortMode(mode) {
  localStorage.setItem(SORT_MODE_KEY, mode);
}

function sortGolfers(golfers, mode) {
  if (mode === 'manual') {
    return [...golfers].sort(
      (a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999)
    );
  }

  return [...golfers].sort((a, b) => {
    const scoreA = parseGolfScore(a.overall);
    const scoreB = parseGolfScore(b.overall);

    if (scoreA !== scoreB) return scoreA - scoreB;

    return String(a.golfer || '').localeCompare(String(b.golfer || ''));
  });
}

function renderGolferRow(golfer, sortMode) {
  const draggable = sortMode === 'manual';
  const note = golfer.note || golfer.notes || '';

  return `
    <tr
      class="golfer-row"
      data-golfer="${golfer.golfer}"
      draggable="${draggable}"
    >
      ${draggable ? '<td class="drag-handle">☰</td>' : ''}
      <td>${golfer.golfer || '-'}</td>
      <td>${golfer.position || '-'}</td>
      <td>${golfer.overall || '-'}</td>
      <td>${golfer.today || '-'}</td>
      <td>${golfer.thru || golfer.teeTime || '-'}</td>
      <td>${note || '-'}</td>
      <td>
        <button
          class="small-btn edit-golfer-note-btn"
          data-golfer="${golfer.golfer}"
          data-note="${note}"
          data-favorite="${golfer.favorite ? 'true' : 'false'}"
        >
          Edit
        </button>
      </td>
      <td>
        <button class="small-btn danger remove-golfer-btn" data-golfer="${golfer.golfer}">
          Remove
        </button>
      </td>
    </tr>
  `;
}

function getDragAfterElement(container, y) {
  const rows = [...container.querySelectorAll('.golfer-row:not(.dragging)')];

  return rows.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }

    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function attachDragHandlers() {
  const tbody = document.getElementById('golfers-table-body');
  if (!tbody) return;

  let draggedRow = null;

  tbody.querySelectorAll('.golfer-row').forEach(row => {
    row.addEventListener('dragstart', () => {
      draggedRow = row;
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', async () => {
      row.classList.remove('dragging');

      const golfers = [...tbody.querySelectorAll('.golfer-row')]
        .map(r => r.dataset.golfer)
        .filter(Boolean);

      try {
        await updateFollowedGolferOrder(golfers);
      } catch (err) {
        console.error(err);
        openMessageModal({
          title: 'Could Not Save Order',
          message: 'The manual golfer order was not saved.'
        });
      }

      draggedRow = null;
    });

    row.addEventListener('dragover', event => {
      event.preventDefault();

      const afterElement = getDragAfterElement(tbody, event.clientY);

      if (!afterElement) {
        tbody.appendChild(draggedRow);
      } else {
        tbody.insertBefore(draggedRow, afterElement);
      }
    });
  });
}

function attachGolferHandlers() {
  const removeAllBtn = document.getElementById('remove-all-golfers-btn');

  if (removeAllBtn) {
    removeAllBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Remove All Golfers?',
        message: 'This will remove all followed golfers and their notes.',
        confirmText: 'Remove All',
        onConfirm: async () => {
          await removeAllFollowedGolfers();
          showToast('All golfers removed.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  }

  document.querySelectorAll('.sort-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setSortMode(btn.dataset.sortMode);
      window.refreshCurrentPage?.({ preserveUi: true });
    });
  });

  document.querySelectorAll('.remove-golfer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const golfer = btn.dataset.golfer;

      openConfirmModal({
        title: 'Remove Golfer?',
        message: `This will remove ${golfer} from your followed golfers.`,
        confirmText: 'Remove',
        onConfirm: async () => {
          await removeFollowedGolfer(golfer);
          showToast(`${golfer} removed.`);
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  document.querySelectorAll('.edit-golfer-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGolferNoteModal({
        golfer: btn.dataset.golfer,
        note: btn.dataset.note || '',
        favorite: btn.dataset.favorite === 'true',
        onSave: async ({ golfer, note, favorite }) => {
          await addFollowedGolfer(golfer, note, favorite);
          showToast('Golfer note saved.');
          await window.refreshCurrentPage?.();
        }
      });
    });
  });

  if (getSortMode() === 'manual') {
    attachDragHandlers();
  }
}

export async function renderGolfers() {
  try {
    const result = await getFollowedGolfers();
    const followedGolfers = result.data || [];

    const sortMode = getSortMode();
    const golfers = sortGolfers(followedGolfers, sortMode);
    const lastUpdated = formatLastUpdated();

    const firstGolfer = golfers[0] || {};
    const cutLine = firstGolfer.cutLine || '-';
    const currentRound = firstGolfer.currentRound || '-';

    setTimeout(attachGolferHandlers, 0);

    return `
      <div class="page-header">
        <div class="page-title-row">
          <h2>Golfers</h2>

          <div class="page-actions">
            ${renderDensityToggle('golfers')}
            ${
              golfers.length
                ? `
                  <button id="remove-all-golfers-btn" class="small-btn danger">
                    Remove All
                  </button>
                `
                : ''
            }
          </div>
        </div>

        <p>${currentRound} • Cut line: ${cutLine}</p>
        <p class="last-updated">Golf Last Updated: ${lastUpdated}</p>
      </div>

      <div class="sort-toggle">
        <button
          class="sort-toggle-btn ${sortMode === 'score' ? 'active' : ''}"
          data-sort-mode="score"
        >
          Score Sort
        </button>

        <button
          class="sort-toggle-btn ${sortMode === 'manual' ? 'active' : ''}"
          data-sort-mode="manual"
        >
          Manual Sort
        </button>
      </div>

      ${
        sortMode === 'manual'
          ? '<p class="manual-sort-note">Drag golfers to reorder them.</p>'
          : ''
      }

      ${
        golfers.length
          ? `
            <div class="card">
              <div class="table-wrap">
                <table class="golfers-table">
                  <thead>
                    <tr>
                      ${sortMode === 'manual' ? '<th></th>' : ''}
                      <th>Golfer</th>
                      <th>Pos</th>
                      <th>Total</th>
                      <th>Today</th>
                      <th>Thru / Tee</th>
                      <th>Note</th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody id="golfers-table-body">
                    ${golfers.map(golfer => renderGolferRow(golfer, sortMode)).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `
          : `
            <div class="card empty-state">
              <h3>No followed golfers yet</h3>
              <p>Go to Admin → Follow Golfer/Team to follow a golfer.</p>
            </div>
          `
      }
    `;
  } catch (err) {
    console.error(err);

    return `
      <div class="page-header">
        <h2>Golfers</h2>
      </div>

      <div class="card">
        Failed to load golfers.
      </div>
    `;
  }
}
