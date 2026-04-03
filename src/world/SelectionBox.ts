import * as THREE from 'three'

export class SelectionBox extends THREE.LineSegments {
  constructor() {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.05, 1.05, 1.05))
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    super(geometry, material)
    this.visible = false
  }

  public update(worldX: number, worldY: number, worldZ: number) {
    this.position.set(
      Math.floor(worldX) + 0.5,
      Math.floor(worldY) + 0.5,
      Math.floor(worldZ) + 0.5
    )
    this.visible = true
  }

  public hide() {
    this.visible = false
  }
}
