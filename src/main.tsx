import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel Web Analytics. Mounted at the root rather than inside App so it
        is not tangled up with the quiz's own re-renders. It is inert off
        Vercel: the script only loads once deployed, so local dev and the test
        run are unaffected. */}
    <Analytics />
  </StrictMode>,
)
