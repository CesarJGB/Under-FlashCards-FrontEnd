import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { startViewportDebug } from './lib/viewportDebug';

// Se ejecuta antes de montar React para conservar una muestra T0 del viewport.
startViewportDebug();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
