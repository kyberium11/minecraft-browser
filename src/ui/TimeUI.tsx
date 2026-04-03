import React from 'react'
import { useTimeStore } from '../core/TimeStore'

export function TimeUI() {
  const gameTime = useTimeStore((state) => state.gameTime)
  
  // Calculate Minecraft-style 24h time
  // 6000 = 06:00, 18000 = 18:00
  const hours = Math.floor((gameTime / 1000 + 0) % 24)
  const minutes = Math.floor((gameTime % 1000) * 0.06)
  
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  const isNight = gameTime < 6000 || gameTime > 18000

  return (
    <div className="time-ui">
      <div className="time-icon">
        {isNight ? '🌙' : '☀️'}
      </div>
      <div className="time-text">
        <div className="time-label">Game Time</div>
        <div className="time-value">{timeStr}</div>
      </div>
    </div>
  )
}
