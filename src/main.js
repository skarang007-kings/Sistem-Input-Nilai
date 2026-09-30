/**
 * Application Bootstrap & Client-side Router
 * Handles navigation between views, responsive sidebar/bottom-nav highlights,
 * and service worker registration for PWA.
 */

// Import CSS stylesheets so Vite handles them with proper MIME types & HMR
import './styles/variables.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/charts.css';
import './styles/animations.css';

import { initSeedData } from './db/storage.js';

import { icons } from './components/icons.js';
import { renderDashboard } from './views/dashboard.js';
import { renderClasses } from './views/classes.js';
import { renderSubjects } from './views/subjects.js';
import { renderScan } from './views/scan.js';
import { renderManual } from './views/manual.js';
import { renderResults } from './views/results.js';
import { renderSettings } from './views/settings.js';

let currentRoute = 'dashboard';

const routes = {
  dashboard: renderDashboard,
  classes: renderClasses,
  subjects: renderSubjects,
  scan: renderScan,
  manual: renderManual,
  results: renderResults,
  settings: renderSettings
};

export async function navigate(routeName) {
  if (!routes[routeName]) routeName = 'dashboard';
  currentRoute = routeName;

  // Update URL hash without reload
  window.location.hash = routeName;

  // Update Active Nav Highlights
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.dataset.route === routeName) el.classList.add('active');
    else el.classList.remove('active');
  });

  document.querySelectorAll('.mobile-nav-btn').forEach(el => {
    if (el.dataset.route === routeName) el.classList.add('active');
    else el.classList.remove('active');
  });

  // Render view into main container
  const mainEl = document.getElementById('appMainContent');
  if (mainEl) {
    mainEl.innerHTML = '';
    await routes[routeName](mainEl, navigate);
  }
}

async function initApp() {
  console.log('Initializing Sistem Input Nilai...');
  await initSeedData();

  // Bind Sidebar Nav Items
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.route);
    });
  });

  // Bind Mobile Nav Buttons
  document.querySelectorAll('.mobile-nav-btn[data-route]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.route);
    });
  });

  // Mobile Big Center Scan Button
  document.getElementById('mobileScanCenterBtn')?.addEventListener('click', () => {
    navigate('scan');
  });

  // Sidebar Global Search
  const sidebarSearch = document.getElementById('sidebarSearchInput');
  sidebarSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigate('results');
    }
  });

  // Listen to hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    if (hash !== currentRoute) {
      navigate(hash);
    }
  });

  // Initial Route from hash or default
  const initialRoute = window.location.hash.replace('#', '') || 'dashboard';
  await navigate(initialRoute);

  // Handle Service Worker
  if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD && window.location.protocol.startsWith('http')) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('PWA Service Worker registered.');
      } catch (e) {
        console.warn('SW register error:', e);
      }
    } else {
      // In development, unregister any existing service worker to prevent Vite HMR interference
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let reg of registrations) {
          reg.unregister();
          console.log('Dev mode: Unregistered active service worker.');
        }
      });
    }
  }
}


// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
