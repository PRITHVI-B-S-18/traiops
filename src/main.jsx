import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// Initialize EmailJS
import { EMAILJS_CONFIG } from './config/emailjs';

if (typeof window !== 'undefined') {
  // Load EmailJS script
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
  script.onload = () => {
    if (window.emailjs) {
      window.emailjs.init(EMAILJS_CONFIG.USER_ID);
    }
  };
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
