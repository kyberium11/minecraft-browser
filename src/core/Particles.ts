import * as THREE from 'three'

export class ParticleSystem {
  private particles: THREE.Points
  private geometry: THREE.BufferGeometry
  private material: THREE.PointsMaterial
  private counts: number = 500
  private positions: Float32Array
  private velocities: THREE.Vector3[] = []
  private lifetimes: number[] = []

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(this.counts * 3)
    
    for (let i = 0; i < this.counts; i++) {
      this.positions[i * 3] = 0
      this.positions[i * 3 + 1] = -100 // Hide initially
      this.positions[i * 3 + 2] = 0
      this.velocities.push(new THREE.Vector3())
      this.lifetimes.push(0)
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.material = new THREE.PointsMaterial({
      color: 0x44aaff,
      size: 0.15,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    })

    this.particles = new THREE.Points(this.geometry, this.material)
    scene.add(this.particles)
  }

  public emit(x: number, y: number, z: number, count: number = 20) {
    let spawned = 0
    for (let i = 0; i < this.counts && spawned < count; i++) {
      if (this.lifetimes[i] <= 0) {
        this.positions[i * 3] = x + (Math.random() - 0.5) * 0.5
        this.positions[i * 3 + 1] = y
        this.positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5
        
        this.velocities[i].set(
          (Math.random() - 0.5) * 2,
          Math.random() * 4 + 2,
          (Math.random() - 0.5) * 2
        )
        this.lifetimes[i] = 1.0 // 1 second life
        spawned++
      }
    }
  }

  public update(delta: number) {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute
    
    for (let i = 0; i < this.counts; i++) {
      if (this.lifetimes[i] > 0) {
        this.positions[i * 3] += this.velocities[i].x * delta
        this.positions[i * 3 + 1] += this.velocities[i].y * delta
        this.positions[i * 3 + 2] += this.velocities[i].z * delta
        
        this.velocities[i].y -= 9.8 * delta // Gravity
        this.lifetimes[i] -= delta

        if (this.lifetimes[i] <= 0) {
          this.positions[i * 3 + 1] = -100
        }
      }
    }
    
    posAttr.needsUpdate = true
  }
}
