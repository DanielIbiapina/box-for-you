import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './loja.css'
import { InfoLegal } from './InfoLegal.jsx'

// crumblabcookies.com/legal/ — ver InfoLegal.jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InfoLegal />
  </StrictMode>,
)
