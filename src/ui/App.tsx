import React from 'react'
import { Hotbar } from './Hotbar'

export const App: React.FC = () => {
  return (
    <div id="hud-container">
      {/* Selection Crosshair */}
      <div className="crosshair" />
      
      {/* HUD Elements */}
      <Hotbar />
    </div>
  )
}
