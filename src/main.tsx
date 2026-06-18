import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registro del service worker para que la app se pueda instalar como
// PWA ("Añadir a pantalla de inicio"). Se hace tras el `load` para no
// competir con la carga inicial, y se ignora si el navegador no lo
// soporta (Safari de escritorio antiguo, por ejemplo) en vez de
// romper nada.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker, la app sigue funcionando igual en el
      // navegador — solo no se podrá instalar como PWA.
    });
  });
}
