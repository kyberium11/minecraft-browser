import * as THREE from 'three'
import { useTimeStore } from './TimeStore'

export class TimeManager {
  private gameTime: number = 6000 // Start at 6:00 AM
  private timeScale: number = 20 // Speed of time
  private frames: number = 0
  private updateFrequency: number = 10

  public sunDirection: THREE.Vector3 = new THREE.Vector3()
  public sunIntensity: number = 1
  public ambientColor: THREE.Color = new THREE.Color()
  public isNightTime: boolean = false

  public update(delta: number) {
    this.gameTime = (this.gameTime + delta * this.timeScale) % 24000
    this.frames++

    // Optimization: Only calculate lighting/sky parameters every N frames
    if (this.frames % this.updateFrequency === 0) {
      this.calculateAtmosphere()
      useTimeStore.getState().setTime(this.gameTime)
    }
  }

  private calculateAtmosphere() {
    // 0 = Midnight, 6000 = Sunrise, 12000 = Noon, 18000 = Sunset
    const normalizedTime = this.gameTime / 24000
    const angle = (normalizedTime * Math.PI * 2) - (Math.PI / 2)
    
    // Sun position (zenith)
    this.sunDirection.set(
      Math.cos(angle),
      Math.sin(angle),
      -0.5 // Slight tilt for better shadows
    ).normalize()

    // Intensity & Colors
    const altitude = this.sunDirection.y
    this.isNightTime = altitude < 0
    
    if (this.isNightTime) {
      // Night (Moon)
      this.sunIntensity = 0.2
      this.ambientColor.setHSL(0.6, 0.5, 0.1) // Deep Indigo
    } else {
      // Day (Sun)
      const sunriseWeight = Math.max(0, 1 - Math.abs(altitude - 0.1) * 5)
      this.sunIntensity = Math.max(0.1, altitude * 1.2)
      
      if (sunriseWeight > 0.5) {
        this.ambientColor.setHSL(0.05, 0.8, 0.6) // Orange/Peach
      } else {
        this.ambientColor.setHSL(0.6, 0.2, 0.8) // Bright White/Blue
      }
    }
  }

  public getTime() { return this.gameTime }
  public isNight() { return this.isNightTime }
  
  public getSkyParams() {
    const altitude = this.sunDirection.y
    return {
      turbidity: 10,
      rayleigh: 3,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.7,
      elevation: Math.max(-10, altitude * 90),
      azimuth: 180
    }
  }
}
