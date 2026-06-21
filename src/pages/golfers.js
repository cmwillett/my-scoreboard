import {
  getFollowedGolfers,
  addFollowedGolfer,
  removeFollowedGolfer,
  updateFollowedGolferOrder
} from '../api.js';
import { formatLastUpdated } from '../utils/date.js';

const SORT_MODE_KEY = 'golfersSortMode';

function parseGolfScore(value) {
  const text = String(value || '').trim();

  if (!text || text === '-') return 999;
  if (text.toUpperCase() === 'E') return 0;
  if (text.startsWith('+')) return Number(text.slice(1));
  return Number(text);
}

function getSortMode() {
  return localStorage.getItem(SORT_MODE_KEY) || 'score';
}

function setSortMode(mode) {
  localStorage.setItem(SORT_MODE_KEY, mode);
}

function sortGolfers(golfers, mode) {
  if (mode === 'manual') {
    return [...golfers].sort((a, b) => Number(a.sortOrder || 999) - Number(b.sortOrder || 999));
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

  return `
    <tr
      class="golfer-row"
      data-golfer="${golfer.golfer}"
      draggable="${draggable}"
    >
      ${
        draggable
          ? `<td class="drag-handle">☰</td>`
          : ''
      }
      <td>${golfer.golfer || '-'}</td>
      <td>${golfer.position || '-'}</td>
      <td>${golfer.overall || '-'}</td>
      <td>${golfer.today || '-'}</td>
      <td>${golfer.thru || golfer.teeTime || '-'}</td>
      <td>${golfer.note || golfer.notes || '-'}</td>
      <td>
        <button
          class="small-btn edit-golfer-note-btn"
          data-golfer="${golfer.golfer}"
          data-note="${golfer.note || golfer.notes || ''}"
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

function openGolferNoteModal(golfer, currentNote, favorite) {
  const modal = document.createElement('div');

  modal.className = 'modal-backdrop';

  modal.innerHTML = `
    <div class="modal-card">
      <h3>Edit Note</h3>
      <p><strong>${golfer}</strong></p>

      <textarea id="golfer-note-modal-input" rows="5">${currentNote || ''}</textarea>

      <div class="modal-actions">
        <button id="cancel-golfer-note" class="small-btn">Cancel</button>
        <button id="save-golfer-note" class="primary-btn">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('cancel-golfer-note').addEventListener('click', () => {
    modal.remove();
  });

  document.getElementById('save-golfer-note').addEventListener('click', async () => {
    const note = document.getElementById('golfer-note-modal-input').value.trim();

    try {
      await addFollowedGolfer(golfer, note, favorite);
      modal.remove();
      location.reload();
    } catch (err) {
      console.error(err);
      alert('Could not save note.');
    }
  });
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
        alert('Could not save golfer order.');
      }

      draggedRow = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();

      const afterElement = getDragAfterElement(tbody, e.clientY);

      if (!afterElement) {
        tbody.appendChild(draggedRow);
      } else {
        tbody.insertBefore(draggedRow, afterElement);
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const rows = [...container.querySelectorAll('.golfer-row:not(.dragging)')];

  return rows.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return {
        offset,
        element: child
      };
    }

    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function attachGolferHandlers() {
  document.querySelectorAll('.sort-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setSortMode(btn.dataset.sortMode);
      location.reload();
    });
  });

  document.querySelectorAll('.remove-golfer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const golfer = btn.dataset.golfer;

      if (!confirm(`Remove ${golfer}?`)) return;

      btn.disabled = true;
      btn.textContent = 'Removing...';

      try {
        await removeFollowedGolfer(golfer);
        location.reload();
      } catch (err) {
        console.error(err);
        alert('Could not remove golfer.');
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
  });

  document.querySelectorAll('.edit-golfer-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openGolferNoteModal(
        btn.dataset.golfer,
        btn.dataset.note || '',
        btn.dataset.favorite === 'true'
      );
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
        <h2>Golfers</h2>
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
          ? `<p class="manual-sort-note">Drag golfers to reorder them.</p>`
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
              <p>Go to Add Game/Golfer to follow a golfer.</p>
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