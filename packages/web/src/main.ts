import './style.css';
import { mountViewer } from './viewer.js';

const root = document.getElementById('app');
if (root) {
  mountViewer(root);
  // Re-render on fragment changes so navigating between Links updates the view.
  window.addEventListener('hashchange', () => {
    mountViewer(root);
  });
}
