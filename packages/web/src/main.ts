import './style.css';
import { mountViewer } from './viewer.js';
import { initTheme } from './theme.js';

initTheme();

const root = document.getElementById('app');
if (root) {
  mountViewer(root);
  window.addEventListener('hashchange', () => {
    mountViewer(root);
  });
}
