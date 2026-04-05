import * as THREE from 'three'
import { World } from '../world/VoxelConfig'

export class Entity {
  public id: string = Math.random().toString(36).substring(2, 11)
  public position: THREE.Vector3 = new THREE.Vector3()
  public velocity: THREE.Vector3 = new THREE.Vector3()
  public isDead: boolean = false
  public isDying: boolean = false
  private deathTimer: number = 0
  public mesh: THREE.Group = new THREE.Group()
  public bounds: THREE.Vector3 = new THREE.Vector3(0.8, 1.5, 0.8)
  public drownTimer: number = 0
  
  // Combat System
  public hp: number = 10
  public maxHp: number = 10
  public invulnTimer: number = 0
  public isInvulnerable: boolean = false

  // UI
  private hpBar?: THREE.Group
  private hpBarFill?: THREE.Mesh

  constructor() {
    this.createHPBar()
  }

  private createHPBar() {
    const group = new THREE.Group()
    const backGeo = new THREE.PlaneGeometry(0.8, 0.1)
    const backMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    const back = new THREE.Mesh(backGeo, backMat)
    
    const fillGeo = new THREE.PlaneGeometry(0.8, 0.1)
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
    this.hpBarFill = new THREE.Mesh(fillGeo, fillMat)
    this.hpBarFill.position.z = 0.01 // Slight offset to prevent z-fighting
    
    group.add(back)
    group.add(this.hpBarFill)
    group.position.y = 1.8 // Above head
    this.hpBar = group // We'll just hide/show the group later if needed
    this.mesh.add(group)
  }

  public update(delta: number, world: World) {
    if (this.isDying) {
      this.deathTimer += delta
      this.mesh.rotation.z = Math.min(Math.PI / 2, this.deathTimer * 5)
      this.mesh.position.y -= delta * 0.5
      if (this.deathTimer > 1.0) this.isDead = true
      return
    }

    if (this.invulnTimer > 0) {
      this.invulnTimer -= delta
      if (this.invulnTimer <= 0) {
        this.isInvulnerable = false;
        this.mesh.traverse(child => {
          if (child instanceof THREE.Mesh && child !== this.hpBarFill && (this as any).hpBar && child !== (this as any).hpBar) {
            const mat = child.material as THREE.MeshBasicMaterial;
            if (mat && mat.userData && mat.userData.originalColor) {
                mat.color.copy(mat.userData.originalColor);
            }
          }
        });
      }
    }

    // Update HP Bar
    if (this.hpBarFill) {
      const scale = Math.max(0, this.hp / this.maxHp)
      this.hpBarFill.scale.x = scale
      this.hpBarFill.position.x = - (1 - scale) * 0.4
      // Color shift
      if (scale < 0.3) (this.hpBarFill.material as THREE.MeshBasicMaterial).color.set(0xff0000)
      else if (scale < 0.6) (this.hpBarFill.material as THREE.MeshBasicMaterial).color.set(0xffff00)
      else (this.hpBarFill.material as THREE.MeshBasicMaterial).color.set(0x00ff00)
      
      // Billboard effect (face camera)
      if ((window as any).cameraInstance) {
          this.hpBar?.lookAt((window as any).cameraInstance.position)
      }
    }

    // Apply gravity
    this.velocity.y -= 25 * delta;
    
    // Friction (Slows down knockback)
    this.velocity.x -= this.velocity.x * 5 * delta
    this.velocity.z -= this.velocity.z * 5 * delta
    
    // Physics integration
    this.handleCollision(delta, world)
    
    this.mesh.position.copy(this.position)
  }

  public takeDamage(amount: number, knockbackSource?: THREE.Vector3) {
    if (this.isInvulnerable || this.hp <= 0 || this.isDying) return
    
    this.hp -= amount
    this.isInvulnerable = true
    this.invulnTimer = 0.5

    // Visual feedback (red flash)
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && child !== this.hpBarFill && child !== this.hpBar) {
        const mat = child.material;
        if (mat.color) {
            // Use emissive if possible, else just keep a timer logic in update
            mat.userData.originalColor = mat.userData.originalColor || mat.color.clone();
            mat.color.set(0xff0000);
        }
      }
    });

    if (knockbackSource) {
      const dir = this.position.clone().sub(knockbackSource).setY(0).normalize()
      this.velocity.x += dir.x * 12
      this.velocity.z += dir.z * 12
      this.velocity.y = 5 // Pop-up
    }

    if (this.hp <= 0) {
      this.triggerDeath()
    }
  }

  private triggerDeath() {
    this.isDying = true
    this.deathTimer = 0
    if ((window as any).particleSystemInstance) {
        (window as any).particleSystemInstance.emitSoul(this.position.x, this.position.y, this.position.z)
    }
  }

  private handleCollision(delta: number, world: World) {
    // X axis
    this.position.x += this.velocity.x * delta
    if (this.checkCollision(world)) {
      this.position.x -= this.velocity.x * delta
      this.velocity.x = 0
    }

    // Z axis
    this.position.z += this.velocity.z * delta
    if (this.checkCollision(world)) {
      this.position.z -= this.velocity.z * delta
      this.velocity.z = 0
    }

    // Y axis
    this.position.y += this.velocity.y * delta
    if (this.checkCollision(world)) {
      this.position.y -= this.velocity.y * delta
      this.velocity.y = 0
    }
  }

  private checkCollision(world: World): boolean {
    const minX = Math.floor(this.position.x - this.bounds.x / 2)
    const maxX = Math.floor(this.position.x + this.bounds.x / 2)
    const minY = Math.floor(this.position.y)
    const maxY = Math.floor(this.position.y + this.bounds.y)
    const minZ = Math.floor(this.position.z - this.bounds.z / 2)
    const maxZ = Math.floor(this.position.z + this.bounds.z / 2)

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const type = world.getBlockAt(x, y, z)
          if (type !== BlockType.AIR && type !== BlockType.WATER) {
            return true
          }
        }
      }
    }
    return false
  }
}

export const EntityState = {
  IDLE: 0,
  WANDER: 1,
  SEARCHING: 2,
  ATTRACTED: 3,
  COURTSHIP: 4,
  COOLDOWN: 5,
} as const;

export type EntityState = typeof EntityState[keyof typeof EntityState];

export class HostileMob extends Entity {
  public state: 'WANDER' | 'CHASE' | 'ATTACK' = 'WANDER'
  private stateTimer: number = 0
  private pathUpdateTimer: number = 0
  private detectionRange: number = 24
  private attackRange: number = 1.2
  private attackCooldown: number = 0
  
  // Model parts
  private rootBody: THREE.Mesh
  private head: THREE.Mesh
  private armR: THREE.Mesh
  private armL: THREE.Mesh
  private legR: THREE.Mesh
  private legL: THREE.Mesh

  constructor() {
    super()
    this.bounds.set(0.6, 1.8, 0.6)
    
    // Procedural Zombie Texture Generator (No white backgrounds)
    const createTex = (part: 'head'|'shirt'|'skin'|'pants') => {
      const cvs = document.createElement('canvas')
      cvs.width = cvs.height = 64
      const ctx = cvs.getContext('2d')!
      
      const skin = '#2c5d1b', shirt = '#3a8fb7', pants = '#2e4a62'
      ctx.fillStyle = (part === 'head' || part === 'skin') ? skin : (part === 'shirt' ? shirt : pants)
      ctx.fillRect(0, 0, 64, 64)

      if (part === 'head') {
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(16, 20, 8, 8); ctx.fillRect(40, 20, 8, 8) // Eyes
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(24, 40, 16, 8) // Mouth
      } else if (part === 'shirt') {
        ctx.fillStyle = '#1e3a51'; ctx.globalAlpha = 0.3
        ctx.fillRect(0, 40, 64, 24) // Torn bottom of shirt
        ctx.globalAlpha = 1.0
      } else if (part === 'skin') {
        ctx.fillStyle = '#1e3a15'; // Darker green detail
        ctx.fillRect(10, 10, 5, 5); ctx.fillRect(40, 40, 5, 5)
      }

      const tex = new THREE.CanvasTexture(cvs)
      tex.magFilter = tex.minFilter = THREE.NearestFilter
      return tex
    }

    const texHead = createTex('head'), texShirt = createTex('shirt'), texSkin = createTex('skin'), texPants = createTex('pants')

    // 1. Root Body (Torso)
    const torsoMats = Array(6).fill(new THREE.MeshBasicMaterial({ map: texShirt }))
    this.rootBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), torsoMats)
    this.rootBody.position.y = 1.2
    this.mesh.add(this.rootBody)

    // 2. Head
    const headMats = [
        new THREE.MeshBasicMaterial({ map: texSkin }), // R
        new THREE.MeshBasicMaterial({ map: texSkin }), // L
        new THREE.MeshBasicMaterial({ map: texSkin }), // T
        new THREE.MeshBasicMaterial({ map: texSkin }), // B
        new THREE.MeshBasicMaterial({ map: texHead }), // F
        new THREE.MeshBasicMaterial({ map: texSkin }), // Back
    ]
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMats)
    this.head.position.y = 0.65
    this.rootBody.add(this.head)

    // 3. Limbs
    // 3. Limbs
    const limbGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25)
    const armMat = new THREE.MeshBasicMaterial({ map: texSkin })
    const legMat = new THREE.MeshBasicMaterial({ map: texPants })
    
    this.armR = new THREE.Mesh(limbGeo, armMat)
    this.armR.position.set(0.4, 0.2, 0); this.armR.rotation.x = -Math.PI / 2
    this.rootBody.add(this.armR)

    this.armL = new THREE.Mesh(limbGeo, armMat)
    this.armL.position.set(-0.4, 0.2, 0); this.armL.rotation.x = -Math.PI / 2
    this.rootBody.add(this.armL)

    this.legR = new THREE.Mesh(limbGeo, legMat)
    this.legR.position.set(0.15, -0.75, 0)
    this.rootBody.add(this.legR)
    
    this.legL = new THREE.Mesh(limbGeo, legMat)
    this.legL.position.set(-0.15, -0.75, 0)
    this.rootBody.add(this.legL)

    // Tag for Raycasting
    this.mesh.userData.isMob = true
    this.mesh.userData.mobInstance = this
  }

  public update(delta: number, world: World, playerPos?: THREE.Vector3) {
    // 0. Base physics
    super.update(delta, world)
    if (!playerPos) return

    this.stateTimer -= delta
    this.pathUpdateTimer -= delta
    this.attackCooldown -= delta

    const distToPlayer = this.position.distanceTo(playerPos)

    // 1. AI Logic
    if (distToPlayer < this.detectionRange) {
      if (distToPlayer <= this.attackRange) {
        this.state = 'ATTACK'
      } else {
        this.state = 'CHASE'
      }
    } else {
      if (this.state === 'CHASE' || this.state === 'ATTACK') {
        this.state = 'WANDER'
        this.stateTimer = 0
      }
    }

    if (this.state === 'CHASE') {
      const dir = playerPos.clone().sub(this.position).setY(0).normalize()
      const chaseSpeed = 3.5 // Nerfed from 5.0
      this.velocity.x = dir.x * chaseSpeed
      this.velocity.z = dir.z * chaseSpeed
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z)
      
      // Simple jump logic (A* lite step)
      if (Math.random() < 0.02 && this.velocity.length() > 1) {
        this.velocity.y = 6
      }
    } else if (this.state === 'ATTACK') {
      this.velocity.x = 0
      this.velocity.z = 0
      if (this.attackCooldown <= 0) {
        this.performAttack()
        this.attackCooldown = 1.0
      }
    } else {
      // WANDER logic
      if (this.stateTimer <= 0) {
        const angle = Math.random() * Math.PI * 2
        this.velocity.x = Math.cos(angle) * 3
        this.velocity.z = Math.sin(angle) * 3
        this.stateTimer = 2 + Math.random() * 3
      }
      this.mesh.rotation.y = Math.atan2(this.velocity.x, this.velocity.z)
    }

    // 2. Head follow player
    if (distToPlayer < 10) {
       const headDir = playerPos.clone().sub(this.position.clone().add(new THREE.Vector3(0, 1.8, 0))).normalize()
       this.head.lookAt(this.head.position.clone().add(headDir))
    }

    // 3. Animation
    const t = Date.now() * 0.005
    const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1
    this.legR.rotation.x = isMoving ? Math.sin(t) * 0.5 : 0
    this.legL.rotation.x = isMoving ? Math.sin(t + Math.PI) * 0.5 : 0
  }

  private performAttack() {
    // Simple lunge animation using head movement or root offset
    this.head.position.z += 0.2
    setTimeout(() => { this.head.position.z -= 0.2 }, 200)

    // Damage player
    if ((window as any).playerInstance) {
      (window as any).playerInstance.takeDamage(2)
    }
  }
}

export class PassiveMob extends Entity {
  public mobType: 'pig' | 'cow'
  public state: EntityState = EntityState.IDLE
  private stateTimer: number = 0
  private targetRotation: number = 0
  private walkTimer: number = 0
  
  // Breeding System
  public age: number = 1.0 // 0 = baby, 1 = adult
  public breedingCooldown: number = 0
  public targetMate: PassiveMob | null = null
  public isReadyToBreed: boolean = false
  public courtshipTimer: number = 0

  // Model parts for animation
  private rootBody: THREE.Mesh
  private legFR: THREE.Mesh
  private legFL: THREE.Mesh
  private legBR: THREE.Mesh
  private legBL: THREE.Mesh

  constructor(type: 'pig' | 'cow', isBaby: boolean = false) {
    super()
    this.mobType = type
    this.bounds.set(0.9, 0.9, 0.9)
    if (isBaby) {
      this.age = 0
      this.mesh.scale.setScalar(0.5)
    }

    // Tag for breeding interaction
    this.mesh.userData.isMob = true;
    this.mesh.userData.mobInstance = this;
    
    // Load the isolated textures
    const tLoader = new THREE.TextureLoader()
    const bodyTexPath = type === 'pig' ? '/pig_body.png' : '/cow_body.png'
    const faceTexPath = type === 'pig' ? '/pig_face.png' : '/cow_face.png'
    
    const textureBody = tLoader.load(bodyTexPath)
    textureBody.magFilter = THREE.NearestFilter
    textureBody.colorSpace = THREE.SRGBColorSpace
    
    const textureFace = tLoader.load(faceTexPath)
    textureFace.magFilter = THREE.NearestFilter
    textureFace.colorSpace = THREE.SRGBColorSpace

    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: textureBody })
    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: textureFace })
    
    // Front is index 4
    const headMats = [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat]
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.6, 1.2)
    bodyGeo.translate(0, 0.6, 0)
    this.rootBody = new THREE.Mesh(bodyGeo, bodyMat)
    this.rootBody.castShadow = true
    this.mesh.add(this.rootBody)
    
    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    headGeo.translate(0, 0.8, 0.7)
    const head = new THREE.Mesh(headGeo, headMats)
    head.castShadow = true
    this.rootBody.add(head)

    // Legs
    const legGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3)
    legGeo.translate(0, -0.2, 0) // Anchor at top of leg
    
    this.legFR = new THREE.Mesh(legGeo, bodyMat)
    this.legFR.position.set(0.3, 0.4, 0.5)
    this.rootBody.add(this.legFR)
    
    this.legFL = new THREE.Mesh(legGeo, bodyMat)
    this.legFL.position.set(-0.3, 0.4, 0.5)
    this.rootBody.add(this.legFL)
    
    this.legBR = new THREE.Mesh(legGeo, bodyMat)
    this.legBR.position.set(0.3, 0.4, -0.5)
    this.rootBody.add(this.legBR)
    
    this.legBL = new THREE.Mesh(legGeo, bodyMat)
    this.legBL.position.set(-0.3, 0.4, -0.5)
    this.rootBody.add(this.legBL)
    
    this.mesh.userData.isMob = true
    this.mesh.userData.mobInstance = this
  }

  public update(delta: number, world: World, allEntities: Entity[] = []) {
    this.stateTimer -= delta

    // 0. Age & Growth
    if (this.age < 1.0) {
      this.age += delta / 60.0 // Matures in 1 minute
      const s = THREE.MathUtils.lerp(0.5, 1.0, this.age)
      this.mesh.scale.setScalar(s)
      if (this.age >= 1.0) {
        this.mesh.scale.setScalar(1.0)
      }
    }

    // 0.1 Cooldown
    if (this.breedingCooldown > 0) {
      this.breedingCooldown -= delta
    }

    const px = Math.floor(this.position.x)
    const py = Math.floor(this.position.y)
    const pz = Math.floor(this.position.z)
    
    const footBlock = world.getBlockAt(px, py, pz)
    const headBlock = world.getBlockAt(px, py + 1, pz)

    // 1. Solid block collision (e.g. block placed on top of animal)
    if (footBlock !== BlockType.AIR && footBlock !== BlockType.WATER) {
      this.position.y += Math.max(2.0, delta * 15) // Rapidly push out to avoid getting stuck
      this.state = EntityState.WANDER
      this.targetRotation = Math.random() * Math.PI * 2
      this.stateTimer = 1.0 // Panic run
    }

    // 2. Drowning mechanism
    if (headBlock === BlockType.WATER) {
      this.drownTimer += delta
      if (this.drownTimer > 6.0) { // Dies after 6 seconds fully submerged
        this.isDead = true
      }
    } else {
      this.drownTimer = 0 // Recover breath
    }

    // 3. Breeding State Machine
    if (this.state === EntityState.SEARCHING) {
      // Find a mate
      let closest: PassiveMob | null = null
      let minDist = 10
      for (const e of allEntities) {
        if (e instanceof PassiveMob && e !== this && e.mobType === this.mobType && e.isReadyToBreed && e.age >= 1.0 && e.breedingCooldown <= 0) {
          const d = this.position.distanceTo(e.position)
          if (d < minDist) {
            minDist = d
            closest = e
          }
        }
      }
      if (closest) {
        this.targetMate = closest
        this.state = EntityState.ATTRACTED
      } else if (this.stateTimer <= 0) {
        this.state = EntityState.IDLE
        this.isReadyToBreed = false
      }
    } else if (this.state === EntityState.ATTRACTED) {
      if (!this.targetMate || this.targetMate.isDead || !this.targetMate.isReadyToBreed) {
        this.state = EntityState.SEARCHING
        this.targetMate = null
      } else {
        const d = this.position.distanceTo(this.targetMate.position)
        const dir = this.targetMate.position.clone().sub(this.position).normalize()
        this.targetRotation = Math.atan2(dir.x, dir.z)
        
        if (d < 1.2) {
          this.state = EntityState.COURTSHIP
          this.courtshipTimer = 3.0
          this.velocity.set(0, 0, 0)
        }
      }
    } else if (this.state === EntityState.COURTSHIP) {
      if (!this.targetMate || this.targetMate.isDead || this.position.distanceTo(this.targetMate.position) > 2.0) {
        this.state = EntityState.ATTRACTED
      } else {
        this.courtshipTimer -= delta
        // Simple circling/looking at each other
        const dir = this.targetMate.position.clone().sub(this.position).normalize()
        this.targetRotation = Math.atan2(dir.x, dir.z)
        
        if (this.courtshipTimer <= 0) {
          // BREED!
          this.isReadyToBreed = false
          this.breedingCooldown = 300 // 5 min
          this.state = EntityState.COOLDOWN
          this.stateTimer = 2.0
          
          // One of them spawns the baby to avoid double spawn
          if (this.id < this.targetMate.id) {
             this.isSpawningBaby = true 
             const manager = (window as any).entityManagerInstance
             manager?.particles?.emitHeart(this.position.x, this.position.y + 1, this.position.z, 20)
          }
        } else if (Math.random() < 0.1) {
          const manager = (window as any).entityManagerInstance
          manager?.particles?.emitHeart(this.position.x, this.position.y + 0.5, this.position.z, 2)
        }
      }
    } else if (this.isReadyToBreed && this.state === (EntityState.SEARCHING as EntityState) && Math.random() < 0.05) {
       const manager = (window as any).entityManagerInstance
       manager?.particles?.emitQuestion(this.position.x, this.position.y, this.position.z, 1)
    }

    // 4. Water detection & Swimming
    if (footBlock === BlockType.WATER) {
      if (this.velocity.y < 2.0) this.velocity.y += delta * 12.0 // Buoyancy
      this.state = EntityState.WANDER // Force movement
      
      // Steer towards nearest non-water block (simple gradient lookup)
      let foundLand = false
      if (world.getBlockAt(px + 1, py, pz) !== BlockType.WATER) { this.targetRotation = Math.PI/2; foundLand = true }
      else if (world.getBlockAt(px - 1, py, pz) !== BlockType.WATER) { this.targetRotation = -Math.PI/2; foundLand = true }
      else if (world.getBlockAt(px, py, pz + 1) !== BlockType.WATER) { this.targetRotation = 0; foundLand = true }
      else if (world.getBlockAt(px, py, pz - 1) !== BlockType.WATER) { this.targetRotation = Math.PI; foundLand = true }
      
      if (!foundLand && this.stateTimer <= 0) {
        this.targetRotation += Math.PI + (Math.random() - 0.5) // Turn around wildly
        this.stateTimer = 1.0
      }
    } else if (this.stateTimer <= 0 && this.state !== EntityState.ATTRACTED && this.state !== EntityState.COURTSHIP && this.state !== EntityState.SEARCHING) {
      // Normal state switching on land
      if (this.state === EntityState.IDLE || this.state === EntityState.COOLDOWN) {
        this.state = EntityState.WANDER
        this.stateTimer = 2 + Math.random() * 3
        this.targetRotation = Math.random() * Math.PI * 2
      } else {
        this.state = EntityState.IDLE
        this.stateTimer = 2 + Math.random() * 5
        this.velocity.x = 0
        this.velocity.z = 0
      }
    }

    if (this.state === EntityState.WANDER || this.state === EntityState.ATTRACTED) {
      let speed = footBlock === BlockType.WATER ? 1.0 : 2.5 // Swim slower, run faster on land
      if (this.state === EntityState.ATTRACTED) speed *= 1.4 // Rush to mate
      
      this.velocity.x = Math.sin(this.targetRotation) * speed
      this.velocity.z = Math.cos(this.targetRotation) * speed
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetRotation, delta * 5)

      // Jump if blocked horizontally
      const isBlockedForward = this.checkForwardCollision(world)
      if (isBlockedForward && this.velocity.y <= 0 && footBlock !== BlockType.WATER) {
        this.velocity.y = 4.5 // Jump! (Reduced from 8.5 to limit height to ~1 block)
      }
      
      // Animate legs
      this.walkTimer += delta * 15
      const swing = Math.sin(this.walkTimer) * (footBlock === BlockType.WATER ? 0.8 : 0.5)
      this.legFR.rotation.x = swing
      this.legBL.rotation.x = swing
      this.legFL.rotation.x = -swing
      this.legBR.rotation.x = -swing
    } else if (this.state === EntityState.COURTSHIP) {
       this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetRotation, delta * 5)
       // Happy jitter
       this.mesh.position.y += Math.sin(performance.now() * 0.02) * 0.05
    } else {
      // Return legs to neutral
      this.walkTimer = 0
      this.legFR.rotation.x = 0
      this.legBL.rotation.x = 0
      this.legFL.rotation.x = 0
      this.legBR.rotation.x = 0
    }

    super.update(delta, world)
  }

  public isSpawningBaby = false; // Flag for manager

  private checkForwardCollision(world: World): boolean {
    if (this.velocity.x === 0 && this.velocity.z === 0) return false
    
    const dir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize()
    const nextX = Math.floor(this.position.x + dir.x * 1.0)
    const nextZ = Math.floor(this.position.z + dir.z * 1.0)
    const y = Math.floor(this.position.y)
    
    const type = world.getBlockAt(nextX, y, nextZ)
    return (type !== BlockType.AIR && type !== BlockType.WATER)
  }
}

export class EntityManager {
  public entities: Entity[] = []
  private scene: THREE.Scene
  public particles: any; // ParticleSystem

  constructor(scene: THREE.Scene, particles: any) {
    this.scene = scene
    this.particles = particles
  }

  public addEntity(e: Entity) {
    this.entities.push(e)
    this.scene.add(e.mesh)
  }

  public removeEntity(e: Entity) {
    this.scene.remove(e.mesh)
    this.entities = this.entities.filter(ent => ent.id !== e.id)
  }

  public update(delta: number, world: World, playerPos: THREE.Vector3) {
    // Dynamic Spawning System
    if (this.entities.length < 15 && Math.random() < delta * 2.0) {
      const rx = Math.floor(playerPos.x + (Math.random() - 0.5) * 60)
      const rz = Math.floor(playerPos.z + (Math.random() - 0.5) * 60)
      
      // Find the highest block at this random coordinate
      for (let y = 64; y > 0; y--) { 
        const type = world.getBlockAt(rx, y, rz)
        if (type !== BlockType.AIR) {
          if (type === BlockType.GRASS || type === BlockType.DIRT || type === BlockType.SNOW || type === BlockType.STONE || type === BlockType.SAND) {
            const isHostile = Math.random() < 0.2 // 20% chance for zombie
            const mob = isHostile ? new HostileMob() : new PassiveMob(Math.random() < 0.5 ? 'pig' : 'cow')
            mob.position.set(rx + 0.5, y + 1.5, rz + 0.5)
            this.addEntity(mob)
          }
          break 
        }
      }
    }

    const babiesToSpawn: PassiveMob[] = []

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]
      
      if (e instanceof PassiveMob) {
        e.update(delta, world, this.entities)
        if (e.isSpawningBaby) {
          e.isSpawningBaby = false
          const baby = new PassiveMob(e.mobType, true)
          baby.position.copy(e.position).add(new THREE.Vector3(0.5, 0, 0.5))
          babiesToSpawn.push(baby)
        }
      } else if (e instanceof HostileMob) {
        e.update(delta, world, playerPos)
      } else {
        e.update(delta, world)
      }
      
      // Despawn if they wander too far (e.g. 100 blocks)
      if (e.position.distanceTo(playerPos) > 100) {
        e.isDead = true
      }
      
      if (e.isDead) {
        this.removeEntity(e)
      }
    }

    for (const b of babiesToSpawn) {
      this.addEntity(b)
    }
  }
}
