import React from 'react'
import { Hotbar } from './Hotbar'
import { TimeUI } from './TimeUI'

export const App: React.FC = () => {
  return (
    <div id="hud-container">
      {/* Selection Crosshair */}
      <div className="crosshair" />
      
      {/* HUD Elements */}
      <TimeUI />
      <Hotbar />
    </div>
  )
}
