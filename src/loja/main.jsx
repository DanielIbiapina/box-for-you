import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './loja.css'
import { Loja } from './Loja.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Loja />
  </StrictMode>,
)
