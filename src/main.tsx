import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import './style.css'
import * as THREE from 'three'
import { World } from './world/World'
import { Player } from './core/Player'
import { ParticleSystem } from './core/Particles'
import { useInventoryStore } from './core/InventoryStore'
import { BlockType } from './world/VoxelConfig'
import { globalUniforms } from './world/Chunk'

// 0. UI ROOT
const uiRoot = createRoot(document.getElementById('ui-root')!)
uiRoot.render(<App />)

// 1. Initial Setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87CEEB)
scene.fog = new THREE.FogExp2(0x87CEEB, 0.015)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
scene.add(ambientLight)

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8)
sunLight.position.set(50, 100, 50)
scene.add(sunLight)

// 2. Game Objects
const world = new World()
scene.add(world)

const particleSystem = new ParticleSystem(scene)
const player = new Player(camera, renderer.domElement, scene, particleSystem)

// 3. Initial Inventory
const store = useInventoryStore.getState()
store.setSlot(0, BlockType.OAK_PLANKS, 64)
store.setSlot(1, BlockType.COBBLESTONE, 64)
store.setSlot(2, BlockType.GLASS, 64)

// 4. Animation Loop
let lastTime = 0
function animate(time: number) {
  requestAnimationFrame(animate)
  const dt = time - lastTime
  const delta = Math.min(0.1, dt * 0.001)
  lastTime = time
  
  player.update(delta, world)
  world.update(camera.position, delta)
  particleSystem.update(delta)
  
  // Update global uniforms (sea waves, etc)
  globalUniforms.uTime.value = time * 0.001
  
  renderer.render(scene, camera)
}

// 5. Handle Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate(0)
