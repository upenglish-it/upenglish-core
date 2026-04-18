import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply preview redirect BEFORE React renders (so React Router sees correct URL from start)
// This runs after assets are loaded, so relative paths are already resolved - safe to replaceState
if (window.__PENDING_PREVIEW__) {
    const path = window.__PENDING_PREVIEW__;
    delete window.__PENDING_PREVIEW__;
    window.history.replaceState(null, null, path);
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
