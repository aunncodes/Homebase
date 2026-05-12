import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import App from './App';

const container = document.getElementById('homebase-root');

if (!container) {
  throw new Error('Could not find root container to mount Homebase');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
