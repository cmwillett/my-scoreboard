function closeModal(modal) {
  if (modal) modal.remove();
}

function createModal(contentHtml) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal-card">${contentHtml}</div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal(modal);
  });

  return modal;
}

export function openMessageModal({ title = 'Message', message = '', buttonText = 'OK' }) {
  const modal = createModal(`
    <h3>${title}</h3>
    <p>${message}</p>
    <div class="modal-actions">
      <button type="button" class="primary-btn modal-close-btn">${buttonText}</button>
    </div>
  `);

  modal.querySelector('.modal-close-btn').addEventListener('click', () => {
    closeModal(modal);
  });
}

export function openConfirmModal({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = true,
  onConfirm
}) {
  const modal = createModal(`
    <h3>${title}</h3>
    <p>${message}</p>
    <div class="modal-actions">
      <button type="button" class="small-btn modal-cancel-btn">${cancelText}</button>
      <button type="button" class="small-btn ${danger ? 'danger' : ''} modal-confirm-btn">${confirmText}</button>
    </div>
  `);

  modal.querySelector('.modal-cancel-btn').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('.modal-confirm-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Working...';

    try {
      if (onConfirm) await onConfirm();
      closeModal(modal);
    } catch (err) {
      console.error(err);
      closeModal(modal);
      openMessageModal({
        title: 'Something went wrong',
        message: 'The action could not be completed.'
      });
    }
  });
}

export function openGameEditModal({ id, spread = '', notes = '', onSave }) {
  const modal = createModal(`
    <h3>Edit Game</h3>

    <label>Spread</label>
    <input class="modal-game-spread" type="text" value="${spread}" />

    <label>Notes</label>
    <textarea class="modal-game-notes" rows="5">${notes}</textarea>

    <div class="modal-actions">
      <button type="button" class="small-btn modal-cancel-btn">Cancel</button>
      <button type="button" class="primary-btn modal-save-btn">Save</button>
    </div>
  `);

  modal.querySelector('.modal-cancel-btn').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('.modal-save-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    const nextSpread = modal.querySelector('.modal-game-spread').value.trim();
    const nextNotes = modal.querySelector('.modal-game-notes').value.trim();

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      await onSave({ id, spread: nextSpread, notes: nextNotes });
      closeModal(modal);
    } catch (err) {
      console.error(err);
      closeModal(modal);
      openMessageModal({
        title: 'Could Not Update Game',
        message: 'The spread and notes were not saved.'
      });
    }
  });
}

export function openGolferNoteModal({ golfer, note = '', favorite = false, onSave }) {
  const modal = createModal(`
    <h3>Edit Note</h3>
    <p><strong>${golfer}</strong></p>

    <textarea class="modal-golfer-note" rows="5">${note}</textarea>

    <div class="modal-actions">
      <button type="button" class="small-btn modal-cancel-btn">Cancel</button>
      <button type="button" class="primary-btn modal-save-btn">Save</button>
    </div>
  `);

  modal.querySelector('.modal-cancel-btn').addEventListener('click', () => {
    closeModal(modal);
  });

  modal.querySelector('.modal-save-btn').addEventListener('click', async event => {
    const button = event.currentTarget;
    const nextNote = modal.querySelector('.modal-golfer-note').value.trim();

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      await onSave({ golfer, note: nextNote, favorite });
      closeModal(modal);
    } catch (err) {
      console.error(err);
      closeModal(modal);
      openMessageModal({
        title: 'Could Not Save Note',
        message: 'The golfer note was not saved.'
      });
    }
  });
}
