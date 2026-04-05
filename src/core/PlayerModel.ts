import * as THREE from 'three'
import { BlockType } from '../world/VoxelConfig'
import { textureLoader } from './TextureLoader'

export class PlayerModel extends THREE.Group {
  private head: THREE.Mesh
  private torso: THREE.Mesh
  private leftArm: THREE.Group
  private rightArm: THREE.Group
  private leftLeg: THREE.Group
  private rightLeg: THREE.Group
  
  private armMesh: THREE.Mesh
  private rightArmMesh: THREE.Mesh
  
  private heldBlock: THREE.Mesh
  private isSwinging: boolean = false
  private swingStartTime: number = 0

  constructor(textures: { head: THREE.Texture, body: THREE.Texture, arms: THREE.Texture, legs: THREE.Texture, hat: THREE.Texture, dirt?: THREE.Texture }) {
    super()
    
    // Minecraft scale: 0.0625 units per "pixel"
    const s = 0.0625 
    
    const skinColor = 0xffccaa
    const redColor = 0xdd1111

    const headMat = [
      new THREE.MeshBasicMaterial({ map: textures.hat }), // Right
      new THREE.MeshBasicMaterial({ map: textures.hat }), // Left
      new THREE.MeshBasicMaterial({ map: textures.hat }), // Top
      new THREE.MeshBasicMaterial({ color: skinColor }), // Bottom
      new THREE.MeshBasicMaterial({ map: textures.head }),     // Front
      new THREE.MeshBasicMaterial({ map: textures.hat }), // Back
    ]
    
    // 1. Head (8x8x8)
    const headGeo = new THREE.BoxGeometry(8*s, 8*s, 8*s)
    this.head = new THREE.Mesh(headGeo, headMat)
    this.head.position.y = 24*s
    this.add(this.head)
    
    // 2. Torso (8x12x4)
    const torsoMat = [
      new THREE.MeshBasicMaterial({ color: redColor }), // Right
      new THREE.MeshBasicMaterial({ color: redColor }), // Left
      new THREE.MeshBasicMaterial({ color: skinColor }), // Top (neck area)
      new THREE.MeshBasicMaterial({ color: redColor }), // Bottom
      new THREE.MeshBasicMaterial({ map: textures.body }),  // Front
      new THREE.MeshBasicMaterial({ color: redColor }), // Back
    ]
    const torsoGeo = new THREE.BoxGeometry(8*s, 12*s, 4*s)
    this.torso = new THREE.Mesh(torsoGeo, torsoMat)
    this.torso.position.y = 14*s
    this.add(this.torso)
    
    // 3. Arms (4x12x4)
    const armGeo = new THREE.BoxGeometry(4*s, 12*s, 4*s)
    armGeo.translate(0, -6*s, 0)
    
    this.leftArm = new THREE.Group()
    this.armMesh = new THREE.Mesh(armGeo, new THREE.MeshBasicMaterial({ map: textures.arms }))
    this.leftArm.add(this.armMesh)
    this.leftArm.position.set(-6*s, 20*s, 0)
    this.add(this.leftArm)
    
    this.rightArm = new THREE.Group()
    this.rightArmMesh = new THREE.Mesh(armGeo, new THREE.MeshBasicMaterial({ map: textures.arms }))
    this.rightArm.add(this.rightArmMesh)
    this.rightArm.position.set(6*s, 20*s, 0)
    this.add(this.rightArm)
    
    // 4. Legs (4x12x4)
    const denimColor = 0x3b5b92
    
    const shortsGeo = new THREE.BoxGeometry(4*s, 6*s, 4*s)
    shortsGeo.translate(0, -3*s, 0)
    
    const lowerLegGeo = new THREE.BoxGeometry(4*s, 6*s, 4*s)
    lowerLegGeo.translate(0, -9*s, 0)
    
    this.leftLeg = new THREE.Group()
    this.leftLeg.add(new THREE.Mesh(shortsGeo, new THREE.MeshBasicMaterial({ color: denimColor })))
    this.leftLeg.add(new THREE.Mesh(lowerLegGeo, new THREE.MeshBasicMaterial({ color: skinColor })))
    this.leftLeg.position.set(-2*s, 8*s, 0)
    this.add(this.leftLeg)
    
    this.rightLeg = new THREE.Group()
    this.rightLeg.add(new THREE.Mesh(shortsGeo, new THREE.MeshBasicMaterial({ color: denimColor })))
    this.rightLeg.add(new THREE.Mesh(lowerLegGeo, new THREE.MeshBasicMaterial({ color: skinColor })))
    this.rightLeg.position.set(2*s, 8*s, 0)
    this.add(this.rightLeg)

    // Held block
    const blockGeo = new THREE.BoxGeometry(4*s, 4*s, 4*s)
    const blockMat = textures.dirt ? new THREE.MeshBasicMaterial({ map: textures.dirt }) : new THREE.MeshBasicMaterial({ color: 0x885533 })
    this.heldBlock = new THREE.Mesh(blockGeo, blockMat)
    this.heldBlock.position.set(0, -10*s, -2*s)
    this.heldBlock.visible = false
    this.rightArm.add(this.heldBlock)
  }

  private lastTime: number = 0

  public setHeldBlockType(type: number) {
    let texturePath = ''
    switch (type) {
      case BlockType.DIRT: texturePath = '/assets/textures/dirt.png'; break;
      case BlockType.STONE: texturePath = '/assets/textures/stone.png'; break;
      case BlockType.COBBLESTONE: texturePath = '/assets/textures/cobblestone.png'; break;
      case BlockType.GRASS: texturePath = '/assets/textures/grass_side.png'; break;
      case BlockType.OAK_LOG: texturePath = '/assets/textures/oak_log_side.png'; break;
      case BlockType.OAK_PLANKS: texturePath = '/assets/textures/oak_planks.png'; break;
      case BlockType.OAK_LEAVES: texturePath = '/assets/textures/oak_leaves.png'; break;
      case BlockType.SAND: texturePath = '/assets/textures/sand.png'; break;
      case BlockType.GLASS: texturePath = '/assets/textures/glass.png'; break;
      case BlockType.BEDROCK: texturePath = '/assets/textures/bedrock.png'; break;
      case BlockType.ORE_COAL: texturePath = '/assets/textures/ore_coal.png'; break;
      case BlockType.ORE_IRON: texturePath = '/assets/textures/ore_iron.png'; break;
      case BlockType.ORE_GOLD: texturePath = '/assets/textures/ore_gold.png'; break;
      case BlockType.ORE_DIAMOND: texturePath = '/assets/textures/ore_diamond.png'; break;
      case BlockType.BRICK: texturePath = '/assets/textures/cobblestone.png'; break;
      case BlockType.ROOF: texturePath = '/assets/textures/stone.png'; break;
      default: texturePath = '/assets/textures/dirt.png';
    }
  
    const mat = this.heldBlock.material as THREE.MeshBasicMaterial
    mat.map = textureLoader.load(texturePath)
    
    if (type === BlockType.BRICK) {
       mat.color.setHex(0xcc4444)
    } else if (type === BlockType.ROOF) {
       mat.color.setHex(0x333333)
    } else {
       mat.color.setHex(0xffffff)
    }
    mat.needsUpdate = true
  }

  public triggerSwing(type: 'break' | 'place', blockType?: number) {
    this.isSwinging = true
    this.swingStartTime = this.lastTime
    if (type === 'place') {
      if (blockType !== undefined) this.setHeldBlockType(blockType)
      this.heldBlock.visible = true
    } else {
      this.heldBlock.visible = false
    }
  }

  public update(walking: boolean, time: number) {
    this.lastTime = time
    const swingDuration = 0.25 // 250ms
    const swingElapsed = time - this.swingStartTime

    if (this.isSwinging && swingElapsed < swingDuration) {
      // Rotate right arm purely based on the swing animation
      const progress = swingElapsed / swingDuration
      const angle = Math.sin(progress * Math.PI) * Math.PI * 0.6
      this.rightArm.rotation.x = -angle - Math.PI * 0.1 
      
      const walkSwing = walking ? Math.sin(time * 10) * 0.5 : 0
      this.leftArm.rotation.x = walkSwing
      this.leftLeg.rotation.x = walkSwing
      this.rightLeg.rotation.x = -walkSwing
    } else {
      this.isSwinging = false
      this.heldBlock.visible = false
      if (walking) {
        const swing = Math.sin(time * 10) * 0.5
        this.leftArm.rotation.x = swing
        this.rightArm.rotation.x = -swing
        this.leftLeg.rotation.x = -swing
        this.rightLeg.rotation.x = swing
      } else {
        this.leftArm.rotation.x = 0
        this.rightArm.rotation.x = 0
        this.leftLeg.rotation.x = 0
        this.rightLeg.rotation.x = 0
      }
    }

    // Subtle breathing/floating for the head
    this.head.rotation.y = Math.sin(time * 2) * 0.05
  }
}
