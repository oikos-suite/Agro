import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Base styles first, in this order: tokens.css holds the design tokens and base reset the other
// sheets build on. Fonts are self-hosted, declared in expressive/type.css.
import './styles/tokens.css'
import './styles/components.css'
import './styles/pages.css'
import './styles/signin.css'
import './styles/layout.css'
import './styles/player.css'
import './styles/forms.css'
import './styles/settings.css'
// App before the expressive layer, so that layer's styles load last and win over every
// component stylesheet App pulls in (library.css, setup.css).
import App from './App.jsx'
import './expressive/type.css'
import './expressive/ambient.css'
import './expressive/shell.css'
import './expressive/surfaces.css'
import './expressive/controls.css'
import './expressive/nowbar.css'
import './expressive/stats.css'
import './expressive/charts.css'
import './expressive/backups.css'
import './expressive/devices.css'
import './expressive/social.css'
import './expressive/settings.css'
import './expressive/admin.css'
import './expressive/library.css'
import './expressive/auth.css'
import './expressive/phone.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
