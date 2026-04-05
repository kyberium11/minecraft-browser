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
import { TimeManager } from './core/TimeManager'
import { Sky } from 'three/examples/jsm/objects/Sky'
import { NightSky } from './core/NightSky'
import { EntityManager, PassiveMob } from './core/EntityManager'

// 0. Time & Atmosphere
const timeManager = new TimeManager()
const sky = new Sky()
sky.scale.setScalar(450000)

const skyUniforms = sky.material.uniforms
skyUniforms['turbidity'].value = 10
skyUniforms['rayleigh'].value = 3
skyUniforms['mieCoefficient'].value = 0.005
skyUniforms['mieDirectionalG'].value = 0.7

// 0. UI ROOT
const uiRoot = createRoot(document.getElementById('ui-root')!)
uiRoot.render(<App />)

// 1. Initial Setup
const scene = new THREE.Scene()
scene.add(sky)

const nightSky = new NightSky()
scene.add(nightSky)
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

const sunLight = new THREE.DirectionalLight(0xffffff, 1.0)
sunLight.castShadow = true
scene.add(sunLight)

// 2. Game Objects
const world = new World()
scene.add(world)

const particleSystem = new ParticleSystem(scene)
const player = new Player(camera, renderer.domElement, scene, particleSystem)

const entityManager = new EntityManager(scene, particleSystem);
(window as any).entityManagerInstance = entityManager;


// 3. Initial Inventory
const store = useInventoryStore.getState()
store.setSlot(0, BlockType.OAK_PLANKS, 64)
store.setSlot(1, BlockType.COBBLESTONE, 64)
store.setSlot(2, BlockType.GLASS, 64)
store.setSlot(3, BlockType.WHEAT, 64)
store.setSlot(4, BlockType.CARROT, 64)

// 4. Animation Loop
let lastTime = 0
let frameCount = 0

function animate(time: number) {
  requestAnimationFrame(animate)
  const dt = time - lastTime
  const delta = Math.min(0.1, dt * 0.001)
  lastTime = time
  
  // Update Time Cycle (Speed of Day-Night)
  timeManager.update(delta)
  
  // Optimization: Update Lighting/Sky every 15 frames
  frameCount++
  if (frameCount % 15 === 0) {
    const sunPos = timeManager.sunDirection.clone().multiplyScalar(400)
    sunLight.position.copy(sunPos)
    sunLight.intensity = timeManager.sunIntensity
    
    ambientLight.color.copy(timeManager.ambientColor)
    
    const params = timeManager.getSkyParams()
    const phi = THREE.MathUtils.degToRad(90 - params.elevation)
    const theta = THREE.MathUtils.degToRad(params.azimuth)
    
    const sunV3 = new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
    skyUniforms['sunPosition'].value.copy(sunV3)
    
    // Smooth Fog Transitions
    if (scene.fog) {
      scene.fog.color.copy(timeManager.ambientColor)
    }
  }
  
  player.update(delta, world)
  world.update(camera.position, delta)
  particleSystem.update(delta)
  nightSky.update(camera.position, timeManager.sunDirection.y, time)
  entityManager.update(delta, world, camera.position)
  
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
