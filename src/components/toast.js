/**
 * Lightweight Toast Notification Component
 */

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export const toast = {
  show(message, type = 'info', duration = 3500) {
    const cont = ensureContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    el.innerHTML = `<span>${icon}</span><span style="flex:1;">${message}</span>`;
    cont.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  success(msg, duration) {
    this.show(msg, 'success', duration);
  },

  error(msg, duration) {
    this.show(msg, 'error', duration || 4500);
  },

  warning(msg, duration) {
    this.show(msg, 'warning', duration);
  }
};
