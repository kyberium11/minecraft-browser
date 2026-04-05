import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { BlockType } from '../world/Chunk'
import { World } from '../world/World'
import { textureLoader } from './TextureLoader'
import { SelectionBox } from '../world/SelectionBox'
import { useInventoryStore } from './InventoryStore'
import { ParticleSystem } from './Particles'
import { PlayerModel } from './PlayerModel'

export class Player {
  private camera: THREE.PerspectiveCamera
  public controls: PointerLockControls
  private raycaster: THREE.Raycaster
  
  // Movement properties
  private velocity = new THREE.Vector3()
  private direction = new THREE.Vector3()
  private speed = 80.0
  private gravity = 35.0
  private jumpForce = 15.0
  private isSprinting = false

  // Physical dimensions (AABB)
  private width = 0.6
  private height = 1.8
  
  // Inputs
  private moveForward = false
  private moveBackward = false
  private moveLeft = false
  private moveRight = false
  private canJump = false
  private isInWater = false
  private wasInWater = false
  
  // Viewmodel (Hand + Stick)
  private viewmodel: THREE.Group
  private hand: THREE.Mesh
  private stick: THREE.Mesh
  private isSwinging = false
  private swingStartTime = 0

  // Interaction
  private selectionBox: SelectionBox
  private worldReference?: World
  private particles: ParticleSystem
  private model: PlayerModel
  private isThirdPerson: boolean = false
  public playerPosition = new THREE.Vector3(8, 25, 8)
  
  // Health System
  public hp: number = 20
  public isInvulnerable: boolean = false
  private invulnTimer: number = 0

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, scene: THREE.Scene, particles: ParticleSystem) {
    this.camera = camera
    this.controls = new PointerLockControls(this.camera, domElement)
    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = 4 
    this.particles = particles
    
    // Global reference for mobs to attack
    ;(window as any).playerInstance = this
    
    
    // Character Model
    const textures = {
      head: textureLoader.load('/assets/textures/luffy_skin.png'),
      body: textureLoader.load('/assets/textures/luffy_body.png'),
      arms: textureLoader.load('/assets/textures/luffy_arms.png'),
      legs: textureLoader.load('/assets/textures/luffy_legs.png'),
      hat: textureLoader.load('/assets/textures/luffy_hat.png')
    }
    
    Object.values(textures).forEach(tex => {
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
    });
    
    this.model = new PlayerModel(textures)
    scene.add(this.model)
    
    // Initial position
    this.camera.position.copy(this.playerPosition)
    
    // Build Viewmodel
    this.viewmodel = new THREE.Group()
    const handGeom = new THREE.BoxGeometry(0.2, 0.2, 0.5)
    const handMat = new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/hand.png') })
    this.hand = new THREE.Mesh(handGeom, handMat)
    this.hand.position.set(0.5, -0.4, -0.5)
    this.viewmodel.add(this.hand)
    
    const stickGeom = new THREE.BoxGeometry(0.05, 0.05, 1.0)
    const stickMat = new THREE.MeshBasicMaterial({ map: textureLoader.load('/assets/textures/oak_log_side.png') })
    this.stick = new THREE.Mesh(stickGeom, stickMat)
    this.stick.position.set(0.5, -0.3, -0.9)
    this.stick.rotation.x = -Math.PI / 4
    this.viewmodel.add(this.stick)
    
    this.camera.add(this.viewmodel)

    // Interaction Visuals
    this.selectionBox = new SelectionBox()
    scene.add(this.selectionBox)
    
    this.initEventListeners()
  }

  private initEventListeners() {
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW': this.moveForward = true; break
        case 'KeyS': this.moveBackward = true; break
        case 'KeyA': this.moveLeft = true; break
        case 'KeyD': this.moveRight = true; break
        case 'KeyV': this.isThirdPerson = !this.isThirdPerson; break
        case 'ShiftLeft': this.isSprinting = true; break
        case 'Space': 
          if (this.canJump) {
            this.velocity.y += this.jumpForce
            this.canJump = false
          }
          break
        
        // Slot Selection Keys
        case 'Digit1': useInventoryStore.getState().selectSlot(0); break
        case 'Digit2': useInventoryStore.getState().selectSlot(1); break
        case 'Digit3': useInventoryStore.getState().selectSlot(2); break
        case 'Digit4': useInventoryStore.getState().selectSlot(3); break
        case 'Digit5': useInventoryStore.getState().selectSlot(4); break
        case 'Digit6': useInventoryStore.getState().selectSlot(5); break
        case 'Digit7': useInventoryStore.getState().selectSlot(6); break
        case 'Digit8': useInventoryStore.getState().selectSlot(7); break
        case 'Digit9': useInventoryStore.getState().selectSlot(8); break
      }
    })

    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW': this.moveForward = false; break
        case 'KeyS': this.moveBackward = false; break
        case 'KeyA': this.moveLeft = false; break
        case 'KeyD': this.moveRight = false; break
        case 'ShiftLeft': this.isSprinting = false; break
      }
    })
    
    document.addEventListener('mousedown', (event) => {
      if (!this.controls.isLocked) {
        this.controls.lock()
        return
      }

      this.isSwinging = true
      this.swingStartTime = performance.now()

      if (this.worldReference) {
        this.handleInteraction(event.button)
      }
    })

    document.addEventListener('contextmenu', (event) => {
      event.preventDefault()
    })

    document.addEventListener('wheel', (event) => {
      const inventory = useInventoryStore.getState()
      let nextIndex = inventory.selectedSlotIndex + (event.deltaY > 0 ? 1 : -1)
      if (nextIndex < 0) nextIndex = 8
      if (nextIndex > 8) nextIndex = 0
      inventory.selectSlot(nextIndex)
    })
  }

  private handleInteraction(button: number) {
    this.raycaster.far = 8.5
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    const intersects = this.raycaster.intersectObjects(this.worldReference!.children, true)
    
    let hitWater = false
    if (intersects.length > 0) {
      const intersect = intersects[0]
      const block = this.worldReference!.getBlockAt(
        intersect.point.x - (intersect.face?.normal.x ?? 0) * 0.1,
        intersect.point.y - (intersect.face?.normal.y ?? 0) * 0.1,
        intersect.point.z - (intersect.face?.normal.z ?? 0) * 0.1
      )
      
      if (block === BlockType.WATER) hitWater = true
      
      const normal = intersect.face?.normal.clone()
      if (normal && !hitWater) {
        normal.transformDirection(intersect.object.matrixWorld)
        const targetPos = intersect.point.clone().sub(normal.clone().multiplyScalar(0.5))
        this.selectionBox.update(targetPos.x, targetPos.y, targetPos.z)
      } else {
        this.selectionBox.hide()
      }

      if (button === 0 && !hitWater) {
        const origFar = this.raycaster.far;
        this.raycaster.far = 4.5;
        const entInts = this.raycaster.intersectObjects(this.worldReference.parent.children);
        const h = entInts.find(i => { let c = i.object; while(c && !(c.userData && c.userData.isMob)) c = c.parent; return c && c.userData && c.userData.isMob; });
        if (h) {
          let c = h.object; while(c && !(c.userData && c.userData.isMob)) c = c.parent;
          const mob = c?.userData.mobInstance;
          if (mob && mob.takeDamage) {
            mob.takeDamage(2, this.camera.position);
            this.model?.triggerSwing('break');
            this.raycaster.far = origFar;
            return;
          }
        }
        this.raycaster.far = origFar;

        const targetPos = intersect.point.clone().sub(normal!.clone().multiplyScalar(0.5));
        this.worldReference!.setBlockAt(targetPos.x, targetPos.y, targetPos.z, BlockType.AIR);
        this.model?.triggerSwing('break');
      } else if (button === 2) {
        const inventory = useInventoryStore.getState();
        const selectedSlot = inventory.slots[inventory.selectedSlotIndex];
        if (selectedSlot.type !== null && selectedSlot.count > 0) {
          const targetPos = hitWater ? intersect.point.clone().sub(normal!.clone().multiplyScalar(0.1)) : intersect.point.clone().add(normal!.clone().multiplyScalar(0.5));
          const testPos = new THREE.Vector3(Math.floor(targetPos.x) + 0.5, Math.floor(targetPos.y) + 0.5, Math.floor(targetPos.z) + 0.5);
          if (testPos.distanceTo(this.camera.position) > 0.8) {
            this.worldReference!.setBlockAt(targetPos.x, targetPos.y, targetPos.z, selectedSlot.type)
            inventory.removeItem(selectedSlot.type)
            this.model?.triggerSwing('place', selectedSlot.type)
          } else {
            this.model?.triggerSwing('break') // swing anyway when failing to place
          }
        }
      }
    } else {
      this.selectionBox.hide()
      // Swing anyway even if clicking the air
      if (button === 2) {
        const inventory = useInventoryStore.getState()
        const selectedSlot = inventory.slots[inventory.selectedSlotIndex]
        if (selectedSlot.type !== null) {
          this.model?.triggerSwing('place', selectedSlot.type)
        } else {
          this.model?.triggerSwing('break')
        }
      } else {
        this.model?.triggerSwing('break')
      }
    }
  }

  public takeDamage(amount: number) { if (this.isInvulnerable || this.hp <= 0) return; this.hp -= amount; this.isInvulnerable = true; this.invulnTimer = 0.5; if (this.hp <= 0) { this.hp = 20; this.playerPosition.set(8, 30, 8); } }

  public update(delta: number, world: World) { if (this.invulnTimer > 0) { this.invulnTimer -= delta; if (this.invulnTimer <= 0) this.isInvulnerable = false; }
    this.worldReference = world
    if (!this.controls.isLocked) return

    // Limit delta to prevent teleporting through floors
    const limitedDelta = Math.min(delta, 0.05)

    // --- Unstuck Logic ---
    let unstuckAttempts = 0
    while (this.checkCollision(this.playerPosition, world) && unstuckAttempts < 5) {
      this.playerPosition.y += 0.2
      this.velocity.y = 0
      this.canJump = true 
      unstuckAttempts++
    }

    // Direction and Velocity
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward)
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft)
    this.direction.normalize()

    const currentSpeed = this.speed * (this.isSprinting ? 1.5 : 1.0)
    if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * currentSpeed * limitedDelta
    if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * currentSpeed * limitedDelta
    
    // Friction
    this.velocity.x -= this.velocity.x * 12.0 * limitedDelta
    this.velocity.z -= this.velocity.z * 12.0 * limitedDelta
    
    // Gravity
    this.velocity.y -= (this.isInWater ? this.gravity * 0.1 : this.gravity) * limitedDelta

    // --- Collision Logic (Decoupled from render Camera) ---
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    forward.y = 0; forward.normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    right.y = 0; right.normalize()

    this.playerPosition.addScaledVector(right, -this.velocity.x * limitedDelta)
    if (this.checkCollision(this.playerPosition, world)) {
      this.playerPosition.addScaledVector(right, this.velocity.x * limitedDelta)
      this.velocity.x = 0
    }

    this.playerPosition.addScaledVector(forward, -this.velocity.z * limitedDelta)
    if (this.checkCollision(this.playerPosition, world)) {
      this.playerPosition.addScaledVector(forward, this.velocity.z * limitedDelta)
      this.velocity.z = 0
    }

    const oldPosY = this.playerPosition.y
    this.playerPosition.y += this.velocity.y * limitedDelta
    if (this.checkCollision(this.playerPosition, world)) {
      if (this.velocity.y < 0) this.canJump = true
      this.playerPosition.y = oldPosY
      this.velocity.y = 0
    } else {
      const belowPos = this.playerPosition.clone()
      belowPos.y -= 0.1
      if (this.checkCollision(belowPos, world)) {
        this.canJump = true
      } else if (this.velocity.y !== 0 && !this.isInWater) {
        this.canJump = false
      }
    }

    // --- Water Check (Expanded for reliability) ---
    const checkPoints = [
      { x: 0, y: -0.5, z: 0 },
      { x: 0, y: -1.2, z: 0 },
      { x: 0, y: -1.7, z: 0 }
    ]
    let waterFound = false
    for (const pt of checkPoints) {
       if (world.getBlockAt(this.playerPosition.x + pt.x, this.playerPosition.y + pt.y, this.playerPosition.z + pt.z) === BlockType.WATER) {
         waterFound = true
         break
       }
    }

    // SPLASH EFFECT
    if (waterFound && !this.wasInWater) {
       this.particles.emit(this.playerPosition.x, this.playerPosition.y - 1.5, this.playerPosition.z, 30)
    }
    
    this.wasInWater = this.isInWater
    this.isInWater = waterFound
    if (this.isInWater) {
      this.velocity.x *= 0.8
      this.velocity.z *= 0.8
      this.velocity.y *= 0.9
      this.canJump = true 
    }

    // --- Interaction Visuals (Selection Box) ---
    this.raycaster.far = 8.5
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera)
    const intersects = this.raycaster.intersectObjects(world.children, true)
    
    let hitWaterVisual = false
    if (intersects.length > 0) {
      const intersect = intersects[0]
      const block = world.getBlockAt(
        intersect.point.x - (intersect.face?.normal.x ?? 0) * 0.1,
        intersect.point.y - (intersect.face?.normal.y ?? 0) * 0.1,
        intersect.point.z - (intersect.face?.normal.z ?? 0) * 0.1
      )
      
      if (block === BlockType.WATER) hitWaterVisual = true
      
      const normal = intersect.face?.normal.clone()
      if (normal && !hitWaterVisual) {
        normal.transformDirection(intersect.object.matrixWorld)
        const targetPos = intersect.point.clone().sub(normal.clone().multiplyScalar(0.5))
        this.selectionBox.update(targetPos.x, targetPos.y, targetPos.z)
      } else {
        this.selectionBox.hide()
      }
    } else {
      this.selectionBox.hide()
    }

    // --- Animations ---
    const time = performance.now() / 1000
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight
    if (isMoving && this.canJump) {
      const bobFreq = this.isSprinting ? 15 : 10
      const bobAmp = this.isSprinting ? 0.04 : 0.02
      this.viewmodel.position.y = Math.sin(time * bobFreq) * bobAmp
      this.viewmodel.position.x = Math.cos(time * (bobFreq / 2)) * (bobAmp / 2)
    } else {
      this.viewmodel.position.y *= 0.8
      this.viewmodel.position.x *= 0.8
    }
    
    if (this.isSwinging) {
      const elapsed = (performance.now() - this.swingStartTime) / 200
      if (elapsed < 1) {
        this.viewmodel.rotation.x = Math.sin(elapsed * Math.PI) * 0.4
      } else {
        this.isSwinging = false
        this.viewmodel.rotation.x = 0
      }
    }

    // --- 3rd Person & Model Updates ---
    this.model.position.copy(this.playerPosition)
    this.model.position.y -= 1.6 // Align with foot level
    // Make the model face the same direction as the camera horizontally
    this.model.rotation.y = this.camera.rotation.y + Math.PI

    this.model.update(isMoving && this.canJump, time)

    if (this.isThirdPerson) {
      // Third Person View
      const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion)
      backward.y = 0 // Keep the distance check horizontal if preferred, but usually full 3D is okay
      backward.normalize()
      
      const targetPos = this.playerPosition.clone()
      // Bring camera closer like GTA (2 units behind, 0.5 units above head level)
      targetPos.addScaledVector(backward, 2.0) 
      targetPos.y += 0.5
      
      // We don't lerp because pointer lock controls gets extremely jittery.
      // We explicitly lock position.
      this.camera.position.copy(targetPos)
      
      this.model.visible = true
      this.viewmodel.visible = false
    } else {
      // First Person View
      this.camera.position.copy(this.playerPosition)
      // Slight vertical eye offset if needed? Player position is already at eye level.
      this.model.visible = false
      this.viewmodel.visible = true
    }
  }

  private checkCollision(pos: THREE.Vector3, world: World): boolean {
    const halfWidth = (this.width / 2) - 0.05
    const eyeHeight = 1.6
    
    const minX = pos.x - halfWidth
    const maxX = pos.x + halfWidth
    const minY = pos.y - eyeHeight + 0.05
    const maxY = pos.y + (this.height - eyeHeight) - 0.05
    const minZ = pos.z - halfWidth
    const maxZ = pos.z + halfWidth

    const startX = Math.floor(minX)
    const endX = Math.floor(maxX)
    const startY = Math.floor(minY)
    const endY = Math.floor(maxY)
    const startZ = Math.floor(minZ)
    const endZ = Math.floor(maxZ)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        for (let z = startZ; z <= endZ; z++) {
          const block = world.getBlockAt(x, y, z)
          if (block !== BlockType.AIR && block !== BlockType.WATER) return true
        }
      }
    }
    return false
  }
}
