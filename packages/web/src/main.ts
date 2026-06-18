import './style.css';
import { mountViewer } from './viewer.js';
import { initTheme } from './theme.js';

// Align the runtime theme with whatever the no-flash inline script (index.html)
// already set before paint. This is idempotent and also covers dev/HMR.
initTheme();

const root = document.getElementById('app');
if (root) {
  mountViewer(root);
  // Re-render on fragment changes so navigating between Links updates the view.
  window.addEventListener('hashchange', () => {
    mountViewer(root);
  });
}
