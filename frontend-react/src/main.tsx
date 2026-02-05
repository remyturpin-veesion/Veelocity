import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

try {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (err) {
  // Catch sync errors during initial render to avoid "Aw, Snap!" (Error code: 5)
  console.error('App failed to mount:', err)
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;">
      <h1 style="font-size:1.5rem;margin-bottom:8">Something went wrong</h1>
      <p style="color:#94a3b8;margin-bottom:24;text-align:center">The app could not start. Try reloading.</p>
      <button type="button" onclick="window.location.reload()" style="padding:10px 20px;border-radius:8;border:none;background:#3b82f6;color:white;cursor:pointer;font-weight:500">Reload</button>
    </div>
  `
}
