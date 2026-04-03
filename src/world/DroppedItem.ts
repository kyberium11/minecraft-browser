import * as THREE from 'three'
import { BlockType } from './VoxelConfig'
import { textureLoader } from '../core/TextureLoader'

export class DroppedItem extends THREE.Group {
  public blockType: BlockType
  private mesh: THREE.Mesh
  private startTime: number
  private isCollected = false

  constructor(type: BlockType, x: number, y: number, z: number) {
    super()
    this.blockType = type
    
    // 1. Create a smaller version of the block
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    
    // Multi-material for proper mapping (Right, Left, Top, Bottom, Front, Back)
    const materials = this.getMaterialsForType(type)
    
    this.mesh = new THREE.Mesh(geometry, materials)
    this.mesh.scale.set(0.25, 0.25, 0.25)
    this.add(this.mesh)
    
    this.position.set(x + 0.5, y + 0.5, z + 0.5)
    this.startTime = performance.now()
  }

  private getMaterialsForType(type: BlockType): THREE.Material[] {
    const sideTex = this.getTextureForType(type, 'side')
    const topTex = this.getTextureForType(type, 'top')
    const bottomTex = this.getTextureForType(type, 'bottom')

    const sideMat = new THREE.MeshBasicMaterial({ 
      map: sideTex, 
      transparent: type === BlockType.GLASS || type === BlockType.OAK_LEAVES,
      color: type === BlockType.BRICK ? 0xcc4444 : (type === BlockType.ROOF ? 0x333333 : 0xffffff)
    })
    const topMat = new THREE.MeshBasicMaterial({ 
      map: topTex, 
      transparent: sideMat.transparent,
      color: sideMat.color
    })
    const bottomMat = new THREE.MeshBasicMaterial({ 
      map: bottomTex, 
      transparent: sideMat.transparent,
      color: sideMat.color
    })

    return [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat]
  }

  private getTextureForType(type: BlockType, face: 'top' | 'bottom' | 'side' = 'side') {
    switch (type) {
      case BlockType.GRASS:
        if (face === 'top') return textureLoader.load('/assets/textures/grass_top.png')
        if (face === 'bottom') return textureLoader.load('/assets/textures/dirt.png')
        return textureLoader.load('/assets/textures/grass_side.png')
      case BlockType.OAK_LOG:
        if (face === 'top' || face === 'bottom') return textureLoader.load('/assets/textures/oak_log_top.png')
        return textureLoader.load('/assets/textures/oak_log_side.png')
      case BlockType.DIRT: return textureLoader.load('/assets/textures/dirt.png')
      case BlockType.STONE: return textureLoader.load('/assets/textures/stone.png')
      case BlockType.COBBLESTONE: return textureLoader.load('/assets/textures/cobblestone.png')
      case BlockType.BRICK: return textureLoader.load('/assets/textures/cobblestone.png')
      case BlockType.ROOF: return textureLoader.load('/assets/textures/stone.png')
      case BlockType.OAK_LEAVES: return textureLoader.load('/assets/textures/oak_leaves.png')
      case BlockType.OAK_PLANKS: return textureLoader.load('/assets/textures/oak_planks.png')
      case BlockType.SAND: return textureLoader.load('/assets/textures/sand.png')
      case BlockType.GLASS: return textureLoader.load('/assets/textures/glass.png')
      case BlockType.BEDROCK: return textureLoader.load('/assets/textures/bedrock.png')
      case BlockType.ORE_COAL: return textureLoader.load('/assets/textures/ore_coal.png')
      case BlockType.ORE_IRON: return textureLoader.load('/assets/textures/ore_iron.png')
      case BlockType.ORE_GOLD: return textureLoader.load('/assets/textures/ore_gold.png')
      case BlockType.ORE_DIAMOND: return textureLoader.load('/assets/textures/ore_diamond.png')
      default: return textureLoader.load('/assets/textures/stone.png')
    }
  }

  public update(playerPos: THREE.Vector3, delta: number, onCollect: () => void) {
    if (this.isCollected) return

    const time = (performance.now() - this.startTime) / 1000
    
    // Bobbing animation
    this.mesh.position.y = Math.sin(time * 3) * 0.1
    
    // Slow rotation
    this.mesh.rotation.y += delta * 1.5
    
    // Magnet effect
    const dist = this.position.distanceTo(playerPos)
    if (dist < 2.0) {
      this.position.lerp(playerPos, 0.1)
      
      if (dist < 0.5) {
        this.isCollected = true
        onCollect()
      }
    }
  }
}
