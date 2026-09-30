/**
 * Simple Accessible Modal Dialog Helper
 */

import { icons } from './icons.js';

export function openModal({ title, contentHtml, onSave, saveLabel = 'Simpan', onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 style="font-size: 17px; font-weight: 700;">${title}</h3>
        <button type="button" class="btn-icon modal-close-btn" style="color: var(--text-muted);">
          ${icons.x(20)}
        </button>
      </div>
      <div class="modal-body">
        ${contentHtml}
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary modal-cancel-btn">Batal</button>
        ${onSave ? `<button type="button" class="btn btn-primary modal-save-btn">${saveLabel}</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  overlay.querySelector('.modal-close-btn').addEventListener('click', close);
  overlay.querySelector('.modal-cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (onSave) {
    overlay.querySelector('.modal-save-btn').addEventListener('click', async () => {
      const shouldClose = await onSave(overlay);
      if (shouldClose !== false) {
        close();
      }
    });
  }

  return { overlay, close };
}
