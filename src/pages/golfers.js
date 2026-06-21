import {
  getAvailableGolfers,
  getFollowedGolfers,
  addFollowedGolfer,
  removeFollowedGolfer
} from '../api.js';
import { formatLastUpdated } from '../utils/date.js';

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function renderGolferRow(golfer) {
  return `
    <tr>
      <td>${golfer.golfer || '-'}</td>
      <td>${golfer.position || '-'}</td>
      <td>${golfer.overall || '-'}</td>
      <td>${golfer.today || '-'}</td>
      <td>${golfer.thru || golfer.teeTime || '-'}</td>
      <td>${golfer.note || '-'}</td>
      <td>
        <button 
          class="small-btn edit-golfer-note-btn" 
          data-golfer="${golfer.golfer}" 
          data-note="${golfer.note || ''}"
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
        <button id="cancel-golfer-note" class="small-btn">
          Cancel
        </button>

        <button id="save-golfer-note" class="primary-btn">
          Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById('cancel-golfer-note')
    .addEventListener('click', () => {
      modal.remove();
    });

  document
    .getElementById('save-golfer-note')
    .addEventListener('click', async () => {
      const note = document
        .getElementById('golfer-note-modal-input')
        .value
        .trim();

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

function attachGolferHandlers() {
  document.querySelectorAll('.remove-golfer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const golfer = btn.dataset.golfer;

      if (!confirm(`Remove ${golfer}?`)) return;

      btn.disabled = true;
      btn.textContent = 'Removing...';

      try {
        await removeFollowedGolfer(golfer);
        btn.closest('tr')?.remove();
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
}

export async function renderGolfers() {
  try {
    const [availableResult, followedResult] = await Promise.all([
      getAvailableGolfers(),
      getFollowedGolfers()
    ]);

    const allGolfers = availableResult.data || [];
    const followedGolfers = followedResult.data || [];

    const followedMap = new Map(
      followedGolfers.map(item => [normalizeName(item.golfer), item])
    );

    const golfers = allGolfers
      .filter(golfer => followedMap.has(normalizeName(golfer.golfer)))
      .map(golfer => {
        const followed = followedMap.get(normalizeName(golfer.golfer)) || {};

        return {
          ...golfer,
          note: followed.note || '',
          favorite: followed.favorite === true || followed.favorite === 'true'
        };
      });

    const lastUpdated = formatLastUpdated();

    const firstGolfer = allGolfers[0] || {};
    const cutLine = firstGolfer.cutLine || '-';
    const currentRound = firstGolfer.currentRound || '-';

    setTimeout(attachGolferHandlers, 0);

    return `
      <div class="page-header">
        <h2>Golfers</h2>
        <p>${currentRound} • Cut line: ${cutLine}</p>
        <p class="last-updated">Golf Last Updated: ${lastUpdated}</p>
      </div>

      ${
        golfers.length
          ? `
            <div class="card">
              <div class="table-wrap">
                <table class="golfers-table">
                  <thead>
                    <tr>
                      <th>Golfer</th>
                      <th>Position</th>
                      <th>Overall</th>
                      <th>Today</th>
                      <th>Thru / Tee Time</th>
                      <th>Note</th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${golfers.map(renderGolferRow).join('')}
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