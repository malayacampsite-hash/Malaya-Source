import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { AdminPanel } from './components/AdminPanel'
import './styles.css'

function NotFound() {
  return (
    <main className="not-found">
      <div>
        <span className="eyebrow">MALAYA CAMPSITE</span>
        <h1>That page is not part of the trail.</h1>
        <p>Return to the main campsite experience.</p>
        <a className="button button-primary" href="/">Back to Malaya</a>
      </div>
    </main>
  )
}

document.documentElement.classList.add('js')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
