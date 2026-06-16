import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Suppress harmless SignalR handshake cancellation errors from triggering the Webpack Dev Server error overlay
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && (
      (event.reason.message && event.reason.message.includes('Handshake was canceled')) ||
      (event.reason.toString && event.reason.toString().includes('Handshake was canceled'))
    )) {
      event.preventDefault();
      console.warn('[SignalR] Suppressed harmless handshake cancellation rejection.');
    }
  });

  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('Handshake was canceled')) {
      event.preventDefault();
      console.warn('[SignalR] Suppressed harmless handshake cancellation error.');
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
